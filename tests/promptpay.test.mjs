import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

const code = ts.transpileModule(readFileSync(new URL("../src/lib/promptpay.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
new Function("exports", "module", code)(mod.exports, mod);
const { crc16, promptPayPayload } = mod.exports;

// Splits an EMVCo payload into [tag, value] pairs.
function fields(payload) {
  const out = [];
  for (let i = 0; i < payload.length; ) {
    const len = Number(payload.slice(i + 2, i + 4));
    out.push([payload.slice(i, i + 2), payload.slice(i + 4, i + 4 + len)]);
    i += 4 + len;
  }
  return out;
}

test("crc16 matches the standard CCITT-FALSE check value", () => {
  assert.equal(crc16("123456789"), "29B1");
});

test("a tax-ID payload is well formed, carries the amount and ends in a valid checksum", () => {
  const payload = promptPayPayload("0105500000000", 500);
  const f = Object.fromEntries(fields(payload));
  assert.equal(f["00"], "01");
  assert.equal(f["01"], "12", "dynamic QR");
  assert.equal(f["53"], "764", "baht");
  assert.equal(f["54"], "500.00");
  assert.equal(f["58"], "TH");
  assert.equal(f["29"], "0016A000000677010111" + "0213" + "0105500000000");
  assert.equal(f["63"], crc16(payload.slice(0, -4)), "checksum covers everything before it");
});

test("a mobile number is sent as 0066 plus the number without its leading zero", () => {
  const f = Object.fromEntries(fields(promptPayPayload("081-234-5678", 1250.5)));
  assert.equal(f["29"], "0016A000000677010111" + "0113" + "0066812345678");
  assert.equal(f["54"], "1250.50");
});

test("an unusable ID or amount gives no payload", () => {
  for (const id of ["", "12345", "0812345", "abc"]) assert.equal(promptPayPayload(id, 100), null, id);
  for (const amount of [0, -5, NaN, Infinity]) assert.equal(promptPayPayload("0105500000000", amount), null, String(amount));
});
