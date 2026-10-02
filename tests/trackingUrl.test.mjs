import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

const code = ts.transpileModule(readFileSync(new URL("../src/lib/trackingUrl.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
new Function("exports", "module", code)(mod.exports, mod);
const { trackingUrl, detectCourier, cleanTrackingNumber, COURIERS } = mod.exports;

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

test("the courier is detected from the number's format, ignoring spaces and case", () => {
  assert.equal(detectCourier("TH012345678A0"), "Flash Express");
  assert.equal(detectCourier(" th 012345678a0 "), "Flash Express");
  assert.equal(detectCourier("KEX1234567890"), "Kerry Express");
  assert.equal(detectCourier("EB123456789TH"), "ไปรษณีย์ไทย (EMS)");
  assert.equal(detectCourier("JT1234567890"), "J&T Express");
  assert.equal(detectCourier("ZZ12345678"), null);
  assert.equal(detectCourier(""), null);
});

test("no number matches two couriers, so detection is never ambiguous", () => {
  const samples = ["TH012345678A0", "TH0234998877XX", "KEX1234567890", "KER123456789", "EB123456789TH", "RR987654321TH", "JT1234567890"];
  for (const n of samples) assert.equal(COURIERS.filter((c) => c.pattern.test(n)).length, 1, n);
});

test("tracking numbers are cleaned to letters/digits/dashes, 5-40 long", () => {
  assert.equal(cleanTrackingNumber(" th 012-345 "), "TH012-345");
  assert.equal(cleanTrackingNumber("AB12"), null);
  assert.equal(cleanTrackingNumber("AB123 <b>"), null);
  assert.equal(cleanTrackingNumber("A".repeat(41)), null);
});
