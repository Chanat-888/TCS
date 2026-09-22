import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const PNG_BYTES = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const TEXT_BYTES = Uint8Array.from(Buffer.from("<script>alert(1)</script>"));
const BUCKET_PREFIX = "https://upzvnvcseiibxsfsbcnj.supabase.co/storage/v1/object/public/avatars/";

function load(path, dependencies = {}) {
  const code = ts.transpileModule(readFileSync(new URL("../" + path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports, URL, File, crypto,
    require(name) {
      if (!(name in dependencies)) throw new Error("Unexpected dependency: " + name);
      return dependencies[name];
    },
  }, { filename: path });
  return exports;
}

function fixture({ user, previousAvatarUrl = null, uploadError = null, updateError = null, trustResult } = {}) {
  const calls = { uploaded: [], removed: [], updated: [] };
  const actions = load("src/app/profile/accountActions.ts", {
    "next/cache": { revalidatePath() {} },
    "@/lib/authLog": { logAuthError() {} },
    "@/lib/avatar": {
      avatarFromIdentity: () => null,
      AVATAR_STORAGE_PATH_PREFIX: "/storage/v1/object/public/avatars/",
      trustedAvatarUrl: (u) => (trustResult !== undefined ? trustResult : (typeof u === "string" && u.startsWith(BUCKET_PREFIX) ? u : null)),
    },
    "@/lib/supabase/server": {
      createAuthClient: async () => ({ auth: { getUser: async () => ({ data: { user }, error: null }) } }),
      createServiceClient: () => ({
        storage: {
          from: (bucket) => ({
            upload: async (path, bytes, opts) => {
              calls.uploaded.push({ bucket, path, opts });
              return { error: uploadError };
            },
            getPublicUrl: (path) => ({ data: { publicUrl: `https://upzvnvcseiibxsfsbcnj.supabase.co/storage/v1/object/public/${bucket}/${path}` } }),
            remove: async (paths) => {
              calls.removed.push({ bucket, paths });
              return { error: null };
            },
          }),
        },
        from: () => ({
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { avatar_url: previousAvatarUrl } }) }) }),
          update: (fields) => ({
            eq: async (col, val) => {
              calls.updated.push({ fields, col, val });
              return { error: updateError };
            },
          }),
        }),
      }),
    },
  });
  return { actions, calls };
}

function formDataWith(bytes, name = "avatar.png") {
  const formData = new FormData();
  formData.set("avatar", new File([bytes], name));
  return formData;
}

test("uploads a real PNG under the user's own folder and points the profile at the sniffed content type", async () => {
  const { actions, calls } = fixture({ user: { id: "u1" } });
  const result = await actions.uploadAvatar(formDataWith(PNG_BYTES));
  assert.equal(result.success, true);
  assert.equal(calls.uploaded.length, 1);
  assert.equal(calls.uploaded[0].bucket, "avatars");
  assert.ok(calls.uploaded[0].path.startsWith("u1/"), calls.uploaded[0].path);
  assert.equal(calls.uploaded[0].opts.contentType, "image/png");
  assert.equal(calls.updated.length, 1);
  assert.ok(calls.updated[0].fields.avatar_url.startsWith(BUCKET_PREFIX));
});

test("signed-out callers cannot upload anything", async () => {
  const { actions, calls } = fixture({ user: null });
  const result = await actions.uploadAvatar(formDataWith(PNG_BYTES));
  assert.ok(result.error);
  assert.equal(calls.uploaded.length, 0);
});

test("a request with no file is rejected before touching storage", async () => {
  const { actions, calls } = fixture({ user: { id: "u1" } });
  const result = await actions.uploadAvatar(new FormData());
  assert.ok(result.error);
  assert.equal(calls.uploaded.length, 0);
});

test("an oversized file is rejected before its bytes are read or uploaded", async () => {
  const { actions, calls } = fixture({ user: { id: "u1" } });
  const big = new File([PNG_BYTES], "big.png");
  Object.defineProperty(big, "size", { value: 6 * 1024 * 1024 });
  const formData = new FormData();
  formData.set("avatar", big);
  const result = await actions.uploadAvatar(formData);
  assert.ok(result.error);
  assert.equal(calls.uploaded.length, 0);
});

test("a file's declared name and type are never trusted — only its real bytes decide the format", async () => {
  const { actions, calls } = fixture({ user: { id: "u1" } });
  const disguised = new File([TEXT_BYTES], "photo.png", { type: "image/png" });
  const formData = new FormData();
  formData.set("avatar", disguised);
  const result = await actions.uploadAvatar(formData);
  assert.ok(result.error);
  assert.equal(calls.uploaded.length, 0);
});

test("a storage failure is reported and the profile is never updated", async () => {
  const { actions, calls } = fixture({ user: { id: "u1" }, uploadError: { message: "boom" } });
  const result = await actions.uploadAvatar(formDataWith(PNG_BYTES));
  assert.ok(result.error);
  assert.equal(calls.updated.length, 0);
});

test("a missing storage bucket is reported as a setup problem, not a generic retry", async () => {
  const { actions } = fixture({ user: { id: "u1" }, uploadError: { message: "Bucket not found" } });
  const result = await actions.uploadAvatar(formDataWith(PNG_BYTES));
  assert.match(result.error, /ยังไม่พร้อมใช้งาน/);
});

test("if the uploaded file's own URL fails the trusted-host check, it is deleted and never saved", async () => {
  const { actions, calls } = fixture({ user: { id: "u1" }, trustResult: null });
  const result = await actions.uploadAvatar(formDataWith(PNG_BYTES));
  assert.ok(result.error);
  assert.equal(calls.updated.length, 0);
  assert.equal(calls.removed.length, 1);
  assert.equal(calls.removed[0].bucket, "avatars");
});

test("if saving the new avatar_url fails, the just-uploaded file is cleaned up", async () => {
  const { actions, calls } = fixture({ user: { id: "u1" }, updateError: { code: "500" } });
  const result = await actions.uploadAvatar(formDataWith(PNG_BYTES));
  assert.ok(result.error);
  assert.equal(calls.removed.length, 1);
});

test("a previous upload of this user's own is deleted after a successful replace", async () => {
  const previous = `${BUCKET_PREFIX}u1/old-file.png`;
  const { actions, calls } = fixture({ user: { id: "u1" }, previousAvatarUrl: previous });
  const result = await actions.uploadAvatar(formDataWith(PNG_BYTES));
  assert.equal(result.success, true);
  assert.equal(calls.removed.length, 1);
  assert.equal(calls.removed[0].paths[0], "u1/old-file.png");
});

test("a previous photo that isn't one of this user's own uploads is never deleted", async () => {
  for (const previous of [
    "https://profile.line-scdn.net/0hAbCdEf/preview",
    `${BUCKET_PREFIX}someone-else/old-file.png`,
  ]) {
    const { actions, calls } = fixture({ user: { id: "u1" }, previousAvatarUrl: previous });
    const result = await actions.uploadAvatar(formDataWith(PNG_BYTES));
    assert.equal(result.success, true);
    assert.equal(calls.removed.length, 0, previous);
  }
});
