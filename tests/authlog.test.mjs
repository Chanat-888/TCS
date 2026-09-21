import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function loadLogger() {
  const lines = [];
  const code = ts.transpileModule(readFileSync(new URL("../src/lib/authLog.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, console: { error: (...args) => lines.push(args) } });
  return { logAuthError: exports.logAuthError, lines };
}

test("logs the provider code, status and message so setup failures are diagnosable", () => {
  const { logAuthError, lines } = loadLogger();
  logAuthError("sendPhoneOtp", { code: "sms_send_failed", status: 500, message: "Error sending OTP to provider" });
  assert.equal(lines.length, 1);
  assert.equal(lines[0][0], "[auth] sendPhoneOtp");
  assert.deepEqual(JSON.parse(JSON.stringify(lines[0][1])), {
    code: "sms_send_failed", status: 500, message: "Error sending OTP to provider",
  });
});
test("phone numbers inside provider messages are redacted", () => {
  const { logAuthError, lines } = loadLogger();
  logAuthError("x", { message: "The number +66 92-487-9371 is unverified; also 0924879371" });
  const { message } = lines[0][1];
  assert.ok(!/\d{7}/.test(message), message);
  assert.ok(message.includes("[number]"));
});
test("odd inputs never throw from inside an error handler", () => {
  const { logAuthError, lines } = loadLogger();
  for (const input of [null, undefined, "plain string", 42, {}, new Error("boom")]) logAuthError("x", input);
  assert.equal(lines.length, 6);
});
