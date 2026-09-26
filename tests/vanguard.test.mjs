import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(path) {
  const code = ts.transpileModule(readFileSync(new URL("../" + path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: () => ({}) }, { filename: path });
  return exports;
}
const v = load("src/lib/vanguard.ts");
const plain = (x) => JSON.parse(JSON.stringify(x));

test("single cards need a real rarity and 1-4 copies", () => {
  assert.deepEqual(plain(v.parseListingDetails("rare", { rarity: "RRR", quantity: "4" })), { ok: true, rarity: "RRR", quantity: 4, hasExtras: null });
  assert.deepEqual(plain(v.parseListingDetails("rare", { rarity: "RRR" })), { ok: true, rarity: "RRR", quantity: 1, hasExtras: null });
  assert.equal(v.parseListingDetails("rare", { rarity: "อื่น ๆ", quantity: "1" }).ok, true);
  assert.equal(v.parseListingDetails("rare", { rarity: "", quantity: "1" }).ok, false);
  assert.equal(v.parseListingDetails("rare", { rarity: "MYTHIC", quantity: "1" }).ok, false);
  assert.equal(v.parseListingDetails("rare", { rarity: "SP", quantity: "5" }).ok, false);
  assert.equal(v.parseListingDetails("rare", { rarity: "SP", quantity: "0" }).ok, false);
  assert.equal(v.parseListingDetails("rare", { rarity: "SP", quantity: "1.5" }).ok, false);
});

test("ready-to-play decks must say whether they come with extras", () => {
  assert.deepEqual(plain(v.parseListingDetails("deck", { hasExtras: "true" })), { ok: true, rarity: "DECK", quantity: 1, hasExtras: true });
  assert.deepEqual(plain(v.parseListingDetails("deck", { hasExtras: "false" })), { ok: true, rarity: "DECK", quantity: 1, hasExtras: false });
  assert.equal(v.parseListingDetails("deck", {}).ok, false);
  assert.equal(v.parseListingDetails("deck", { hasExtras: "maybe" }).ok, false);
});

test("boosters take a box count and no rarity", () => {
  assert.deepEqual(plain(v.parseListingDetails("new", { quantity: "12", rarity: "RRR", hasExtras: "true" })), { ok: true, rarity: "BOX", quantity: 12, hasExtras: null });
  assert.equal(v.parseListingDetails("new", { quantity: "100" }).ok, false);
});

test("an unknown category is rejected and quantity reads naturally", () => {
  assert.equal(v.parseListingDetails("", {}).ok, false);
  assert.equal(v.parseListingDetails("promo", {}).ok, false);
  assert.equal(v.describeQuantity("rare", 4), "เป็นชุด 4 ใบ");
  assert.equal(v.describeQuantity("rare", 1), "1 ใบ");
  assert.equal(v.describeQuantity("new", 3), "3 กล่อง");
  assert.equal(v.describeQuantity("deck", 1), "");
});
