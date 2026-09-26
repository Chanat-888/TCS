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
  const calls = { updates: [], orders: [], bids: [], bidsDeleted: [] };
  const actions = load("src/app/listings/[id]/actions.ts", {
    "next/cache": { revalidatePath() {} },
    "@/lib/session": { requireVerifiedUserId: async () => userId },
    "@/lib/listingKind": listingKind,
    "@/lib/orderCreate": orderCreate,
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
