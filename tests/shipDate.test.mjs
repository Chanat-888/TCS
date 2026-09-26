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
    Number,
    Promise,
    String,
    Math,
    require(name) {
      if (!(name in dependencies)) throw new Error("Unexpected dependency: " + name);
      return dependencies[name];
    },
  }, { filename: path });
  return exports;
}

const rules = load("src/lib/shipDate.ts");
const format = load("src/lib/format.ts");

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const inFuture = (ms) => new Date(Date.now() + ms).toISOString();

test("a ship date needs a reason and must be 1 hour to 14 days ahead", () => {
  const now = Date.now();
  const ok = rules.checkShipDateProposal(new Date(now + 3 * DAY).toISOString(), "ต้องรอของเข้า", now);
  assert.equal(ok.ok, true);
  assert.equal(rules.checkShipDateProposal(new Date(now + 3 * DAY).toISOString(), "สั้น", now).ok, false);
  assert.equal(rules.checkShipDateProposal(new Date(now + 3 * DAY).toISOString(), "   ", now).ok, false);
  assert.equal(rules.checkShipDateProposal(new Date(now - HOUR).toISOString(), "เหตุผลพอสมควร", now).ok, false);
  assert.equal(rules.checkShipDateProposal(new Date(now + 10 * 60 * 1000).toISOString(), "เหตุผลพอสมควร", now).ok, false);
  assert.equal(rules.checkShipDateProposal(new Date(now + 15 * DAY).toISOString(), "เหตุผลพอสมควร", now).ok, false);
  assert.equal(rules.checkShipDateProposal("not a date", "เหตุผลพอสมควร", now).ok, false);
  assert.equal(rules.checkShipDateProposal(undefined, "เหตุผลพอสมควร", now).ok, false);
});

test("a cancellation request needs a reason too", () => {
  assert.equal(rules.checkCancelProposal("ผู้ขายหาการ์ดไม่เจอ").ok, true);
  assert.equal(rules.checkCancelProposal("ไม่").ok, false);
  assert.equal(rules.checkCancelProposal(null).ok, false);
});

// ---------- server actions ----------
function setup({ userId, order, proposal = null, claim = {}, insertError = null } = {}) {
  const calls = { inserts: [], updates: [] };
  const db = {
    from(table) {
      const filters = {};
      let mode = "select";
      let values = null;
      const chain = {
        select() { return chain; },
        insert(v) {
          mode = "insert"; values = v;
          calls.inserts.push({ table, values });
          return Promise.resolve({ error: table === "order_ship_proposals" ? insertError : null });
        },
        update(v) { mode = "update"; values = v; return chain; },
        eq(col, val) { filters[col] = val; return chain; },
        order() { return chain; },
        limit() { return chain; },
        maybeSingle: async () => ({ data: table === "orders" ? order : table === "order_ship_proposals" ? proposal : null }),
        then(resolve) {
          if (mode === "update") calls.updates.push({ table, values, filters });
          resolve({ data: claim[table] ?? [{ id: "row" }], error: null });
        },
      };
      return chain;
    },
  };
  const actions = load("src/app/orders/[id]/shipDate/actions.ts", {
    "next/cache": { revalidatePath() {} },
    "@/lib/supabase/server": { createServiceClient: () => db },
    "@/lib/session": { requireVerifiedUserId: async () => userId },
    "@/lib/format": format,
    "@/lib/shipDate": rules,
  });
  return { actions, calls };
}

const PAID = { id: "o", buyer_id: "buyer", seller_id: "seller", status: "PAID_HELD", ship_by_at: null };
const REASON = "ต้องรอของเข้าร้านก่อน";
const PENDING = (over = {}) => ({
  id: "p", order_id: "o", proposed_by: "seller", kind: "ship_date",
  proposed_date: inFuture(3 * DAY), reason: REASON, status: "pending", ...over,
});

test("either party can propose a ship date before shipping; it is recorded and echoed to the chat", async () => {
  for (const userId of ["seller", "buyer"]) {
    const { actions, calls } = setup({ userId, order: PAID });
    const result = await actions.proposeShipDate("o", inFuture(3 * DAY), REASON);
    assert.equal(result.success, true, userId);
    const row = calls.inserts.find((i) => i.table === "order_ship_proposals").values;
    assert.equal(row.proposed_by, userId);
    assert.equal(row.kind, "ship_date");
    assert.equal(row.reason, REASON);
    const chat = calls.inserts.find((i) => i.table === "messages").values;
    assert.match(chat.body, /^\[ระบบ\]/);
    assert.ok(chat.body.includes(REASON));
  }
});

test("strangers cannot propose, and nothing can be proposed once the order has shipped", async () => {
  const stranger = setup({ userId: "someone-else", order: PAID });
  assert.ok((await stranger.actions.proposeShipDate("o", inFuture(3 * DAY), REASON)).error);
  assert.equal(stranger.calls.inserts.length, 0);

  const shipped = setup({ userId: "seller", order: { ...PAID, status: "SHIPPED" } });
  assert.ok((await shipped.actions.proposeShipDate("o", inFuture(3 * DAY), REASON)).error);
  assert.ok((await shipped.actions.proposeCancel("o", REASON)).error);
  assert.equal(shipped.calls.inserts.length, 0);
});

test("a bad date or missing reason is rejected before anything is stored", async () => {
  const { actions, calls } = setup({ userId: "seller", order: PAID });
  assert.ok((await actions.proposeShipDate("o", inFuture(30 * DAY), REASON)).error);
  assert.ok((await actions.proposeShipDate("o", inFuture(3 * DAY), "")).error);
  assert.ok((await actions.proposeCancel("o", "")).error);
  assert.equal(calls.inserts.length, 0);
});

test("only one proposal can be open at a time", async () => {
  const { actions } = setup({ userId: "seller", order: PAID, insertError: { code: "23505" } });
  const result = await actions.proposeShipDate("o", inFuture(3 * DAY), REASON);
  assert.match(result.error, /รอคำตอบอยู่แล้ว/);
});

test("the other party accepting a date sets the agreed ship date, guarded on the order still being paid", async () => {
  const { actions, calls } = setup({ userId: "buyer", order: PAID, proposal: PENDING() });
  const result = await actions.respondToProposal("p", true);
  assert.equal(result.success, true);
  const [answer, apply] = calls.updates;
  assert.equal(answer.values.status, "accepted");
  assert.equal(answer.filters.status, "pending");
  assert.ok(apply.values.ship_by_at);
  assert.equal(apply.filters.status, "PAID_HELD");
});

test("declining records the answer and leaves the order untouched", async () => {
  const { actions, calls } = setup({ userId: "buyer", order: PAID, proposal: PENDING() });
  const result = await actions.respondToProposal("p", false, "ไม่สะดวกวันนั้น");
  assert.equal(result.success, true);
  assert.equal(calls.updates.length, 1);
  assert.equal(calls.updates[0].values.status, "declined");
  assert.equal(calls.updates[0].values.response_note, "ไม่สะดวกวันนั้น");
  assert.equal(calls.updates.filter((u) => u.table === "orders").length, 0);
});

test("you cannot answer your own proposal, and strangers cannot answer at all", async () => {
  const own = setup({ userId: "seller", order: PAID, proposal: PENDING() });
  assert.ok((await own.actions.respondToProposal("p", true)).error);
  assert.equal(own.calls.updates.length, 0);

  const stranger = setup({ userId: "someone-else", order: PAID, proposal: PENDING() });
  assert.ok((await stranger.actions.respondToProposal("p", true)).error);
  assert.equal(stranger.calls.updates.length, 0);
});

test("accepting a cancellation cancels the order (from PAID_HELD only)", async () => {
  const { actions, calls } = setup({
    userId: "seller", order: PAID, proposal: PENDING({ proposed_by: "buyer", kind: "cancel", proposed_date: null }),
  });
  const result = await actions.respondToProposal("p", true);
  assert.equal(result.cancelled, true);
  const apply = calls.updates.find((u) => u.table === "orders");
  assert.equal(apply.values.status, "CANCELLED");
  assert.ok(apply.values.cancelled_at);
  assert.equal(apply.filters.status, "PAID_HELD");
});

test("a proposal already answered, or an order that moved on, changes nothing", async () => {
  // Already answered (double click / withdrawn at the same moment): the guarded claim matches nothing.
  const answered = setup({ userId: "buyer", order: PAID, proposal: PENDING(), claim: { order_ship_proposals: [] } });
  assert.ok((await answered.actions.respondToProposal("p", true)).error);
  assert.equal(answered.calls.updates.filter((u) => u.table === "orders").length, 0);

  const settled = setup({ userId: "buyer", order: PAID, proposal: PENDING({ status: "accepted" }) });
  assert.ok((await settled.actions.respondToProposal("p", true)).error);
  assert.equal(settled.calls.updates.length, 0);

  // The order shipped in the meantime: the proposal goes back to pending, not silently accepted.
  const moved = setup({ userId: "buyer", order: PAID, proposal: PENDING(), claim: { orders: [] } });
  assert.ok((await moved.actions.respondToProposal("p", true)).error);
  const revert = moved.calls.updates.at(-1);
  assert.equal(revert.table, "order_ship_proposals");
  assert.equal(revert.values.status, "pending");
});

test("only the proposer can withdraw, and only while it is still open", async () => {
  const mine = setup({ userId: "seller", order: PAID, proposal: PENDING() });
  assert.equal((await mine.actions.withdrawProposal("p")).success, true);
  assert.equal(mine.calls.updates[0].values.status, "withdrawn");
  assert.equal(mine.calls.updates[0].filters.status, "pending");

  const theirs = setup({ userId: "buyer", order: PAID, proposal: PENDING() });
  assert.ok((await theirs.actions.withdrawProposal("p")).error);
  assert.equal(theirs.calls.updates.length, 0);

  const late = setup({ userId: "seller", order: PAID, proposal: PENDING(), claim: { order_ship_proposals: [] } });
  assert.ok((await late.actions.withdrawProposal("p")).error);
});
