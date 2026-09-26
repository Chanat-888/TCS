import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// syncCharge is the only thing allowed to mark an order PAID_HELD.
function sync(charge) {
  const updates = [];
  const code = ts.transpileModule(readFileSync(new URL("../src/lib/omise.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  const query = (values) => {
    const filters = {};
    const q = { eq(c, v) { filters[c] = v; return q; }, select: async () => { updates.push({ values, filters }); return { data: [{ id: "o1" }], error: null }; } };
    return q;
  };
  vm.runInNewContext(code, {
    exports, Buffer, encodeURIComponent, console: { error() {} }, process: { env: { OMISE_SECRET_KEY: "skey_test_x" } },
    fetch: async (url) => ({ ok: true, json: async () => ({ ...charge, url }) }),
    require: (name) => ({ "server-only": {}, "@/lib/supabase/server": { createServiceClient: () => ({ from: () => ({ update: query }) }) } })[name],
  });
  return exports.syncCharge("chrg_test_1").then((status) => ({ status, updates }));
}

const PAID = { id: "chrg_test_1", status: "successful", amount: 150000, currency: "thb", metadata: { order_id: "o1" } };

test("a successful THB charge marks only that still-unpaid order at that price", async () => {
  const { status, updates } = await sync(PAID);
  assert.equal(status, "successful");
  assert.equal(updates.length, 1);
  assert.equal(updates[0].values.status, "PAID_HELD");
  assert.deepEqual(updates[0].filters, { id: "o1", status: "PENDING_PAYMENT", amount: 1500 });
});
test("pending, failed, foreign-currency or unlinked charges change nothing", async () => {
  for (const charge of [{ ...PAID, status: "pending" }, { ...PAID, status: "failed" }, { ...PAID, currency: "usd" }, { ...PAID, metadata: {} }]) {
    assert.equal((await sync(charge)).updates.length, 0, JSON.stringify(charge));
  }
});
