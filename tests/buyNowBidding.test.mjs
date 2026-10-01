import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(path, dependencies = {}) {
  const code = ts.transpileModule(readFileSync(new URL("../" + path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    Date,
    Math,
    require(name) {
      if (!(name in dependencies)) throw new Error("Unexpected dependency: " + name);
      return dependencies[name];
    },
  }, { filename: path });
  return exports;
}

const listingKind = load("src/lib/listingKind.ts");
const orderCreate = load("src/lib/orderCreate.ts");

function fixture(listing, { claimRows = [{ id: "l1" }], orderError = null, bidError = null, topBidder = null, topAmount = 1000, userId = "buyer-1", claimSeq = null } = {}) {
  const calls = { updates: [], orders: [], bids: [], bidsDeleted: [], notified: [], notifiedWatchers: [] };
  const actions = load("src/app/listings/[id]/actions.ts", {
    "next/cache": { revalidatePath() {} },
    "@/lib/session": { requireVerifiedUserId: async () => userId },
    "@/lib/listingKind": listingKind,
    "@/lib/orderCreate": orderCreate,
    "@/lib/notifications": {
      notify: async (supabase, params) => { calls.notified.push(params); },
      notifyWatchers: async (supabase, listingId, params) => { calls.notifiedWatchers.push({ listingId, ...params }); },
    },
    "@/lib/format": { formatTHB: (n) => `฿${n}` },
    "@/lib/supabase/server": {
      createServiceClient: () => ({
        from: (table) => {
          if (table === "listings") {
            return {
              select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: listing }) }) }),
              update: (fields) => {
                const filters = {};
                const chain = {
                  eq(col, val) { filters[col] = val; return chain; },
                  select() { calls.updates.push({ fields, filters }); return Promise.resolve({ data: claimSeq ? (claimSeq.shift() ?? []) : claimRows, error: null }); },
                  then(resolve) { calls.updates.push({ fields, filters }); resolve({ error: null }); },
                };
                return chain;
              },
            };
          }
          if (table === "orders") {
            return { insert: (row) => { calls.orders.push(row); return { select: () => ({ single: async () => ({ data: orderError ? null : { id: "o1" }, error: orderError }) }) }; } };
          }
          if (table === "bids") {
            return {
              delete: () => ({ eq: (col, val) => { calls.bidsDeleted.push({ col, val }); return Promise.resolve({}); } }),
              select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: topBidder ? { bidder_id: topBidder, amount: topAmount } : null }) }) }) }) }), insert: (row) => { calls.bids.push(row); return { select: () => ({ single: async () => ({ data: bidError ? null : { id: "b1", ...row }, error: bidError }) }) }; } };
          }
          throw new Error("Unexpected table: " + table);
        },
      }),
    },
  });
  return { actions, calls };
}

const base = { id: "l1", seller_id: "seller-1", status: "active", start_price: 1000, current_price: 1000, buy_now_price: 4000, ends_at: new Date(Date.now() + 3600_000).toISOString() };

test("buy-now is available only until the first bid", () => {
  assert.equal(listingKind.isBuyNowAvailable(base), true);
  assert.equal(listingKind.isBuyNowAvailable({ ...base, current_price: 1100 }), false);
  assert.equal(listingKind.isBuyNowAvailable({ ...base, buy_now_price: null }), false);
  assert.equal(listingKind.isAuction({ ...base, current_price: 1100 }), true);
  // An auction with an instant-win price is an auction from the start, not only after a bid.
  assert.equal(listingKind.isAuction(base), true);
  assert.equal(listingKind.isAuction({ ...base, buy_now_price: 1000 }), false);
  assert.equal(listingKind.isAuction({ ...base, buy_now_price: null }), true);
});

test("anti-snipe seconds default to 120 (2 min) for rows from before the column existed", () => {
  assert.equal(listingKind.antiSnipeSecondsOf(base), 120);
  assert.equal(listingKind.antiSnipeSecondsOf({ ...base, anti_snipe_seconds: 0 }), 0);
  assert.equal(listingKind.antiSnipeSecondsOf({ ...base, anti_snipe_seconds: 300 }), 300);
  assert.equal(listingKind.formatAntiSnipeDuration(120), "2 นาที");
  assert.equal(listingKind.formatAntiSnipeDuration(60), "1 นาที");
  assert.equal(listingKind.formatAntiSnipeDuration(45), "45 วินาที");
});

test("buyNow refuses once a bid exists", async () => {
  const { actions, calls } = fixture({ ...base, current_price: 1100 });
  const result = await actions.buyNow("l1");
  assert.ok(result.error);
  assert.equal(calls.orders.length, 0);
});

test("buyNow claims the listing atomically (active + unbid) before creating the order", async () => {
  const { actions, calls } = fixture(base);
  const result = await actions.buyNow("l1");
  assert.equal(result.success, true);
  assert.equal(calls.updates[0].fields.status, "sold");
  assert.equal(calls.updates[0].filters.status, "active");
  assert.equal(calls.updates[0].filters.current_price, 1000);
  assert.equal(calls.orders.length, 1);
});

test("buyNow notifies watchers the listing closed, but not the buyer", async () => {
  const { actions, calls } = fixture(base);
  const result = await actions.buyNow("l1");
  assert.equal(result.success, true);
  assert.equal(calls.notifiedWatchers.length, 1);
  assert.equal(calls.notifiedWatchers[0].listingId, "l1");
  assert.equal(calls.notifiedWatchers[0].type, "auction_ended");
  assert.deepEqual(Array.from(calls.notifiedWatchers[0].exclude), ["buyer-1"]);
});

test("buyNow loses the race cleanly: no rows claimed means no order", async () => {
  const { actions, calls } = fixture(base, { claimRows: [] });
  const result = await actions.buyNow("l1");
  assert.ok(result.error);
  assert.equal(calls.orders.length, 0);
});

test("buyNow reopens the listing if the order insert fails", async () => {
  const { actions, calls } = fixture(base, { orderError: { message: "x" } });
  const result = await actions.buyNow("l1");
  assert.ok(result.error);
  assert.equal(calls.updates.at(-1).fields.status, "active");
});

test("placeBid is conditional on status and the price it read, and never lands a bid when it loses the race", async () => {
  const { actions, calls } = fixture(base, { claimRows: [] });
  const lost = await actions.placeBid("l1", 1100);
  assert.ok(lost.error);
  assert.equal(calls.bids.length, 0);

  const ok = fixture(base);
  const won = await ok.actions.placeBid("l1", 1100);
  assert.equal(won.success, true);
  assert.equal(ok.calls.updates[0].filters.status, "active");
  assert.equal(ok.calls.updates[0].filters.current_price, 1000);
});

test("the current top bidder cannot outbid themselves", async () => {
  const { actions, calls } = fixture(base, { topBidder: "buyer-1" });
  const result = await actions.placeBid("l1", 1100);
  assert.ok(result.error);
  assert.equal(calls.updates.length, 0);
  assert.equal(calls.bids.length, 0);
});

test("a bid at the buy-now price wins instantly: listing sold, order created at that price", async () => {
  const { actions, calls } = fixture({ ...base, current_price: 3900 });
  const result = await actions.placeBid("l1", 4000);
  assert.equal(result.won, true);
  assert.equal(result.orderId, "o1");
  assert.equal(calls.updates[0].fields.status, "sold");
  assert.equal(calls.updates[0].fields.current_price, 4000);
  assert.equal(calls.orders[0].amount, 4000);
  assert.equal(calls.orders[0].buyer_id, "buyer-1");
});

test("a bid above the buy-now price is capped at it", async () => {
  const { actions, calls } = fixture({ ...base, current_price: 3900 });
  const result = await actions.placeBid("l1", 9999);
  assert.equal(result.won, true);
  assert.equal(calls.bids[0].amount, 4000);
  assert.equal(calls.orders[0].amount, 4000);
});

test("the buy-now price is reachable even when the next increment would step past it", async () => {
  const { actions } = fixture({ ...base, current_price: 3950 });
  const result = await actions.placeBid("l1", 4000);
  assert.equal(result.won, true);
});

test("a bid below the buy-now price stays a normal bid", async () => {
  const { actions, calls } = fixture(base);
  const result = await actions.placeBid("l1", 1100);
  assert.equal(result.won, false);
  assert.equal(calls.orders.length, 0);
  assert.equal(calls.updates[0].fields.status, undefined);
});

test("a normal bid that overtakes an existing top bidder notifies them they were outbid", async () => {
  const { actions, calls } = fixture(base, { topBidder: "bidder-old", topAmount: 1000 });
  const result = await actions.placeBid("l1", 1100);
  assert.equal(result.won, false);
  assert.equal(calls.notified.length, 1);
  assert.equal(calls.notified[0].userId, "bidder-old");
  assert.equal(calls.notified[0].type, "outbid");
});

test("an instant win notifies the previous top bidder they lost, and watchers the auction ended, but not the winner", async () => {
  const { actions, calls } = fixture({ ...base, current_price: 3900 }, { topBidder: "bidder-old", topAmount: 3900 });
  const result = await actions.placeBid("l1", 4000);
  assert.equal(result.won, true);
  assert.equal(calls.notified.length, 1);
  assert.equal(calls.notified[0].userId, "bidder-old");
  assert.equal(calls.notified[0].type, "auction_ended");
  assert.equal(calls.notifiedWatchers.length, 1);
  // The excluded ids come out of a different vm context, so compare as plain values, not by array identity.
  assert.deepEqual(Array.from(calls.notifiedWatchers[0].exclude).sort(), ["bidder-old", "buyer-1"]);
});

test("a bid with no previous top bidder notifies no one", async () => {
  const { actions, calls } = fixture(base);
  await actions.placeBid("l1", 1100);
  assert.equal(calls.notified.length, 0);
});

test("an instant win whose order fails is rolled back: bid removed, listing reopened", async () => {
  const { actions, calls } = fixture({ ...base, current_price: 3900 }, { orderError: { message: "x" } });
  const result = await actions.placeBid("l1", 4000);
  assert.ok(result.error);
  assert.equal(calls.bidsDeleted.length, 1);
  assert.equal(calls.updates.at(-1).fields.status, "active");
  assert.equal(calls.updates.at(-1).fields.current_price, 3900);
});

test("the seller's bid increment sets the minimum bid, and defaults to 100", async () => {
  const custom = fixture({ ...base, bid_increment: 500, buy_now_price: null });
  assert.ok((await custom.actions.placeBid("l1", 1400)).error);
  assert.equal((await custom.actions.placeBid("l1", 1500)).success, true);

  const legacy = fixture({ ...base, buy_now_price: null });
  assert.ok((await legacy.actions.placeBid("l1", 1050)).error);
  assert.equal((await legacy.actions.placeBid("l1", 1100)).success, true);
});

test("a bid in the closing window extends the listing by the seller's chosen anti-snipe length, and defaults to 2 minutes", async () => {
  const soon = { ...base, buy_now_price: null, ends_at: new Date(Date.now() + 90_000).toISOString() }; // 90s left
  const custom = fixture({ ...soon, anti_snipe_seconds: 300 });
  const result = await custom.actions.placeBid("l1", 1100);
  assert.equal(result.extended, true);
  const gained = new Date(result.newEndsAt).getTime() - new Date(soon.ends_at).getTime();
  assert.ok(Math.abs(gained - 300_000) < 1000);

  const legacy = fixture(soon); // no anti_snipe_seconds column: default 120s
  const legacyResult = await legacy.actions.placeBid("l1", 1100);
  assert.equal(legacyResult.extended, true);
  const legacyGained = new Date(legacyResult.newEndsAt).getTime() - new Date(soon.ends_at).getTime();
  assert.ok(Math.abs(legacyGained - 120_000) < 1000);
});

test("a seller who turned anti-snipe off gets a hard deadline: a last-second bid never extends it", async () => {
  const soon = { ...base, buy_now_price: null, anti_snipe_seconds: 0, ends_at: new Date(Date.now() + 5_000).toISOString() };
  const { actions } = fixture(soon);
  const result = await actions.placeBid("l1", 1100);
  assert.equal(result.extended, false);
  assert.equal(result.newEndsAt, soon.ends_at);
});

test("a bid outside the anti-snipe window doesn't extend, even with plenty of time left in a short auction", async () => {
  const soon = { ...base, buy_now_price: null, anti_snipe_seconds: 60, ends_at: new Date(Date.now() + 90_000).toISOString() }; // 90s > 60s window
  const { actions } = fixture(soon);
  const result = await actions.placeBid("l1", 1100);
  assert.equal(result.extended, false);
  assert.equal(result.newEndsAt, soon.ends_at);
});

test("a fixed-price listing (buy-now equals start) cannot be bid on", async () => {
  const { actions, calls } = fixture({ ...base, buy_now_price: 1000 });
  const result = await actions.placeBid("l1", 1100);
  assert.ok(result.error);
  assert.equal(calls.bids.length, 0);
  assert.equal(listingKind.isFixedPrice({ buy_now_price: 1000, start_price: 1000 }), true);
  assert.equal(listingKind.isFixedPrice({ buy_now_price: 4000, start_price: 1000 }), false);
  assert.equal(listingKind.isFixedPrice({ buy_now_price: null, start_price: 1000 }), false);
});

test("only the seller can end an auction early", async () => {
  const { actions, calls } = fixture({ ...base, buy_now_price: null }, { userId: "someone-else" });
  const result = await actions.endAuctionNow("l1");
  assert.ok(result.error);
  assert.equal(calls.updates.length, 0);
});

test("ending an auction with no bids cancels it and creates no order", async () => {
  const { actions, calls } = fixture({ ...base, buy_now_price: null }, { userId: "seller-1" });
  const result = await actions.endAuctionNow("l1");
  assert.equal(result.outcome, "cancelled");
  assert.equal(calls.updates[0].fields.status, "cancelled");
  assert.equal(calls.orders.length, 0);
});

test("ending an auction with bids sells to the top bidder at their bid", async () => {
  const listing = { ...base, buy_now_price: null, current_price: 1500 };
  const { actions, calls } = fixture(listing, { userId: "seller-1", topBidder: "bidder-9", topAmount: 1500 });
  const result = await actions.endAuctionNow("l1");
  assert.equal(result.outcome, "sold");
  assert.equal(calls.updates[0].fields.status, "sold");
  assert.equal(calls.updates[0].filters.current_price, 1500);
  assert.equal(calls.orders[0].buyer_id, "bidder-9");
  assert.equal(calls.orders[0].seller_id, "seller-1");
  assert.equal(calls.orders[0].amount, 1500);
  assert.equal(calls.notified.length, 1);
  assert.equal(calls.notified[0].userId, "bidder-9");
  assert.equal(calls.notified[0].type, "auction_won");
  assert.equal(calls.notifiedWatchers.length, 1);
  assert.deepEqual(Array.from(calls.notifiedWatchers[0].exclude), ["bidder-9"]);
});

test("ending an auction early with no bids notifies watchers it was cancelled", async () => {
  const listing = { ...base, buy_now_price: null, current_price: 1000 };
  const { actions, calls } = fixture(listing, { userId: "seller-1" });
  const result = await actions.endAuctionNow("l1");
  assert.equal(result.outcome, "cancelled");
  assert.equal(calls.notified.length, 0);
  assert.equal(calls.notifiedWatchers.length, 1);
  assert.equal(calls.notifiedWatchers[0].type, "auction_ended");
});

test("ending early loses cleanly to a bid that lands first, and reopens if the order fails", async () => {
  const raced = fixture({ ...base, buy_now_price: null }, { userId: "seller-1", claimRows: [] });
  assert.ok((await raced.actions.endAuctionNow("l1")).error);
  assert.equal(raced.calls.orders.length, 0);

  const failed = fixture({ ...base, buy_now_price: null }, { userId: "seller-1", topBidder: "bidder-9", orderError: { message: "x" } });
  assert.ok((await failed.actions.endAuctionNow("l1")).error);
  assert.equal(failed.calls.updates.at(-1).fields.status, "active");
});

test("Thai date/time formatting is fixed to UTC+7 regardless of the viewer's timezone", () => {
  const format = load("src/lib/format.ts");
  assert.equal(format.formatThaiDateTime("2026-10-03T04:00:00.000Z"), "3 ต.ค. 11.00 น.");
  assert.equal(format.formatThaiDateTime("2026-10-03T18:30:00.000Z", { year: true }), "4 ต.ค. 2569 01.30 น.");
});

test("a higher bid that loses the race for the price is retried against the new price, not refused", async () => {
  const { actions, calls } = fixture({ ...base, buy_now_price: null }, { claimSeq: [[], [{ id: "l1" }]] });
  const result = await actions.placeBid("l1", 1200);
  assert.equal(result.success, true);
  assert.equal(calls.updates.length, 2);
  assert.equal(calls.bids.length, 1);
});

test("a bid that keeps losing the race gives up after a few tries and records nothing", async () => {
  const { actions, calls } = fixture({ ...base, buy_now_price: null }, { claimSeq: [[], [], [], []] });
  const result = await actions.placeBid("l1", 1200);
  assert.ok(result.error);
  assert.equal(calls.updates.length, 3);
  assert.equal(calls.bids.length, 0);
});

test("ending early refuses to act on a bid that is mid-landing (price and bid list disagree)", async () => {
  // Price already raised to 1500 but the new bid isn't saved yet: top bid is still 1000.
  const stale = fixture({ ...base, buy_now_price: null, current_price: 1500 }, { userId: "seller-1", topBidder: "bidder-9", topAmount: 1000 });
  assert.ok((await stale.actions.endAuctionNow("l1")).error);
  assert.equal(stale.calls.updates.length, 0);
  assert.equal(stale.calls.orders.length, 0);

  // Price raised past the start but no bid visible yet: must not be cancelled.
  const first = fixture({ ...base, buy_now_price: null, current_price: 1100 }, { userId: "seller-1" });
  assert.ok((await first.actions.endAuctionNow("l1")).error);
  assert.equal(first.calls.updates.length, 0);
});
