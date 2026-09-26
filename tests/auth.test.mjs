import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Execute the actual server modules with controlled external boundaries.
// No SMS, production accounts, or database records are touched.
function load(path, dependencies = {}, env = {}) {
  const code = ts.transpileModule(readFileSync(new URL("../" + path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports, URL, Request, Response, Headers, process: { env },
    require(name) {
      if (name === "@/lib/authLog") return { logAuthError() {} };
      if (!(name in dependencies)) throw new Error("Unexpected dependency: " + name);
      return dependencies[name];
    },
  }, { filename: path });
  return exports;
}
const phone = load("src/lib/phone.ts");

test("normalizes Thai mobile formats to one account identity", () => {
  for (const input of ["0812345678", "81 234 5678", "+66 81-234-5678", "66812345678"]) {
    assert.equal(phone.normalizeThaiPhone(input), "+66812345678");
  }
  for (const input of ["0912345678", "0612345678"]) {
    assert.equal(phone.normalizeThaiPhone(input), "+66" + input.slice(1));
  }
});
test("rejects malformed, foreign, landline, and non-string phone input", () => {
  for (const input of ["", "12345678", "0212345678", "+1 2125551234", "08123456789",
    "phone0812345678", "+660812345678", "++66812345678", null, {}, 812345678]) {
    assert.equal(phone.normalizeThaiPhone(input), null);
  }
});
function fixture(overrides = {}) {
  const calls = [];
  const client = {
    auth: {
      signInWithOtp: async (args) => { calls.push(["send", args]); return { error: null }; },
      verifyOtp: async (args) => {
        calls.push(["verify", args]);
        return { data: { user: { id: "real-user", phone_confirmed_at: "2026-01-01" }, session: {} }, error: null };
      },
      signOut: async (args) => { calls.push(["signOut", args]); return { error: null }; },
      ...overrides,
    },
    from(table) {
      calls.push(["table", table]);
      return { select: () => ({ eq: (column, id) => {
        calls.push(["profile", column, id]);
        return { maybeSingle: async () => ({ data: { id }, error: null }) };
      } }) };
    },
  };
  const actions = load("src/app/login/actions.ts", {
    "@/lib/phone": phone,
    "@/lib/supabase/server": { createAuthClient: async () => client },
  });
  return { actions, calls, client };
}
test("invalid input never sends SMS or verifies a code", async () => {
  const { actions, calls } = fixture();
  assert.ok((await actions.sendPhoneOtp("abc")).error);
  assert.ok((await actions.verifyPhoneOtp("0812345678", "123")).error);
  assert.ok((await actions.verifyPhoneOtp("0812345678", "abcdef")).error);
  assert.equal(calls.length, 0);
});
test("send and resend both invoke the provider with normalized phone", async () => {
  const { actions, calls } = fixture();
  assert.equal((await actions.sendPhoneOtp("0812345678")).success, true);
  assert.equal((await actions.sendPhoneOtp("+66812345678")).success, true);
  assert.equal(calls.filter(([type]) => type === "send").length, 2);
  assert.equal(calls[0][1].phone, "+66812345678");
});
test("provider rate limits and delivery failures do not report success", async () => {
  for (const code of ["over_sms_send_rate_limit", "over_request_rate_limit", "sms_send_failed"]) {
    const { actions } = fixture({ signInWithOtp: async () => ({ error: { code } }) });
    const result = await actions.sendPhoneOtp("0812345678");
    assert.ok(result.error);
    assert.equal(result.success, undefined);
  }
});
test("wrong or expired six-digit OTP is rejected by the server", async () => {
  const { actions } = fixture({
    verifyOtp: async () => ({ data: { user: null, session: null }, error: { code: "otp_expired" } }),
  });
  const result = await actions.verifyPhoneOtp("0812345678", "123456");
  assert.ok(result.error);
  assert.equal(result.success, undefined);
});
test("successful verification uses the authenticated user's profile", async () => {
  const { actions, calls } = fixture();
  assert.equal((await actions.verifyPhoneOtp("0812345678", "123456")).success, true);
  assert.equal(calls[0][1].type, "sms");
  assert.equal(calls.find(([type]) => type === "profile")[2], "real-user");
});
test("unconfirmed users or missing sessions cannot complete login", async () => {
  for (const data of [
    { user: { id: "user" }, session: {} },
    { user: { id: "user", phone_confirmed_at: "yes" }, session: null },
  ]) {
    const { actions } = fixture({ verifyOtp: async () => ({ data, error: null }) });
    assert.ok((await actions.verifyPhoneOtp("0812345678", "123456")).error);
  }
});
test("missing profile signs out instead of reporting successful login", async () => {
  const { actions, client, calls } = fixture();
  client.from = () => ({ select: () => ({ eq: () => ({
    maybeSingle: async () => ({ data: null, error: null }),
  }) }) });
  assert.ok((await actions.verifyPhoneOtp("0812345678", "123456")).error);
  assert.equal(calls.find(([type]) => type === "signOut")[1].scope, "local");
});
test("network failures return retryable errors without leaking internals", async () => {
  const fail = async () => { throw new Error("private provider information"); };
  const { actions } = fixture({ signInWithOtp: fail, verifyOtp: fail });
  for (const result of [
    await actions.sendPhoneOtp("0812345678"),
    await actions.verifyPhoneOtp("0812345678", "123456"),
  ]) {
    assert.ok(result.error);
    assert.ok(!result.error.includes("private"));
  }
});
test("session identity comes from getUser, including revoked and unconfirmed cases", async () => {
  for (const [user, error, expected] of [
    [{ id: "account-a", phone_confirmed_at: "yes" }, null, "account-a"],
    [{ id: "account-b", phone_confirmed_at: "yes" }, null, "account-b"],
    [{ id: "forged", phone_confirmed_at: "yes" }, { message: "invalid" }, null],
    [{ id: "unconfirmed" }, null, null],
    [null, { message: "missing" }, null],
  ]) {
    const session = load("src/lib/session.ts", {
      "server-only": {},
      react: { cache: (fn) => fn },
      "next/navigation": { redirect(path) { throw new Error("redirect:" + path); } },
      "@/lib/supabase/server": {
        createAuthClient: async () => ({ auth: { getUser: async () => ({ data: { user }, error }) } }),
      },
    });
    assert.equal(await session.getSessionUserId(), expected);
  }
});
test("logout is POST-only and rejects cross-origin requests", async () => {
  let signouts = 0;
  const route = load("src/app/logout/route.ts", {
    "next/server": { NextResponse: class extends Response {
      static redirect(url, status) { return new Response(null, { status, headers: { Location: url.toString() } }); }
    } },
    "next/headers": { cookies: async () => ({ delete() {} }) },
    "@/lib/supabase/server": {
      createAuthClient: async () => ({ auth: { signOut: async () => { signouts++; return { error: null }; } } }),
    },
  });
  assert.equal(route.GET, undefined);
  assert.equal((await route.POST(new Request("https://tcs.test/logout", {
    method: "POST", headers: { Origin: "https://attacker.test" },
  }))).status, 403);
  assert.equal(signouts, 0);
  const result = await route.POST(new Request("https://tcs.test/logout", {
    method: "POST", headers: { Origin: "https://tcs.test" },
  }));
  assert.equal(result.status, 303);
  assert.equal(result.headers.get("Location"), "https://tcs.test/login");
  assert.equal(signouts, 1);
});

test("session refresh forwards new cookies to both server rendering and browser", async () => {
  const requestCookies = new Map([["old", "cookie"]]);
  let options;
  const responseCookies = () => {
    const items = new Map();
    return { set(name, value) { items.set(name, value); }, get(name) { return items.get(name); } };
  };
  const proxy = load("src/proxy.ts", {
    "@supabase/ssr": { createServerClient(_url, _key, opts) {
      options = opts;
      // getClaims is the only auth call the proxy may make: a getUser() here
      // would be undefined and fail the test, and would add a network round trip.
      return { auth: { async getClaims() {
        options.cookies.setAll([{ name: "new-session", value: "refreshed", options: {} }], {
          "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
          Expires: "0", Pragma: "no-cache",
        });
        return { data: { claims: null }, error: null };
      } } };
    } },
    "next/server": { NextResponse: { next() {
      return { cookies: responseCookies(), headers: new Headers() };
    } } },
  });
  const result = await proxy.proxy({
    cookies: {
      getAll: () => Array.from(requestCookies, ([name, value]) => ({ name, value })),
      set: (name, value) => requestCookies.set(name, value),
    },
  });
  assert.equal(requestCookies.get("new-session"), "refreshed");
  assert.equal(result.cookies.get("new-session"), "refreshed");
  assert.ok(result.headers.get("Cache-Control").includes("no-store"));
  assert.equal(result.headers.get("Expires"), "0");
});

function sessionFor(user, error = null) {
  return load("src/lib/session.ts", {
    "server-only": {}, react: { cache: (fn) => fn },
    "next/navigation": { redirect(path) { throw new Error("redirect:" + path); } },
    "@/lib/supabase/server": {
      createAuthClient: async () => ({ auth: { getUser: async () => ({ data: { user }, error }) } }),
    },
  });
}
test("a Google user with a confirmed email can trade without a phone", async () => {
  const session = sessionFor({ id: "google-user", email_confirmed_at: "yes", phone: "" });
  assert.equal(await session.getSessionUserId(), "google-user");
  assert.equal(await session.getVerifiedUserId(), "google-user");
  assert.equal(await session.requireVerifiedUserId(), "google-user");
});
test("anonymous users and forged confirmation metadata cannot trade", async () => {
  for (const user of [
    { id: "anonymous", is_anonymous: true, email_confirmed_at: "yes" },
    { id: "forged", user_metadata: { phone_confirmed_at: "yes", verified: true } },
  ]) {
    const session = sessionFor(user);
    assert.equal(await session.getSessionUserId(), null);
    await assert.rejects(session.requireVerifiedUserId(), /redirect:\/login/);
  }
});
test("direct bids and purchases require a signed-in user before database writes", async () => {
  const session = sessionFor(null);
  const actions = load("src/app/listings/[id]/actions.ts", {
    "next/cache": { revalidatePath() {} },
    "@/lib/session": session,
    "@/lib/listingKind": { isBuyNowAvailable: () => true },
    "@/lib/orderCreate": {},
    "@/lib/supabase/server": { createServiceClient() { throw new Error("Database must not be touched"); } },
  });
  await assert.rejects(actions.placeBid("listing", 100), /redirect:\/login/);
  await assert.rejects(actions.buyNow("listing"), /redirect:\/login/);
});
test("listing API rejects a signed-out request before accepting uploads", async () => {
  const route = load("src/app/api/listings/route.ts", {
    "next/server": { NextResponse: Response },
    "@/lib/session": sessionFor(null),
    "@/lib/supabase/server": { createServiceClient() { throw new Error("Database must not be touched"); } },
  });
  const result = await route.POST(new Request("https://tcs.test/api/listings", { method: "POST" }));
  assert.equal(result.status, 403);
  assert.equal((await result.json()).code, "LOGIN_REQUIRED");
});

function phoneVerificationFixture(overrides = {}) {
  const calls = [];
  const original = { id: "google-user", email_confirmed_at: "yes" };
  const auth = {
    getUser: async () => ({ data: { user: original }, error: null }),
    updateUser: async (args) => { calls.push(["update", args]); return { error: null }; },
    verifyOtp: async (args) => {
      calls.push(["verify", args]);
      return { data: { user: { ...original, phone: "66812345678", phone_confirmed_at: "yes" }, session: {} }, error: null };
    },
    signOut: async () => { calls.push(["signout"]); return { error: null }; },
    ...overrides,
  };
  const actions = load("src/app/verify-phone/actions.ts", {
    "@/lib/phone": phone,
    "@/lib/supabase/server": { createAuthClient: async () => ({ auth }) },
  });
  return { actions, calls };
}
test("Google phone verification updates and verifies the existing account", async () => {
  const { actions, calls } = phoneVerificationFixture();
  assert.equal((await actions.sendVerificationOtp("0812345678")).success, true);
  assert.equal(calls[0][0], "update");
  assert.equal(calls[0][1].phone, "+66812345678");
  assert.equal((await actions.verifyAccountPhone("0812345678", "123456")).success, true);
  assert.equal(calls[1][1].type, "phone_change");
});
test("phone attachment rejects expired sessions, duplicate phones, and expired codes", async () => {
  const loggedOut = phoneVerificationFixture({ getUser: async () => ({ data: { user: null }, error: null }) });
  assert.ok((await loggedOut.actions.sendVerificationOtp("0812345678")).error);
  assert.ok((await loggedOut.actions.verifyAccountPhone("0812345678", "123456")).error);
  assert.equal(loggedOut.calls.length, 0);
  const duplicate = phoneVerificationFixture({ updateUser: async () => ({ error: { code: "phone_exists" } }) });
  assert.ok((await duplicate.actions.sendVerificationOtp("0812345678")).error.includes("บัญชี"));
  const expired = phoneVerificationFixture({ verifyOtp: async () => ({ data: {}, error: { code: "otp_expired" } }) });
  assert.ok((await expired.actions.verifyAccountPhone("0812345678", "123456")).error);
});
test("phone verification cannot switch to another account or confirm a different number", async () => {
  for (const changed of [
    { id: "different-user", phone: "66812345678", phone_confirmed_at: "yes" },
    { id: "google-user", phone: "66987654321", phone_confirmed_at: "yes" },
    { id: "google-user", phone: "66812345678" },
  ]) {
    const { actions, calls } = phoneVerificationFixture({
      verifyOtp: async () => ({ data: { user: changed, session: {} }, error: null }),
    });
    assert.ok((await actions.verifyAccountPhone("0812345678", "123456")).error);
    if (changed.id === "different-user") assert.equal(calls[0][0], "signout");
  }
});

function oauthFixture({ user = null, expectedId, exchangeError = null, hasProfile = true, googleRecovery = false, deleteError = null } = {}) {
  const calls = [];
  const jar = new Map([
    ...(expectedId ? [["tcs_link_user", expectedId]] : []),
    ...(googleRecovery ? [["tcs_google_recovery", "1"]] : []),
  ]);
  const store = {
    get: (key) => jar.has(key) ? { value: jar.get(key) } : undefined,
    set: (key, value) => jar.set(key, value),
    delete: (key) => jar.delete(key),
  };
  const auth = {
    getUser: async () => ({ data: { user }, error: null }),
    signInWithOAuth: async (args) => { calls.push(["signin", args]); return { data: { url: "https://auth.test/authorize" }, error: null }; },
    linkIdentity: async (args) => { calls.push(["link", args]); return { data: { url: "https://auth.test/link" }, error: null }; },
    exchangeCodeForSession: async (code) => { calls.push(["exchange", code]); return { error: exchangeError }; },
    signOut: async () => { calls.push(["signout"]); return { error: null }; },
  };
  const dependencies = {
    "next/headers": { cookies: async () => store },
    "next/server": { NextResponse: class extends Response {
      static redirect(url) { return new this(null, { status: 307, headers: { Location: url.toString() } }); }
    } },
    "@/lib/supabase/server": {
      createAuthClient: async () => ({
        auth,
        from: () => ({ select: () => ({ eq: () => ({
          maybeSingle: async () => ({ data: hasProfile ? { id: user?.id } : null, error: null }),
        }) }) }),
      }),
      createServiceClient: () => ({
        auth: { admin: { deleteUser: async (id) => { calls.push(["deleteUser", id]); return { error: deleteError }; } } },
      }),
    },
  };
  return { dependencies, calls, jar };
}
test("Google login uses the configured callback and account-selection prompt", async () => {
  const fixture = oauthFixture();
  const actions = load("src/app/auth/google/actions.ts", fixture.dependencies, { NEXT_PUBLIC_SITE_URL: "https://tcs.test" });
  assert.ok((await actions.startGoogleAuth()).url);
  const args = fixture.calls[0][1];
  assert.equal(args.provider, "google");
  assert.equal(args.options.redirectTo, "https://tcs.test/auth/callback");
  assert.equal(args.options.queryParams.prompt, "select_account");
  assert.equal(args.options.skipBrowserRedirect, true);
});
test("Google linking requires a session and records its UUID", async () => {
  const missing = oauthFixture();
  assert.ok((await load("src/app/auth/google/actions.ts", missing.dependencies,
    { NEXT_PUBLIC_SITE_URL: "https://tcs.test" }).startGoogleAuth(true)).error);
  assert.equal(missing.calls.length, 0);
  const signedIn = oauthFixture({ user: { id: "phone-user" } });
  const actions = load("src/app/auth/google/actions.ts", signedIn.dependencies, { NEXT_PUBLIC_SITE_URL: "https://tcs.test" });
  assert.ok((await actions.startGoogleAuth(false)).error);
  assert.ok((await actions.startGoogleAuth(true)).url);
  assert.equal(signedIn.calls[0][0], "link");
  assert.equal(signedIn.jar.get("tcs_link_user"), "phone-user");
});
test("missing Google configuration produces a recoverable error", async () => {
  const fixture = oauthFixture();
  const actions = load("src/app/auth/google/actions.ts", fixture.dependencies);
  assert.ok((await actions.startGoogleAuth()).error);
  assert.equal(fixture.calls.length, 0);
});
test("OAuth callback exchanges PKCE code and ignores external next destinations", async () => {
  const fixture = oauthFixture({ user: { id: "google-user", email_confirmed_at: "yes" } });
  const route = load("src/app/auth/callback/route.ts", fixture.dependencies);
  const result = await route.GET(new Request("https://tcs.test/auth/callback?code=test&next=https://attacker.test"));
  assert.equal(result.headers.get("Location"), "https://tcs.test/browse");
  assert.equal(fixture.calls[0][0], "exchange");
  assert.equal(fixture.calls[0][1], "test");
  assert.equal(result.headers.get("Cache-Control"), "private, no-store");
});
test("cancelled, missing, and invalid OAuth codes never reach the marketplace", async () => {
  for (const query of ["?error=access_denied", "", "?code=expired"]) {
    const fixture = oauthFixture({ exchangeError: { message: "bad code" } });
    const route = load("src/app/auth/callback/route.ts", fixture.dependencies);
    const result = await route.GET(new Request("https://tcs.test/auth/callback" + query));
    assert.equal(result.headers.get("Location"), "https://tcs.test/auth/error");
  }
});
test("linked Google returns to the same profile; missing profiles and mismatches fail", async () => {
  for (const [id, expectedId, hasProfile, success] of [
    ["same", "same", true, true],
    ["other", "same", true, false],
    ["same", "same", false, false],
  ]) {
    const fixture = oauthFixture({ user: { id, email_confirmed_at: "yes" }, expectedId, hasProfile });
    const route = load("src/app/auth/callback/route.ts", fixture.dependencies);
    const result = await route.GET(new Request("https://tcs.test/auth/callback?code=test"));
    assert.equal(result.headers.get("Location"), "https://tcs.test" + (success ? "/profile" : "/auth/error"));
    assert.equal(fixture.jar.has("tcs_link_user"), false);
    if (!success) assert.ok(fixture.calls.some(([name]) => name === "signout"));
  }
});
test("Google recovery signs into an existing account, LINE-linked or not", async () => {
  for (const identities of [
    [{ provider: "custom:line" }, { provider: "google" }],
    [{ provider: "google" }], // an old, Google-only account (e.g. one that predates LINE) keeps working
  ]) {
    const fixture = oauthFixture({
      user: { id: "u1", identities, created_at: "2020-01-01T00:00:00Z" },
      googleRecovery: true,
    });
    const route = load("src/app/auth/callback/route.ts", fixture.dependencies);
    const result = await route.GET(new Request("https://tcs.test/auth/callback?code=test"));
    assert.equal(result.headers.get("Location"), "https://tcs.test/browse");
    assert.equal(fixture.jar.has("tcs_google_recovery"), false);
    assert.ok(!fixture.calls.some(([name]) => name === "signout" || name === "deleteUser"));
  }
});
test("a brand-new account created by a Google-only recovery attempt is refused and deleted", async () => {
  const fixture = oauthFixture({
    user: { id: "orphan", identities: [{ provider: "google" }], created_at: new Date().toISOString() },
    googleRecovery: true,
  });
  const route = load("src/app/auth/callback/route.ts", fixture.dependencies);
  const result = await route.GET(new Request("https://tcs.test/auth/callback?code=test"));
  assert.equal(result.headers.get("Location"), "https://tcs.test/auth/error?reason=no_account");
  assert.ok(fixture.calls.some(([name]) => name === "signout"));
  assert.deepEqual(fixture.calls.find(([name]) => name === "deleteUser"), ["deleteUser", "orphan"]);
});
test("linking Google from the profile page is unaffected by the recovery-only rule", async () => {
  const fixture = oauthFixture({
    user: { id: "u2", identities: [{ provider: "google" }], created_at: new Date().toISOString() },
    expectedId: "u2",
  });
  const route = load("src/app/auth/callback/route.ts", fixture.dependencies);
  const result = await route.GET(new Request("https://tcs.test/auth/callback?code=test"));
  assert.equal(result.headers.get("Location"), "https://tcs.test/profile");
});
