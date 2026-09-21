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
    exports, console,
    require(name) {
      if (!(name in dependencies)) throw new Error("Unexpected dependency: " + name);
      return dependencies[name];
    },
  }, { filename: path });
  return exports;
}
const names = load("src/lib/profileName.ts");

test("display names are trimmed, collapsed and length-limited", () => {
  assert.equal(names.cleanDisplayName("  สมชาย   ใจดี "), "สมชาย ใจดี");
  assert.equal(names.cleanDisplayName("ab"), "ab");
  for (const bad of ["", " a ", "x".repeat(31), null, undefined, 42, {}]) {
    assert.equal(names.cleanDisplayName(bad), null);
  }
});
test("invisible and bidi characters cannot be used to spoof a name", () => {
  assert.equal(names.cleanDisplayName("Ad\u200Bmin"), "Admin");
  assert.equal(names.cleanDisplayName("\u202Eevil"), "evil");
  assert.equal(names.cleanDisplayName("a\u0000b"), "ab");
  assert.equal(names.cleanDisplayName("\u200B\u200B\u200B"), null);
});
test("bio keeps line breaks but strips control characters and enforces the limit", () => {
  assert.equal(names.cleanBio("  สวัสดี\r\n\r\n\r\n\r\nขายการ์ด\u200B "), "สวัสดี\n\nขายการ์ด");
  assert.equal(names.cleanBio(""), "");
  assert.equal(names.cleanBio("x".repeat(200)).length, 200);
  assert.equal(names.cleanBio("x".repeat(201)), null);
  assert.equal(names.cleanBio(null), null);
});
test("avatar initial skips Thai leading vowels", () => {
  assert.equal(names.avatarInitial("เก็บการ์ด"), "ก");
  assert.equal(names.avatarInitial("แพน"), "พ");
  assert.equal(names.avatarInitial("pan"), "P");
  assert.equal(names.avatarInitial("เ"), "เ");
});

function actionFixture({ userId = "user-1", updateError = null } = {}) {
  const calls = [];
  const actions = load("src/app/profile/actions.ts", {
    "next/cache": { revalidatePath: (path) => calls.push(["revalidate", path]) },
    "@/lib/session": { getSessionUserId: async () => userId },
    "@/lib/profileName": names,
    "@/lib/supabase/server": {
      createServiceClient: () => ({
        from: (table) => ({
          update: (values) => ({
            eq: async (column, id) => { calls.push(["update", table, values, column, id]); return { error: updateError }; },
          }),
        }),
      }),
    },
  });
  return { actions, calls };
}
test("profile update writes only name, initial and bio for the session user", async () => {
  const { actions, calls } = actionFixture();
  const result = await actions.updateProfile("  เก็บการ์ด ", "ขายการ์ด Vanguard");
  assert.equal(result.success, true);
  const update = calls.find(([type]) => type === "update");
  assert.deepEqual(JSON.parse(JSON.stringify(update[2])), { display_name: "เก็บการ์ด", avatar_initial: "ก", bio: "ขายการ์ด Vanguard" });
  assert.deepEqual([update[3], update[4]], ["id", "user-1"]);
  assert.ok(calls.some(([type, path]) => type === "revalidate" && path === "/profile/user-1"));
});
test("profile update refuses anonymous callers and invalid input before touching the database", async () => {
  const anonymous = actionFixture({ userId: null });
  assert.ok((await anonymous.actions.updateProfile("Valid Name", "")).error);
  assert.equal(anonymous.calls.length, 0);
  const invalid = actionFixture();
  assert.ok((await invalid.actions.updateProfile("a", "")).error);
  assert.ok((await invalid.actions.updateProfile("Valid Name", "x".repeat(201))).error);
  assert.equal(invalid.calls.length, 0);
});
test("profile update reports database failures without claiming success", async () => {
  const { actions } = actionFixture({ updateError: { code: "XX000" } });
  const result = await actions.updateProfile("Valid Name", "");
  assert.ok(result.error);
  assert.equal(result.success, undefined);
});
