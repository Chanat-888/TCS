import assert from "node:assert/strict";
import crypto from "node:crypto";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(path, dependencies = {}, extra = {}) {
  const code = ts.transpileModule(readFileSync(new URL("../" + path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    Date,
    Math,
    String,
    Promise,
    Object,
    Array,
    Buffer,
    require(name) {
      if (!(name in dependencies)) throw new Error("Unexpected dependency: " + name);
      return dependencies[name];
    },
    ...extra,
  }, { filename: path });
  return exports;
}

const orderCreate = load("src/lib/orderCreate.ts");
const timers = load("src/lib/orderTimers.ts", { "@/lib/orderCreate": orderCreate });
const plain = (x) => JSON.parse(JSON.stringify(x));

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = Date.parse("2026-10-01T12:00:00.000Z");
const ago = (ms) => new Date(NOW - ms).toISOString();

// A Supabase stand-in that records every read filter and every guarded update.
function makeDb({ reads = () => [], claim = () => [{ id: "row" }], top = null, orderError = null, throwOn = null } = {}) {
  const calls = { updates: [], inserts: [], reads: [] };
  return {
    calls,
    client: {
      from(table) {
        if (throwOn === table) throw new Error("boom");
        const filters = {};
        let mode = "select";
        let values = null;
        const chain = {
          select() { return chain; },
          eq(col, v) { filters[col] = ["eq", v]; return chain; },
          lte(col, v) { filters[col] = ["lte", v]; return chain; },
          is(col, v) { filters[col] = ["is", v]; return chain; },
          in(col, v) { filters[col] = ["in", v]; return chain; },
          not(col, op, v) { filters[col] = ["not", op, v]; return chain; },
          order() { return chain; },
          limit() { return chain; },
          update(v) { mode = "update"; values = v; return chain; },
          insert(v) {
            calls.inserts.push({ table, values: v });
            const p = {
              select() { return p; },
              single: async () => ({ data: orderError ? null : { id: "new-order" }, error: orderError }),
              then(resolve) { resolve({ error: null }); },
            };
            return p;
          },
          maybeSingle: async () => ({ data: table === "bids" ? top : null, error: null }),
          then(resolve) {
            if (mode === "update") {
              calls.updates.push({ table, values, filters });
              resolve({ data: claim(table, values, filters), error: null });
            } else {
              calls.reads.push({ table, filters });
              const data = reads(table, filters);
              resolve(data === "ERROR" ? { data: null, error: { message: "x" } } : { data, error: null });
            }
          },
        };
        return chain;
      },
    },
  };
}

const chats = (calls) => calls.inserts.filter((i) => i.table === "messages").map((i) => i.values.body);

// ---------- auctions ending ----------
const ENDED = { id: "l1", seller_id: "seller", status: "active", start_price: 1000, current_price: 1500 };

test("an ended auction is sold to the top bidder with a pending-payment order", async () => {
  const { client, calls } = makeDb({ reads: () => [ENDED], top: { bidder_id: "bidder", amount: 1500 } });
  const result = await timers.closeEndedListings(client, NOW);
  assert.equal(result.processed, 1);
  const claim = calls.updates[0];
  assert.equal(claim.values.status, "sold");
  assert.equal(claim.filters.status[1], "active");
  assert.equal(claim.filters.current_price[1], 1500);
  assert.equal(claim.filters.ends_at[0], "lte");
  const order = calls.inserts.find((i) => i.table === "orders").values;
  assert.equal(order.buyer_id, "bidder");
  assert.equal(order.seller_id, "seller");
  assert.equal(order.amount, 1500);
  assert.equal(order.status, "PENDING_PAYMENT");
});

test("an ended auction with no bids simply expires", async () => {
  const { client, calls } = makeDb({ reads: () => [{ ...ENDED, current_price: 1000 }], top: null });
  assert.equal((await timers.closeEndedListings(client, NOW)).processed, 1);
  assert.equal(calls.updates[0].values.status, "expired");
  assert.equal(calls.inserts.length, 0);
});

test("a bid that is mid-landing (price and bid list disagree) is left for the next run", async () => {
  const stale = makeDb({ reads: () => [ENDED], top: { bidder_id: "bidder", amount: 1000 } });
  assert.equal((await timers.closeEndedListings(stale.client, NOW)).processed, 0);
  assert.equal(stale.calls.updates.length, 0);

  const first = makeDb({ reads: () => [{ ...ENDED, current_price: 1100 }], top: null });
  assert.equal((await timers.closeEndedListings(first.client, NOW)).processed, 0);
  assert.equal(first.calls.updates.length, 0);
});

test("losing the claim to a simultaneous bid creates no order; a failed order reopens the listing", async () => {
  const raced = makeDb({ reads: () => [ENDED], top: { bidder_id: "b", amount: 1500 }, claim: () => [] });
  assert.equal((await timers.closeEndedListings(raced.client, NOW)).processed, 0);
  assert.equal(raced.calls.inserts.length, 0);

  const failed = makeDb({ reads: () => [ENDED], top: { bidder_id: "b", amount: 1500 }, orderError: { message: "x" } });
  assert.equal((await timers.closeEndedListings(failed.client, NOW)).processed, 0);
  assert.equal(failed.calls.updates.at(-1).values.status, "active");
});

// ---------- unpaid orders ----------
test("orders unpaid past their deadline are cancelled, only from PENDING_PAYMENT", async () => {
  const { client, calls } = makeDb({ reads: () => [{ id: "o1" }, { id: "o2" }] });
  assert.equal((await timers.cancelUnpaidOrders(client, NOW)).processed, 2);
  assert.equal(calls.reads[0].filters.status[1], "PENDING_PAYMENT");
  assert.equal(calls.reads[0].filters.payment_deadline_at[1], new Date(NOW).toISOString());
  for (const u of calls.updates) {
    assert.equal(u.values.status, "CANCELLED");
    assert.equal(u.filters.status[1], "PENDING_PAYMENT");
  }
  const raced = makeDb({ reads: () => [{ id: "o1" }], claim: () => [] });
  assert.equal((await timers.cancelUnpaidOrders(raced.client, NOW)).processed, 0);
});

// ---------- late shipments ----------
test("a missed agreed ship date (+24h grace) or 3 days with no agreement cancels the order", async () => {
  // The agreed query filters ship_by_at with lte; the unagreed one with `is null`.
  const reads = (t, f) => (t !== "orders" ? [] : f.ship_by_at[0] === "lte" ? [{ id: "agreed", seller_id: "s" }] : [{ id: "unagreed", seller_id: "s" }]);
  const { client, calls } = makeDb({ reads });
  const result = await timers.cancelLateShipments(client, NOW);
  assert.equal(result.processed, 2);

  const agreed = calls.reads.find((r) => r.table === "orders" && r.filters.ship_by_at[0] === "lte");
  const unagreed = calls.reads.find((r) => r.table === "orders" && r.filters.ship_by_at[0] === "is");
  assert.equal(agreed.filters.ship_by_at[1], ago(24 * HOUR));
  assert.equal(unagreed.filters.paid_at[1], ago(3 * DAY));
  for (const u of calls.updates) {
    assert.equal(u.values.status, "CANCELLED");
    assert.equal(u.filters.status[1], "PAID_HELD");
  }
  assert.equal(chats(calls).length, 2);
  assert.ok(chats(calls).every((c) => c.startsWith("[ระบบ]")));
});

test("if the ship-date columns are missing (migration not run) nothing is cancelled", async () => {
  const { client, calls } = makeDb({ reads: () => "ERROR" });
  const result = await timers.cancelLateShipments(client, NOW);
  assert.equal(result.processed, 0);
  assert.ok(result.error);
  assert.equal(calls.updates.length, 0);
});

test("a shipment that happened at the last moment is not cancelled", async () => {
  const reads = (t) => (t === "orders" ? [{ id: "o", seller_id: "s" }] : []);
  const { client, calls } = makeDb({ reads, claim: () => [] });
  assert.equal((await timers.cancelLateShipments(client, NOW)).processed, 0);
  assert.equal(chats(calls).length, 0);
});

test("an order with an open ship-date question is not cancelled for lateness while it is being renegotiated", async () => {
  // Two overdue orders; the buyer asked to postpone on one and the seller has not answered yet.
  const reads = (t, f) => {
    if (t === "order_ship_proposals") return [{ order_id: "negotiating" }];
    return f.ship_by_at[0] === "lte" ? [{ id: "negotiating", seller_id: "s" }, { id: "plain", seller_id: "s" }] : [];
  };
  const { client, calls } = makeDb({ reads });
  const result = await timers.cancelLateShipments(client, NOW);
  assert.equal(result.processed, 1);
  assert.deepEqual(plain(calls.updates.map((u) => u.filters.id[1])), ["plain"]);
  const question = calls.reads.find((r) => r.table === "order_ship_proposals");
  assert.equal(question.filters.status[1], "pending");
});

// ---------- unanswered proposals ----------
test("an unanswered ship-date proposal is auto-accepted after 48h and applied to the order", async () => {
  const proposal = { id: "p", order_id: "o", proposed_by: "seller", kind: "ship_date", proposed_date: "2026-10-05T11:00:00.000Z" };
  const { client, calls } = makeDb({ reads: () => [proposal] });
  assert.equal((await timers.resolveStaleProposals(client, NOW)).processed, 1);
  assert.equal(calls.reads[0].filters.created_at[1], ago(48 * HOUR));
  assert.equal(calls.updates[0].values.status, "accepted");
  assert.equal(calls.updates[0].filters.status[1], "pending");
  const apply = calls.updates.find((u) => u.table === "orders");
  assert.equal(apply.values.ship_by_at, proposal.proposed_date);
  assert.equal(apply.filters.status[1], "PAID_HELD");
});

test("silence never cancels an order: an unanswered cancellation request just lapses", async () => {
  const proposal = { id: "p", order_id: "o", proposed_by: "buyer", kind: "cancel", proposed_date: null };
  const { client, calls } = makeDb({ reads: () => [proposal] });
  assert.equal((await timers.resolveStaleProposals(client, NOW)).processed, 1);
  assert.equal(calls.updates[0].values.status, "withdrawn");
  assert.equal(calls.updates.filter((u) => u.table === "orders").length, 0);
});

test("a proposal for an order that already moved on is retired, not applied", async () => {
  const proposal = { id: "p", order_id: "o", proposed_by: "seller", kind: "ship_date", proposed_date: "2026-10-05T11:00:00.000Z" };
  const { client, calls } = makeDb({ reads: () => [proposal], claim: (table) => (table === "orders" ? [] : [{ id: "row" }]) });
  await timers.resolveStaleProposals(client, NOW);
  assert.equal(calls.updates.at(-1).table, "order_ship_proposals");
  assert.equal(calls.updates.at(-1).values.status, "withdrawn");
});

// ---------- auto-complete ----------
test("a delivered order completes when its 48h auto-approve time passes", async () => {
  const reads = (_t, f) => (f.status[1] === "DELIVERED" ? [{ id: "d", seller_id: "s" }] : []);
  const { client, calls } = makeDb({ reads });
  assert.equal((await timers.autoCompleteOrders(client, NOW)).processed, 1);
  const read = calls.reads.find((r) => r.filters.status[1] === "DELIVERED");
  assert.equal(read.filters.auto_approve_at[1], ago(0));
  assert.equal(calls.updates[0].values.status, "COMPLETED");
  assert.equal(calls.updates[0].filters.status[1], "DELIVERED");
});

test("a shipped order the buyer never confirms completes 2 days after the expected delivery (meet-ups after 2 days)", async () => {
  const shipped = [
    { id: "parcel-early", seller_id: "s", delivery_method: "ship", shipped_at: ago(4 * DAY) },
    { id: "parcel-due", seller_id: "s", delivery_method: "ship", shipped_at: ago(8 * DAY) },
    { id: "meetup-due", seller_id: "s", delivery_method: "meetup", shipped_at: ago(3 * DAY) },
  ];
  const reads = (_t, f) => (f.status[1] === "SHIPPED" ? shipped : []);
  const { client, calls } = makeDb({ reads });
  const result = await timers.autoCompleteOrders(client, NOW);
  assert.equal(result.processed, 2);
  const completed = calls.updates.map((u) => u.filters.id[1]);
  assert.deepEqual(plain(completed), ["parcel-due", "meetup-due"]);
  for (const u of calls.updates) {
    assert.equal(u.filters.status[1], "SHIPPED");
    assert.equal(u.filters.unboxing_video_url[0], "is");
  }
});

test("auto-complete never touches a disputed order (its update is guarded on the exact status)", async () => {
  const reads = (_t, f) => (f.status[1] === "DELIVERED" ? [{ id: "d", seller_id: "s" }] : []);
  const { client, calls } = makeDb({ reads, claim: () => [] });
  assert.equal((await timers.autoCompleteOrders(client, NOW)).processed, 0);
  assert.equal(chats(calls).length, 0);
});

// ---------- running everything ----------
test("one failing step never stops the others", async () => {
  const { client } = makeDb({ reads: () => [], throwOn: "listings" });
  const results = await timers.runAllTimers(client, NOW);
  assert.ok(results.closeEndedListings.error);
  for (const step of ["cancelUnpaidOrders", "cancelLateShipments", "resolveStaleProposals", "autoCompleteOrders"]) {
    assert.equal(results[step].error, undefined, step);
  }
});

// ---------- the endpoint ----------
function route(secret, ran = []) {
  return load(
    "src/app/api/cron/timers/route.ts",
    {
      "node:crypto": crypto,
      "next/server": { NextResponse: Response },
      "@/lib/supabase/server": { createServiceClient: () => ({}) },
      "@/lib/orderTimers": { runAllTimers: async () => { ran.push(1); return { closeEndedListings: { processed: 0 } }; } },
    },
    { process: { env: { CRON_SECRET: secret } } }
  );
}
const call = (r, header) =>
  r.POST(new Request("https://tcs.test/api/cron/timers", { method: "POST", headers: header ? { authorization: header } : {} }));

test("the timers endpoint is closed without a configured secret and rejects a wrong one", async () => {
  const ran = [];
  assert.equal((await call(route(undefined, ran), "Bearer x")).status, 503);
  assert.equal((await call(route("s3cret", ran))).status, 401);
  assert.equal((await call(route("s3cret", ran), "Bearer wrong")).status, 401);
  assert.equal((await call(route("s3cret", ran), "s3cret")).status, 401);
  assert.equal(ran.length, 0);
});

test("with the right secret the endpoint runs every timer step", async () => {
  const ran = [];
  const res = await call(route("s3cret", ran), "Bearer s3cret");
  assert.equal(res.status, 200);
  assert.equal((await res.json()).ok, true);
  assert.equal(ran.length, 1);
});
