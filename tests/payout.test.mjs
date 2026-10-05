import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

function compile(path, deps = {}) {
  const code = ts.transpileModule(readFileSync(new URL("../" + path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function("exports", "require", "console", "Date", "URLSearchParams", "String", "Math", code)(
    mod.exports, (name) => deps[name], { error() {} }, Date, URLSearchParams, String, Math,
  );
  return mod.exports;
}
const commission = compile("src/lib/commission.ts");
function load(omise) {
  return { ...compile("src/lib/payout.ts", { "@/lib/omise": { omise }, "@/lib/commission": commission }), ...commission };
}

// Chainable stand-in for the Supabase client. Awaiting an update (without .select) records it.
function fakeDb({ orders, account, claimed = [{ id: "o1" }] }) {
  const updates = [];
  const db = {
    from(table) {
      let patch = null;
      const q = {
        update(p) { patch = p; return q; },
        select() {
          if (patch) { updates.push({ table, patch }); return Promise.resolve({ data: claimed, error: null }); }
          return q;
        },
        or: () => q,
        limit: async () => ({ data: orders, error: null }),
        maybeSingle: async () => ({ data: account, error: null }),
        then(resolve) { if (patch) updates.push({ table, patch }); resolve({ error: null }); },
      };
      for (const m of ["eq", "is"]) q[m] = () => q;
      return q;
    },
  };
  return { db, updates };
}

const order = { id: "o1", seller_id: "s1", amount: 1000, payout_status: "pending", payout_attempted_at: null };

test("9% commission is cut and rounded to whole baht", () => {
  const { splitPayout } = load(async () => ({}));
  assert.deepEqual({ ...splitPayout(1000) }, { commission: 90, payout: 910 });
  assert.deepEqual({ ...splitPayout(999) }, { commission: 90, payout: 909 });
});

test("pays the seller the net amount in satang with a per-order idempotency key", async () => {
  const calls = [];
  const { payOutOrders } = load(async (path, body, headers) => { calls.push({ path, body: body.toString(), headers }); return { id: "trsf_1" }; });
  const { db, updates } = fakeDb({ orders: [order], account: { omise_recipient_id: "recp_1" } });
  const result = await payOutOrders(db, Date.now());
  assert.equal(result.processed, 1);
  assert.equal(calls[0].path, "/transfers");
  assert.equal(calls[0].body, "amount=91000&recipient=recp_1");
  assert.equal(calls[0].headers["Idempotency-Key"], "payout-o1");
  assert.equal(updates.at(-1).patch.payout_status, "sent");
  assert.equal(updates.at(-1).patch.omise_transfer_id, "trsf_1");
});

test("a seller with no bank account is skipped and nothing is sent", async () => {
  let called = false;
  const { payOutOrders } = load(async () => { called = true; return {}; });
  const { db, updates } = fakeDb({ orders: [order], account: null });
  assert.equal((await payOutOrders(db, Date.now())).processed, 0);
  assert.equal(called, false);
  assert.equal(updates.length, 0);
});

test("an order another run already claimed is not paid twice", async () => {
  let called = false;
  const { payOutOrders } = load(async () => { called = true; return {}; });
  const { db } = fakeDb({ orders: [order], account: { omise_recipient_id: "recp_1" }, claimed: [] });
  assert.equal((await payOutOrders(db, Date.now())).processed, 0);
  assert.equal(called, false);
});

test("a failed transfer goes back to pending with the reason, to be retried", async () => {
  const { payOutOrders } = load(async () => { throw new Error("omise insufficient_balance"); });
  const { db, updates } = fakeDb({ orders: [order], account: { omise_recipient_id: "recp_1" } });
  assert.equal((await payOutOrders(db, Date.now())).processed, 0);
  assert.deepEqual({ ...updates.at(-1).patch }, { payout_status: "pending", payout_error: "omise insufficient_balance" });
});

test("a transfer response carrying a failure code is treated as failed", async () => {
  const { payOutOrders } = load(async () => ({ id: "trsf_2", failure_code: "invalid_recipient" }));
  const { db, updates } = fakeDb({ orders: [order], account: { omise_recipient_id: "recp_1" } });
  assert.equal((await payOutOrders(db, Date.now())).processed, 0);
  assert.equal(updates.at(-1).patch.payout_status, "pending");
});
