import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

function load(path, deps = {}) {
  const code = ts.transpileModule(readFileSync(new URL("../" + path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function("exports", "module", "require", code)(mod.exports, mod, (name) => deps[name]);
  return mod.exports;
}
const promptpay = load("src/lib/promptpay.ts");
const { parseSlipQr } = load("src/lib/slipQr.ts", { "@/lib/promptpay": promptpay });

const field = (tag, value) => tag + String(value.length).padStart(2, "0") + value;
// A slip QR as banks print it: field 00 holds 00 (API id), 01 (sending bank), 02 (transaction reference).
function slipQr({ bank = "014", ref = "202610070123456789ABCDE" } = {}) {
  const body = field("00", field("00", "000001") + field("01", bank) + field("02", ref)) + field("51", "TH") + "9104";
  return body + promptpay.crc16(body);
}

test("a slip QR gives the transaction reference and the sending bank", () => {
  assert.deepEqual({ ...parseSlipQr(slipQr()) }, { ref: "202610070123456789ABCDE", bank: "scb" });
  assert.equal(parseSlipQr(slipQr({ bank: "004" })).bank, "kbank");
});

test("an unknown bank code still gives the reference, with no bank", () => {
  assert.deepEqual({ ...parseSlipQr(slipQr({ bank: "999" })) }, { ref: "202610070123456789ABCDE", bank: null });
});

test("anything that is not an intact slip QR gives null", () => {
  const good = slipQr();
  const tampered = good.replace("0123456789", "0123456780");
  for (const bad of [tampered, good.slice(0, -4) + "0000", promptpay.promptPayPayload("0105500000000", 100), "hello", "", undefined, 42, "0".repeat(400)]) {
    assert.equal(parseSlipQr(bad), null, String(bad).slice(0, 30));
  }
});
