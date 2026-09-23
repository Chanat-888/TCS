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
    exports, URL,
    require(name) {
      if (!(name in dependencies)) throw new Error("Unexpected dependency: " + name);
      return dependencies[name];
    },
  }, { filename: path });
  return exports;
}

function fixture({
  user = { id: "u1" },
  ordersCount = 0,
  activeListingsCount = 0,
  bidRows = [],
  activeBidListingsCount = 0,
  avatarUrl = null,
  anonymizeError = null,
  deleteAuthError = null,
  isAdminFlag = false,
  verifiedFlag = false,
  tier = null,
} = {}) {
  const calls = { profileUpdated: [], addressesDeleted: [], storageRemoved: [], authUserDeleted: [], signedOut: [] };
  const actions = load("src/app/profile/deleteAccountActions.ts", {
    "@/lib/authLog": { logAuthError: () => {} },
    "@/lib/avatar": { AVATAR_STORAGE_PATH_PREFIX: "/storage/v1/object/public/avatars/" },
    "@/lib/profileName": { DELETED_DISPLAY_NAME: "ผู้ใช้ที่ถูกลบ" },
    "@/lib/supabase/server": {
      createAuthClient: async () => ({
        auth: {
          getUser: async () => ({ data: { user } }),
          signOut: async (opts) => { calls.signedOut.push(opts); return { error: null }; },
        },
      }),
      createServiceClient: () => ({
        from(table) {
          if (table === "orders") {
            return { select: () => ({ or: () => ({ in: async () => ({ count: ordersCount }) }) }) };
          }
          if (table === "listings") {
            return {
              select: () => ({
                eq: () => ({ eq: async () => ({ count: activeListingsCount }) }),
                in: () => ({ eq: async () => ({ count: activeBidListingsCount }) }),
              }),
            };
          }
          if (table === "bids") {
            return { select: () => ({ eq: async () => ({ data: bidRows }) }) };
          }
          if (table === "profile_addresses") {
            return { delete: () => ({ eq: async (col, val) => { calls.addressesDeleted.push(val); return { error: null }; } }) };
          }
          if (table === "profiles") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: { avatar_url: avatarUrl, is_admin: isAdminFlag, verified: verifiedFlag, tier } }),
                }),
              }),
              update: (fields) => ({
                eq: async (col, val) => { calls.profileUpdated.push({ fields, col, val }); return { error: anonymizeError }; },
              }),
            };
          }
          throw new Error("Unexpected table: " + table);
        },
        storage: {
          from: () => ({
            remove: async (paths) => { calls.storageRemoved.push(paths); return { error: null }; },
          }),
        },
        auth: {
          admin: {
            deleteUser: async (id) => { calls.authUserDeleted.push(id); return { error: deleteAuthError }; },
          },
        },
      }),
    },
  });
  return { actions, calls };
}

test("signed-out callers cannot check blockers or delete anything", async () => {
  const { actions, calls } = fixture({ user: null });
  const check = await actions.getAccountDeletionBlockers();
  assert.ok("error" in check);
  const del = await actions.deleteMyAccount();
  assert.ok("error" in del);
  assert.equal(calls.profileUpdated.length, 0);
  assert.equal(calls.authUserDeleted.length, 0);
});

test("an open order, an active listing, and an active bid are each reported as blockers", async () => {
  for (const options of [
    { ordersCount: 1 },
    { activeListingsCount: 1 },
    { bidRows: [{ listing_id: "l1" }], activeBidListingsCount: 1 },
  ]) {
    const { actions } = fixture(options);
    const check = await actions.getAccountDeletionBlockers();
    assert.ok(!("error" in check));
    assert.equal(check.blockers.length, 1, JSON.stringify(options));
  }
});

test("deletion is refused while blocked, and nothing is touched", async () => {
  const { actions, calls } = fixture({ ordersCount: 1 });
  const result = await actions.deleteMyAccount();
  assert.ok(result.error);
  assert.equal(result.blockers.length, 1);
  assert.equal(calls.profileUpdated.length, 0);
  assert.equal(calls.addressesDeleted.length, 0);
  assert.equal(calls.authUserDeleted.length, 0);
});

test("a bid on a listing that has since closed is not a blocker", async () => {
  const { actions } = fixture({ bidRows: [{ listing_id: "l1" }], activeBidListingsCount: 0 });
  const check = await actions.getAccountDeletionBlockers();
  assert.deepEqual(JSON.parse(JSON.stringify(check.blockers)), []);
});

test("an admin, verified, or tiered account is warned that the status will not transfer, but is not blocked", async () => {
  for (const options of [{ isAdminFlag: true }, { verifiedFlag: true }, { tier: "gold" }]) {
    const { actions } = fixture(options);
    const check = await actions.getAccountDeletionBlockers();
    assert.equal(check.blockers.length, 0, JSON.stringify(options));
    assert.equal(check.warnings.length, 1, JSON.stringify(options));
  }
});

test("a plain account gets no warnings at all", async () => {
  const { actions } = fixture();
  const check = await actions.getAccountDeletionBlockers();
  assert.deepEqual(JSON.parse(JSON.stringify(check.warnings)), []);
});

test("a clean account is anonymized, its address book and own uploaded photo removed, and its login deleted", async () => {
  const { actions, calls } = fixture({ user: { id: "u1" }, avatarUrl: "https://project.supabase.co/storage/v1/object/public/avatars/u1/photo.jpg" });
  const result = await actions.deleteMyAccount();
  assert.equal(result.success, true);

  assert.deepEqual(JSON.parse(JSON.stringify(calls.addressesDeleted)), ["u1"]);
  assert.deepEqual(JSON.parse(JSON.stringify(calls.storageRemoved)), [["u1/photo.jpg"]]);

  assert.equal(calls.profileUpdated.length, 1);
  const fields = calls.profileUpdated[0].fields;
  assert.equal(fields.display_name, "ผู้ใช้ที่ถูกลบ");
  assert.equal(fields.phone, null);
  assert.equal(fields.avatar_url, null);
  assert.equal(fields.bio, "");
  assert.ok(fields.deleted_at);
  assert.equal(calls.profileUpdated[0].val, "u1");

  assert.deepEqual(JSON.parse(JSON.stringify(calls.authUserDeleted)), ["u1"]);
  assert.equal(calls.signedOut.length, 1);
});

test("a LINE/Google photo (not our own upload) is left alone", async () => {
  const { actions, calls } = fixture({ avatarUrl: "https://profile.line-scdn.net/abc" });
  const result = await actions.deleteMyAccount();
  assert.equal(result.success, true);
  assert.equal(calls.storageRemoved.length, 0);
});

test("no avatar at all means nothing is removed from storage", async () => {
  const { actions, calls } = fixture({ avatarUrl: null });
  const result = await actions.deleteMyAccount();
  assert.equal(result.success, true);
  assert.equal(calls.storageRemoved.length, 0);
});

test("someone else's uploaded file under a different user id is never removed", async () => {
  const { actions, calls } = fixture({ user: { id: "u1" }, avatarUrl: "https://project.supabase.co/storage/v1/object/public/avatars/someone-else/photo.jpg" });
  const result = await actions.deleteMyAccount();
  assert.equal(result.success, true);
  assert.equal(calls.storageRemoved.length, 0);
});

test("a failed anonymize update is reported and the Auth login is never removed", async () => {
  const { actions, calls } = fixture({ anonymizeError: { message: "boom" } });
  const result = await actions.deleteMyAccount();
  assert.ok(result.error);
  assert.equal(calls.authUserDeleted.length, 0);
});

test("if removing the Auth login fails, that failure is reported rather than claiming full success", async () => {
  const { actions } = fixture({ deleteAuthError: { message: "boom" } });
  const result = await actions.deleteMyAccount();
  assert.ok(result.error);
  assert.equal(result.success, undefined);
});
