import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

const code = ts.transpileModule(readFileSync(new URL("../src/lib/trackingUrl.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
new Function("exports", "module", code)(mod.exports, mod);
const { trackingUrl } = mod.exports;

test("builds a link for every courier in the seller dropdown", () => {
  assert.equal(trackingUrl("Flash Express", "TH123"), "https://www.flashexpress.co.th/fle/tracking?se=TH123");
  assert.equal(trackingUrl("Kerry Express", "KE1"), "https://th.kerryexpress.com/th/track/?track=KE1");
  assert.equal(trackingUrl("ไปรษณีย์ไทย (EMS)", "EE1TH"), "https://track.thailandpost.co.th/?trackNumber=EE1TH");
  assert.equal(trackingUrl("J&T Express", "JT1"), "https://www.jtexpress.co.th/service/track?billcode=JT1");
});

test("trims and encodes the number", () => {
  assert.equal(trackingUrl("Flash Express", "  A B&C "), "https://www.flashexpress.co.th/fle/tracking?se=A%20B%26C");
});

test("returns null for unknown courier or missing data", () => {
  assert.equal(trackingUrl("Unknown", "123"), null);
  assert.equal(trackingUrl(null, "123"), null);
  assert.equal(trackingUrl("Flash Express", "  "), null);
  assert.equal(trackingUrl("Flash Express", null), null);
});
