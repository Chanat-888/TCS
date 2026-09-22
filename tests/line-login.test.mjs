import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(path, dependencies = {}, env = {}) {
  const code = ts.transpileModule(readFileSync(new URL("../" + path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports, URL, process: { env },
    require(name) {
      if (name === "@/lib/authLog") return { logAuthError() {} };
      if (!(name in dependencies)) throw new Error("Unexpected dependency: " + name);
      return dependencies[name];
    },
  }, { filename: path });
  return exports;
}

function sessionFor(user, error = null) {
  return load("src/lib/session.ts", {
    "server-only": {}, react: { cache: (fn) => fn },
    "next/navigation": { redirect(path) { throw new Error("redirect:" + path); } },
    "@/lib/supabase/server": {
      createAuthClient: async () => ({ auth: { getUser: async () => ({ data: { user }, error }) } }),
    },
  });
}

test("a LINE user without an email or phone can sign in and trade", async () => {
  const line = sessionFor({ id: "line-user", identities: [{ provider: "custom:line" }] });
  assert.equal(await line.getSessionUserId(), "line-user");
  assert.equal(await line.getVerifiedUserId(), "line-user");
  assert.equal(await line.requireVerifiedUserId(), "line-user");
});
test("user-editable metadata can never pass for a LINE (or any) identity", async () => {
  for (const user of [
    { id: "forged-1", user_metadata: { provider: "custom:line" }, identities: [] },
    { id: "forged-2", user_metadata: { identities: [{ provider: "custom:line" }] } },
    { id: "forged-3", app_metadata: {}, user_metadata: { email_verified: true, phone_confirmed_at: "yes" } },
    { id: "other-provider", identities: [{ provider: "github" }] },
  ]) {
    assert.equal(await sessionFor(user).getSessionUserId(), null, user.id);
  }
});
test("anonymous and revoked LINE sessions are still rejected", async () => {
  const anonymous = { id: "anon", is_anonymous: true, identities: [{ provider: "custom:line" }] };
  assert.equal(await sessionFor(anonymous).getSessionUserId(), null);
  const revoked = { id: "revoked", identities: [{ provider: "custom:line" }] };
  assert.equal(await sessionFor(revoked, { message: "session revoked" }).getSessionUserId(), null);
});

function oauthFixture({ user = null } = {}) {
  const calls = [];
  const jar = new Map();
  const auth = {
    getUser: async () => ({ data: { user }, error: null }),
    signInWithOAuth: async (args) => { calls.push(["signin", args]); return { data: { url: "https://auth.test/authorize" }, error: null }; },
    linkIdentity: async (args) => { calls.push(["link", args]); return { data: { url: "https://auth.test/link" }, error: null }; },
  };
  return {
    calls, jar,
    dependencies: {
      "next/headers": { cookies: async () => ({ set: (k, v) => jar.set(k, v), delete: (k) => jar.delete(k) }) },
      "@/lib/supabase/server": { createAuthClient: async () => ({ auth }) },
    },
  };
}
const SITE = { NEXT_PUBLIC_SITE_URL: "https://tcs.test" };

test("LINE login uses the custom provider, needed scopes, and no Google-only prompt", async () => {
  const fixture = oauthFixture();
  const actions = load("src/app/auth/google/actions.ts", fixture.dependencies, SITE);
  assert.ok((await actions.startLineAuth()).url);
  const args = fixture.calls[0][1];
  assert.equal(args.provider, "custom:line");
  assert.equal(args.options.scopes, "openid profile");
  assert.equal(args.options.redirectTo, "https://tcs.test/auth/callback");
  assert.equal(args.options.skipBrowserRedirect, true);
  assert.equal(args.options.queryParams, undefined);
});
test("Google login is unchanged by the LINE addition", async () => {
  const fixture = oauthFixture();
  const actions = load("src/app/auth/google/actions.ts", fixture.dependencies, SITE);
  assert.ok((await actions.startGoogleAuth()).url);
  const args = fixture.calls[0][1];
  assert.equal(args.provider, "google");
  assert.equal(args.options.queryParams.prompt, "select_account");
  assert.equal(args.options.scopes, undefined);
});
test("LINE login refuses an already signed-in user and reports missing site config by name", async () => {
  const signedIn = oauthFixture({ user: { id: "someone" } });
  const result = await load("src/app/auth/google/actions.ts", signedIn.dependencies, SITE).startLineAuth();
  assert.ok(result.error);
  assert.equal(signedIn.calls.length, 0);
  const noConfig = oauthFixture();
  const missing = await load("src/app/auth/google/actions.ts", noConfig.dependencies).startLineAuth();
  assert.ok(missing.error.includes("LINE"));
  assert.equal(noConfig.calls.length, 0);
});
