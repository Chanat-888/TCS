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
    require(name) {
      if (!(name in dependencies)) throw new Error("Unexpected dependency: " + name);
      return dependencies[name];
    },
  }, { filename: path });
  return exports;
}

function fixture(order, { insertError = null, updateError = null, userId = "buyer-1" } = {}) {
  const calls = { inserted: [], updated: [], revalidated: [] };
  const actions = load("src/app/orders/[id]/dispute/actions.ts", {
    "next/cache": { revalidatePath: (path) => calls.revalidated.push(path) },
    "@/lib/session": { requireVerifiedUserId: async () => userId },
    "@/lib/supabase/server": {
      createServiceClient: () => ({
        from: (table) => {
          if (table === "orders") {
            return {
              select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: order }) }) }),
              update: (fields) => {
                const entry = { fields, filters: {}, statuses: undefined };
                calls.updated.push(entry);
                const chain = {
                  eq(col, val) { entry.filters[col] = val; return chain; },
                  in(col, statuses) { entry.statuses = statuses; return chain; },
                  select() { return Promise.resolve({ data: updateError ? null : [{ id: "o1" }], error: updateError }); },
                  then(resolve) { resolve({ error: null }); },
                };
                return chain;
              },
            };
          }
          if (table === "disputes") {
            return { insert: (row) => { calls.inserted.push(row); return Promise.resolve({ error: insertError }); } };
          }
          throw new Error("Unexpected table: " + table);
        },
      }),
    },
  });
  return { actions, calls };
}

const VALID_DESCRIPTION = "นัดที่สถานีรถไฟฟ้าตอน 18:00 แต่ผู้ขายไม่มาและติดต่อไม่ได้เลย";

test("a meetup order stuck at PAID_HELD or SHIPPED can be reported and moves straight to DISPUTED", async () => {
  for (const status of ["PAID_HELD", "SHIPPED"]) {
    const order = { id: "o1", buyer_id: "buyer-1", delivery_method: "meetup", unboxing_video_url: null, status };
    const { actions, calls } = fixture(order);
    const result = await actions.reportMeetupNoShow("o1", VALID_DESCRIPTION);
    assert.equal(result.success, true, status);
    assert.equal(calls.inserted[0].reason, "not_received");
    assert.equal(calls.inserted[0].order_id, "o1");
    assert.equal(calls.inserted[0].opened_by, "buyer-1");
    assert.equal(calls.updated[0].fields.status, "DISPUTED");
    assert.deepEqual(JSON.parse(JSON.stringify(calls.updated[0].statuses)), ["PAID_HELD", "SHIPPED"]);
    assert.ok(calls.revalidated.includes("/orders/o1"));
    assert.ok(calls.revalidated.includes("/orders/o1/seller"));
  }
});

test("a description under 10 characters is rejected before touching the database", async () => {
  const order = { id: "o1", buyer_id: "buyer-1", delivery_method: "meetup", unboxing_video_url: null, status: "SHIPPED" };
  const { actions, calls } = fixture(order);
  for (const description of ["", "  ", "too short"]) {
    const result = await actions.reportMeetupNoShow("o1", description);
    assert.ok(result.error);
  }
  assert.equal(calls.inserted.length, 0);
});

test("someone else's order cannot be reported", async () => {
  const order = { id: "o1", buyer_id: "someone-else", delivery_method: "meetup", unboxing_video_url: null, status: "SHIPPED" };
  const { actions, calls } = fixture(order);
  const result = await actions.reportMeetupNoShow("o1", VALID_DESCRIPTION);
  assert.ok(result.error);
  assert.equal(calls.inserted.length, 0);
});

test("shipped (non-meetup) orders must use the normal dispute flow instead", async () => {
  const order = { id: "o1", buyer_id: "buyer-1", delivery_method: "ship", unboxing_video_url: null, status: "SHIPPED" };
  const { actions, calls } = fixture(order);
  const result = await actions.reportMeetupNoShow("o1", VALID_DESCRIPTION);
  assert.ok(result.error);
  assert.equal(calls.inserted.length, 0);
});

test("a meetup order that already has an unboxing video must use the normal dispute flow instead", async () => {
  const order = { id: "o1", buyer_id: "buyer-1", delivery_method: "meetup", unboxing_video_url: "https://example.test/v.mp4", status: "SHIPPED" };
  const { actions, calls } = fixture(order);
  const result = await actions.reportMeetupNoShow("o1", VALID_DESCRIPTION);
  assert.ok(result.error);
  assert.equal(calls.inserted.length, 0);
});

test("orders already completed, disputed, or delivered cannot be reported this way", async () => {
  for (const status of ["DELIVERED", "COMPLETED", "DISPUTED", "CANCELLED", "REFUNDED"]) {
    const order = { id: "o1", buyer_id: "buyer-1", delivery_method: "meetup", unboxing_video_url: null, status };
    const { actions, calls } = fixture(order);
    const result = await actions.reportMeetupNoShow("o1", VALID_DESCRIPTION);
    assert.ok(result.error, status);
    assert.equal(calls.inserted.length, 0, status);
  }
});

test("a failed dispute insert is reported and the order is put back where it was", async () => {
  const order = { id: "o1", buyer_id: "buyer-1", delivery_method: "meetup", unboxing_video_url: null, status: "SHIPPED" };
  const { actions, calls } = fixture(order, { insertError: { message: "boom" } });
  const result = await actions.reportMeetupNoShow("o1", VALID_DESCRIPTION);
  assert.ok(result.error);
  assert.equal(calls.updated.length, 2);
  assert.equal(calls.updated[0].fields.status, "DISPUTED");
  assert.equal(calls.updated[1].fields.status, "SHIPPED");
});

test("a failed order-status update is reported, not claimed as success, and records no dispute", async () => {
  const order = { id: "o1", buyer_id: "buyer-1", delivery_method: "meetup", unboxing_video_url: null, status: "SHIPPED" };
  const { actions, calls } = fixture(order, { updateError: { message: "boom" } });
  const result = await actions.reportMeetupNoShow("o1", VALID_DESCRIPTION);
  assert.ok(result.error);
  assert.equal(result.success, undefined);
  assert.equal(calls.inserted.length, 0);
  assert.equal(calls.revalidated.length, 0);
});
