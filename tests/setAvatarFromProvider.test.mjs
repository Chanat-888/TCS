import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(path, dependencies = {}) {
  const code = ts.transpileModule(readFileSync(new URL("../" + path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require(name) {
      if (!(name in dependencies)) throw new Error("Unexpected dependency: " + name);
      return dependencies[name];
    },
  }, { filename: path });
  return exports;
}

function fixture(user, updateError = null) {
  const calls = { updated: [], revalidated: [], logged: [] };
  const actions = load("src/app/profile/accountActions.ts", {
    "next/cache": { revalidatePath: (path) => calls.revalidated.push(path) },
    "@/lib/authLog": { logAuthError: (scope) => calls.logged.push(scope) },
    "@/lib/avatar": { avatarFromIdentity: (identity) => (identity?.identity_data?.avatar_url?.startsWith("https://trusted.example/") ? identity.identity_data.avatar_url : null) },
    "@/lib/supabase/server": {
      createAuthClient: async () => ({ auth: { getUser: async () => ({ data: { user }, error: null }) } }),
      createServiceClient: () => ({
        from: () => ({
          update: (fields) => ({
            eq: (col, val) => { calls.updated.push({ fields, col, val }); return Promise.resolve({ error: updateError }); },
          }),
        }),
      }),
    },
  });
  return { actions, calls };
}

const line = { provider: "custom:line", identity_data: { avatar_url: "https://trusted.example/line.jpg" } };
const google = { provider: "google", identity_data: { avatar_url: "https://trusted.example/google.jpg" } };
const untrustedGoogle = { provider: "google", identity_data: { avatar_url: "https://evil.example/x.jpg" } };

test("sets the avatar to the trusted photo from the identity the server finds, not a URL supplied by the caller", async () => {
  const { actions, calls } = fixture({ id: "u1", identities: [line, google] });
  const result = await actions.setAvatarFromProvider("google");
  assert.equal(result.success, true);
  assert.deepEqual(JSON.parse(JSON.stringify(calls.updated)), [{ fields: { avatar_url: "https://trusted.example/google.jpg" }, col: "id", val: "u1" }]);
  assert.ok(calls.revalidated.includes("/profile/u1"));
});

test("signed-out callers cannot set an avatar", async () => {
  const { actions, calls } = fixture(null);
  assert.ok((await actions.setAvatarFromProvider("google")).error);
  assert.equal(calls.updated.length, 0);
});

test("an identity with no trusted photo is rejected and nothing is written", async () => {
  const { actions, calls } = fixture({ id: "u2", identities: [line, untrustedGoogle] });
  assert.ok((await actions.setAvatarFromProvider("google")).error);
  assert.equal(calls.updated.length, 0);
});

test("a provider the user never linked is rejected", async () => {
  const { actions, calls } = fixture({ id: "u3", identities: [line] });
  assert.ok((await actions.setAvatarFromProvider("google")).error);
  assert.equal(calls.updated.length, 0);
});

test("a failed database write is reported, not claimed as success", async () => {
  const { actions, calls } = fixture({ id: "u4", identities: [line, google] }, { code: "500", message: "nope" });
  const result = await actions.setAvatarFromProvider("google");
  assert.ok(result.error);
  assert.equal(result.success, undefined);
  assert.equal(calls.revalidated.length, 0);
});
