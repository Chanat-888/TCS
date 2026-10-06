import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

const code = ts.transpileModule(readFileSync(new URL("../src/lib/termsConfig.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
new Function("exports", "module", code)(mod.exports, mod);
const { safeNext } = mod.exports;

test("safeNext only returns same-site paths", () => {
  assert.equal(safeNext("/listings/new"), "/listings/new");
  assert.equal(safeNext("/checkout/abc?x=1"), "/checkout/abc?x=1");
  for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "evil", "", undefined, 5]) {
    assert.equal(safeNext(bad), "/browse");
  }
});

// Every path that sells, withdraws or pays must check for acceptance (page or action/API).
test("selling, withdrawing and paying are gated on accepted terms", () => {
  const gated = [
    "src/app/listings/new/page.tsx",
    "src/app/listings/new/spread/page.tsx",
    "src/app/api/listings/route.ts",
    "src/app/api/listings/spread/route.ts",
    "src/app/earnings/page.tsx",
    "src/app/earnings/actions.ts",
    "src/app/checkout/[orderId]/page.tsx",
    "src/app/checkout/[orderId]/actions.ts",
    "src/app/api/orders/[id]/slip/route.ts",
  ];
  for (const f of gated) {
    assert.match(readFileSync(new URL(`../${f}`, import.meta.url), "utf8"), /requireTerms|hasAcceptedTerms/, f);
  }
});
