import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(dependencies) {
  const code = ts.transpileModule(readFileSync(new URL("../src/lib/profile.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: (name) => dependencies[name] });
  return exports.loadProfileData;
}

test("slow profile lookup does not delay the other queries, and ratings are fetched once", async () => {
  const started = [];
  let resolveProfile;
  const queries = {
    getProfile: () => { started.push("profile"); return new Promise((resolve) => { resolveProfile = resolve; }); },
    getCompletedSales: async () => { started.push("sales"); return 12; },
    getReviewsForSeller: async () => { started.push("reviews"); return [{ rating: 5 }, { rating: 3 }]; },
    getListingsBySeller: async () => { started.push("listings"); return []; },
    hasEverBid: async () => { started.push("bid"); return true; },
  };
  const loadProfile = load({ "server-only": {}, "@/lib/queries": queries });
  const resultPromise = loadProfile("seller");
  assert.deepEqual(started, ["profile", "sales", "reviews", "listings", "bid"]);
  resolveProfile({ id: "seller" });
  const result = await resultPromise;
  assert.equal(result.stats.avgRating, 4);
  assert.equal(result.stats.reviewCount, 2);
  assert.equal(result.stats.completedSales, 12);
});

test("public profile data never reads private order data, and new profiles have zero ratings", async () => {
  // No "@/lib/orders" dependency is provided: importing it here would yield undefined.
  const loadProfile = load({
    "server-only": {},
    "@/lib/queries": {
      getProfile: async () => ({ id: "seller" }),
      getCompletedSales: async () => 0,
      getReviewsForSeller: async () => [],
      getListingsBySeller: async () => [],
      hasEverBid: async () => false,
    },
  });
  const result = await loadProfile("seller");
  assert.equal("disputeCount" in result, false);
  assert.equal(result.stats.avgRating, 0);
  assert.equal(result.stats.reviewCount, 0);
});

test("query failures are not disguised as a successful empty profile", async () => {
  const loadProfile = load({
    "server-only": {},
    "@/lib/queries": {
      getProfile: async () => ({ id: "seller" }),
      getCompletedSales: async () => { throw new Error("database unavailable"); },
      getReviewsForSeller: async () => [],
      getListingsBySeller: async () => [],
      hasEverBid: async () => false,
    },
  });
  await assert.rejects(loadProfile("seller"), /database unavailable/);
});

test("profile page starts public queries before the session check resolves, and renders the owner tile only for the owner", () => {
  const page = readFileSync(new URL("../src/app/profile/[id]/page.tsx", import.meta.url), "utf8");
  assert.ok(page.indexOf("loadProfileData(id)") < page.indexOf("await getSessionUserId()"));
  const view = readFileSync(new URL("../src/app/profile/ProfileView.tsx", import.meta.url), "utf8");
  assert.match(view, /isOwner = viewerId === id/);
  assert.match(view, /\{isOwner && \(\s*<Suspense[\s\S]*?<OwnerDisputeTile userId=\{id\}/);
  assert.equal(view.split("<OwnerDisputeTile").length - 1, 1, "the private tile must be rendered in exactly one place");
});
