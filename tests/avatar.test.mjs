import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load() {
  const code = ts.transpileModule(readFileSync(new URL("../src/lib/avatar.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, URL });
  return exports.trustedAvatarUrl;
}
const trusted = load();

test("provider photo URLs on Google and LINE hosts are accepted", () => {
  for (const url of [
    "https://lh3.googleusercontent.com/a/abc123=s96-c",
    "https://lh5.googleusercontent.com/a/xyz",
    "https://profile.line-scdn.net/0hAbCdEf/preview",
    "https://sprofile.line-scdn.net/0hZzZz",
  ]) assert.equal(trusted(url), url);
});
test("everything else is rejected, including host-spoofing tricks", () => {
  // Same cases as the database migration test, so both layers agree.
  for (const url of [
    "http://lh3.googleusercontent.com/a/x",
    "https://lh3.googleusercontent.com@evil.example/x",
    "https://lh3.googleusercontent.com.evil.example/x",
    "https://evil.example/lh3.googleusercontent.com/x",
    "https://evil.example/x.png",
    "javascript:alert(1)",
    "data:image/svg+xml;base64,PHN2Zz4=",
    "https://lh3.googleusercontent.com/a b",
    "https://lh3.googleusercontent.com:8443/a",
    "https://user:pass@lh3.googleusercontent.com/a",
    "https://lh3.googleusercontent.com/" + "a".repeat(600),
    "not a url", "", null, undefined, 42, {},
  ]) assert.equal(trusted(url), null, String(url).slice(0, 60));
});
test("the migration enforces the same host rule as the display code", () => {
  const sql = readFileSync(new URL("../supabase/migrations/0009_profile_avatars.sql", import.meta.url), "utf8");
  assert.match(sql, /lh\[3-6\]\[\.\]googleusercontent\[\.\]com/);
  assert.match(sql, /s\?profile\[\.\]line-scdn\[\.\]net/);
  assert.match(sql, /check \(avatar_url is null or public\.is_trusted_avatar_url\(avatar_url\)\)/);
});
