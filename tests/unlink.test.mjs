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

function fixture(user, unlinkError = null) {
  const calls = { unlinked: [], revalidated: [], logged: [] };
  const actions = load("src/app/profile/accountActions.ts", {
    "next/cache": { revalidatePath: (path) => calls.revalidated.push(path) },
    "@/lib/authLog": { logAuthError: (scope) => calls.logged.push(scope) },
    "@/lib/avatar": { avatarFromIdentity: () => null },
    "@/lib/supabase/server": {
      createAuthClient: async () => ({
        auth: {
          getUser: async () => ({ data: { user }, error: null }),
          unlinkIdentity: async (identity) => { calls.unlinked.push(identity); return { error: unlinkError }; },
        },
      }),
      createServiceClient: () => { throw new Error("setAvatarFromProvider must not run in these tests"); },
    },
  });
  return { actions, calls };
}

const line = { provider: "custom:line", identity_id: "line-1" };
const google = { provider: "google", identity_id: "google-1" };

test("unlinks the Google identity found on the server-side user, not one sent by the client", async () => {
  const { actions, calls } = fixture({ id: "u1", identities: [line, google] });
  const result = await actions.unlinkGoogle("attacker-supplied-identity");
  assert.equal(result.success, true);
  assert.deepEqual(JSON.parse(JSON.stringify(calls.unlinked)), [google]);
  assert.ok(calls.revalidated.includes("/profile/u1"));
});

test("signed-out callers cannot unlink anything", async () => {
  const { actions, calls } = fixture(null);
  assert.ok((await actions.unlinkGoogle()).error);
  assert.equal(calls.unlinked.length, 0);
});

test("the only remaining sign-in method is never removed", async () => {
  const { actions, calls } = fixture({ id: "u2", identities: [google] });
  assert.ok((await actions.unlinkGoogle()).error);
  assert.equal(calls.unlinked.length, 0);
});

test("an account with no Google identity reports it and unlinks nothing", async () => {
  const { actions, calls } = fixture({ id: "u3", identities: [line, { provider: "phone" }] });
  assert.ok((await actions.unlinkGoogle()).error);
  assert.equal(calls.unlinked.length, 0);
});

test("a failed unlink is reported and logged, not claimed as success", async () => {
  const { actions, calls } = fixture({ id: "u4", identities: [line, google] }, { code: "identity_not_found", message: "nope" });
  const result = await actions.unlinkGoogle();
  assert.ok(result.error);
  assert.equal(result.success, undefined);
  assert.equal(calls.logged.length, 1);
  assert.equal(calls.revalidated.length, 0);
});
