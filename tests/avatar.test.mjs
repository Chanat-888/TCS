import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(env = { NEXT_PUBLIC_SUPABASE_URL: "https://upzvnvcseiibxsfsbcnj.supabase.co" }) {
  const code = ts.transpileModule(readFileSync(new URL("../src/lib/avatar.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, URL, process: { env } });
  return exports;
}
const { trustedAvatarUrl: trusted, avatarFromIdentity } = load();

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
test("the migrations enforce the same host rule as the display code", () => {
  const original = readFileSync(new URL("../supabase/migrations/0009_profile_avatars.sql", import.meta.url), "utf8");
  assert.match(original, /lh\[3-6\]\[\.\]googleusercontent\[\.\]com/);
  assert.match(original, /s\?profile\[\.\]line-scdn\[\.\]net/);
  assert.match(original, /check \(avatar_url is null or public\.is_trusted_avatar_url\(avatar_url\)\)/);

  const uploads = readFileSync(new URL("../supabase/migrations/0011_avatar_uploads.sql", import.meta.url), "utf8");
  assert.match(uploads, /upzvnvcseiibxsfsbcnj\[\.\]supabase\[\.\]co\/storage\/v1\/object\/public\/avatars\//);
  assert.match(uploads, /values \('avatars', 'avatars', true\)/);
});

test("a file in our own avatars bucket is trusted; other buckets and paths are not", () => {
  const own = "https://upzvnvcseiibxsfsbcnj.supabase.co/storage/v1/object/public/avatars/user-1/abc.png";
  assert.equal(trusted(own), own);
  for (const url of [
    "https://upzvnvcseiibxsfsbcnj.supabase.co/storage/v1/object/public/listing-photos/1/front.jpg",
    "https://upzvnvcseiibxsfsbcnj.supabase.co/storage/v1/object/sign/avatars/user-1/abc.png",
    "https://evil.example/storage/v1/object/public/avatars/user-1/abc.png",
    "http://upzvnvcseiibxsfsbcnj.supabase.co/storage/v1/object/public/avatars/user-1/abc.png",
  ]) assert.equal(trusted(url), null, url);
});
test("without a configured Supabase URL, no storage URL is ever trusted", () => {
  const { trustedAvatarUrl: trustedNoEnv } = load({});
  assert.equal(trustedNoEnv("https://upzvnvcseiibxsfsbcnj.supabase.co/storage/v1/object/public/avatars/user-1/abc.png"), null);
});

test("avatarFromIdentity reads a trusted photo from either metadata key, preferring avatar_url", () => {
  assert.equal(avatarFromIdentity({ identity_data: { avatar_url: "https://lh3.googleusercontent.com/a/x" } }), "https://lh3.googleusercontent.com/a/x");
  assert.equal(avatarFromIdentity({ identity_data: { picture: "https://profile.line-scdn.net/x" } }), "https://profile.line-scdn.net/x");
  assert.equal(
    avatarFromIdentity({ identity_data: { avatar_url: "https://lh3.googleusercontent.com/a", picture: "https://profile.line-scdn.net/other" } }),
    "https://lh3.googleusercontent.com/a",
  );
});
test("avatarFromIdentity rejects an untrusted or missing photo", () => {
  for (const identity of [
    { identity_data: { avatar_url: "https://evil.example/x" } },
    { identity_data: {} },
    { identity_data: undefined },
    null,
    undefined,
  ]) assert.equal(avatarFromIdentity(identity), null);
});
