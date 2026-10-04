import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import * as crypto from "node:crypto";
import { randomBytes } from "node:crypto";
import ts from "typescript";

function load(env) {
  const code = ts.transpileModule(readFileSync(new URL("../src/lib/secretBox.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function("exports", "require", "process", "Buffer", code)(
    mod.exports, (name) => (name === "node:crypto" ? crypto : {}), { env }, Buffer,
  );
  return mod.exports;
}
const env = { BANK_ENCRYPTION_KEY: randomBytes(32).toString("base64") };

test("encrypts and decrypts, with a fresh iv each time", () => {
  const { encrypt, decrypt } = load(env);
  const a = encrypt("1234567890");
  assert.notEqual(a, encrypt("1234567890"));
  assert.ok(!a.includes("1234567890"));
  assert.equal(decrypt(a), "1234567890");
});

test("tampered data and a wrong key are rejected", () => {
  const { encrypt, decrypt } = load(env);
  const blob = Buffer.from(encrypt("1234567890"), "base64");
  blob[blob.length - 1] ^= 1;
  assert.throws(() => decrypt(blob.toString("base64")));
  const other = load({ BANK_ENCRYPTION_KEY: randomBytes(32).toString("base64") });
  assert.throws(() => other.decrypt(encrypt("1234567890")));
});

test("a missing or short key fails closed", () => {
  assert.throws(() => load({}).encrypt("x"), /BANK_ENCRYPTION_KEY/);
  assert.throws(() => load({ BANK_ENCRYPTION_KEY: "abc" }).encrypt("x"), /BANK_ENCRYPTION_KEY/);
});
