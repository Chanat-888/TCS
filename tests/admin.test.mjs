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

function fixture({
  isAdminFlag = false,
  openDisputesCount = 0,
  openOrdersCount = 0,
  activeListingsCount = 0,
  totalUsers = 0,
  disputeRows = [],
  sellers = [],
} = {}) {
  const admin = load("src/lib/admin.ts", {
    "server-only": {},
    "@/lib/format": { maskUserLabel: (id) => `ผู้ใช้ ${id.slice(0, 4)}` },
    "@/lib/supabase/server": {
      createServiceClient: () => ({
        from(table) {
          if (table === "profiles") {
            return {
              select: (columns) => {
                if (columns === "is_admin") return { eq: () => ({ maybeSingle: async () => ({ data: { is_admin: isAdminFlag } }) }) };
                if (columns.includes("display_name")) return { in: async () => ({ data: sellers }) };
                // bare count-all: no further chaining, used directly as a thenable
                return Promise.resolve({ count: totalUsers });
              },
            };
          }
          if (table === "orders") {
            return { select: () => ({ in: async () => ({ count: openOrdersCount }) }) };
          }
          if (table === "listings") {
            return { select: () => ({ eq: async () => ({ count: activeListingsCount }) }) };
          }
          if (table === "disputes") {
            return {
              select: (columns) => {
                if (columns.includes("order:orders")) {
                  return { order: () => ({ order: () => ({ limit: async () => ({ data: disputeRows }) }) }) };
                }
                return { is: async () => ({ count: openDisputesCount }) };
              },
            };
          }
          throw new Error("Unexpected table: " + table);
        },
      }),
    },
  });
  return admin;
}

test("isAdmin reads the database and never trusts a missing or falsy flag", async () => {
  assert.equal(await fixture({ isAdminFlag: true }).isAdmin("u1"), true);
  assert.equal(await fixture({ isAdminFlag: false }).isAdmin("u1"), false);
  assert.equal(await fixture().isAdmin(null), false);
});

test("the overview totals come straight from the counted queries", async () => {
  const admin = fixture({ openDisputesCount: 3, openOrdersCount: 5, activeListingsCount: 8, totalUsers: 42 });
  const overview = await admin.getAdminOverview();
  assert.equal(overview.openDisputesCount, 3);
  assert.equal(overview.openOrdersCount, 5);
  assert.equal(overview.activeListingsCount, 8);
  assert.equal(overview.totalUsers, 42);
});

test("each dispute row is joined with its seller's name and the buyer masked, never a raw id", async () => {
  const admin = fixture({
    disputeRows: [
      { id: "d1", reason: "not_received", decision: null, decided_at: null, created_at: "2026-01-01T00:00:00Z", order: { order_code: "TCS001", amount: 500, buyer_id: "buyer-1234", seller_id: "seller-1" } },
      { id: "d2", reason: "condition", decision: "refund", decided_at: "2026-01-02T00:00:00Z", created_at: "2026-01-01T00:00:00Z", order: { order_code: "TCS002", amount: 900, buyer_id: "buyer-5678", seller_id: "seller-2" } },
    ],
    sellers: [{ id: "seller-1", display_name: "ร้านการ์ดดี" }, { id: "seller-2", display_name: "ร้านของแท้" }],
  });
  const overview = await admin.getAdminOverview();
  assert.equal(overview.disputes.length, 2);
  assert.equal(overview.disputes[0].sellerName, "ร้านการ์ดดี");
  assert.equal(overview.disputes[0].buyerMask, "ผู้ใช้ buye");
  assert.equal(overview.disputes[0].orderCode, "TCS001");
  assert.equal(overview.disputes[1].decision, "refund");
});

test("a dispute whose order failed to join is dropped rather than crashing the page", async () => {
  const admin = fixture({
    disputeRows: [{ id: "d1", reason: "other", decision: null, decided_at: null, created_at: "2026-01-01T00:00:00Z", order: null }],
  });
  const overview = await admin.getAdminOverview();
  assert.equal(overview.disputes.length, 0);
});

test("no disputes in the system is an empty list, not an error", async () => {
  const admin = fixture({ disputeRows: [] });
  const overview = await admin.getAdminOverview();
  assert.deepEqual(overview.disputes, []);
});
