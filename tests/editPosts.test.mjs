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
    exports, Date, Math, String, Promise, Object, Array, Number, Uint8Array, File, Response, Request, FormData, crypto,
    require(name) {
      if (!(name in dependencies)) throw new Error("Unexpected dependency: " + name);
      return dependencies[name];
    },
  }, { filename: path });
  return exports;
}

const img = load("src/lib/imageUpload.ts");
const listingKind = load("src/lib/listingKind.ts");
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(12).fill(0)]);

// ---------- editing a listing ----------
function editRoute({ listing, bids = 0, userId = "seller" }) {
  const calls = { updates: [], uploads: [] };
  const supabase = {
    from(table) {
      const chain = {
        select() { return chain; },
        eq() { return chain; },
        update(v) { calls.updates.push(v); return chain; },
        maybeSingle: async () => ({ data: listing }),
        then(resolve) { resolve(table === "bids" ? { count: bids, error: null } : { error: null }); },
      };
      return chain;
    },
    storage: {
      from: () => ({
        upload: async (path) => { calls.uploads.push(path); return { error: null }; },
        getPublicUrl: (p) => ({ data: { publicUrl: "https://files.test/" + p } }),
      }),
    },
  };
  const route = load("src/app/api/listings/[id]/route.ts", {
    "next/server": { NextResponse: Response },
    "@/lib/session": { getVerifiedUserId: async () => userId },
    "@/lib/supabase/server": { createServiceClient: () => supabase },
    "@/lib/vanguard": { parseListingDetails: () => ({ ok: true, rarity: "RRR", quantity: 1, hasExtras: null }) },
    "@/lib/imageUpload": img,
    "@/lib/listingKind": listingKind,
  });
  return { route, calls };
}

function editRequest(extra = {}) {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ name: "Card", set: "BT01", category: "rare", condition: "NM", startPrice: "500", description: "d", ...extra })) fd.append(k, v);
  return new Request("https://tcs.test/api/listings/L1", { method: "PATCH", body: fd });
}

const params = { params: Promise.resolve({ id: "L1" }) };
const LISTING = { id: "L1", seller_id: "seller", status: "active", description: "old" };

test("a sold, cancelled or expired listing cannot be edited, even with no bids (buy-now sales have none)", async () => {
  for (const status of ["sold", "cancelled", "expired"]) {
    const { route, calls } = editRoute({ listing: { ...LISTING, status }, bids: 0 });
    const res = await route.PATCH(editRequest({ startPrice: "1" }), params);
    assert.equal(res.status, 409, status);
    assert.equal(calls.updates.length, 0, status);
  }
});

test("a pick-a-card post cannot be edited through this route", async () => {
  const { route, calls } = editRoute({ listing: { ...LISTING, post_kind: "spread" } });
  assert.equal((await route.PATCH(editRequest(), params)).status, 409);
  assert.equal(calls.updates.length, 0);
});

test("only the seller can edit, and an active listing with no bids can change everything including photos", async () => {
  const stranger = editRoute({ listing: LISTING, userId: "someone-else" });
  assert.equal((await stranger.route.PATCH(editRequest(), params)).status, 404);
  assert.equal(stranger.calls.updates.length, 0);

  const { route, calls } = editRoute({ listing: LISTING });
  const fd = new FormData();
  for (const [k, v] of Object.entries({ name: "New name", set: "BT02", category: "rare", condition: "NM", startPrice: "700", description: "d" })) fd.append(k, v);
  fd.append("front", new File([JPEG], "f.jpg", { type: "image/jpeg" }));
  const res = await route.PATCH(new Request("https://tcs.test/api/listings/L1", { method: "PATCH", body: fd }), params);
  assert.equal(res.status, 200);
  assert.equal(calls.updates[0].name, "New name");
  assert.equal(calls.updates[0].start_price, 700);
  assert.match(calls.updates[0].photo_front_url, /^https:\/\/files\.test\/L1\/front-/);
  assert.equal("photo_back_url" in calls.updates[0], false, "the back photo is untouched when no new one is sent");
});

test("once there is a bid, only the description changes and photos are ignored", async () => {
  const { route, calls } = editRoute({ listing: LISTING, bids: 2 });
  const fd = new FormData();
  fd.append("description", "new text");
  fd.append("name", "Hacked");
  fd.append("front", new File([JPEG], "f.jpg", { type: "image/jpeg" }));
  const res = await route.PATCH(new Request("https://tcs.test/api/listings/L1", { method: "PATCH", body: fd }), params);
  assert.equal(res.status, 200);
  assert.deepEqual(Object.keys(calls.updates[0]).sort(), ["description", "description_edited_at"]);
  assert.equal(calls.uploads.length, 0);
});

// ---------- "looking for" posts ----------
const wantedForm = load("src/lib/wantedForm.ts");
const wantedPhoto = load("src/lib/wantedPhoto.ts");

function wantedDb({ post }) {
  const calls = { updates: [], inserts: [], deletes: 0, uploads: [], filters: [] };
  const client = {
    from() {
      const filters = {};
      let mode = "select";
      const chain = {
        select() { return chain; },
        eq(col, val) { filters[col] = val; return chain; },
        insert(v) { calls.inserts.push(v); mode = "insert"; return chain; },
        update(v) { calls.updates.push(v); calls.filters.push(filters); mode = "update"; return chain; },
        delete() { calls.deletes++; mode = "delete"; return chain; },
        single: async () => ({ data: { id: "w-new" }, error: null }),
        maybeSingle: async () => ({ data: post }),
        then(resolve) {
          if (mode === "update") {
            // An update only "matches" a row that is the poster's own and still active.
            const hit = post && filters.poster_id === post.poster_id && (filters.status ? filters.status === post.status : true);
            return resolve({ data: hit ? [{ id: "w1" }] : [], error: null });
          }
          resolve({ data: [], error: null });
        },
      };
      return chain;
    },
    storage: {
      from: () => ({
        upload: async (path, _bytes, opts) => { calls.uploads.push({ path, opts }); return { error: null }; },
        getPublicUrl: (p) => ({ data: { publicUrl: "https://files.test/" + p } }),
      }),
    },
  };
  return { calls, client };
}

function wantedRoutes(userId, db) {
  const deps = {
    "next/server": { NextResponse: Response },
    "next/cache": { revalidatePath() {} },
    "@/lib/supabase/server": { createServiceClient: () => db.client },
    "@/lib/session": { getVerifiedUserId: async () => userId },
    "@/lib/wantedForm": wantedForm,
    "@/lib/imageUpload": img,
    "@/lib/wantedPhoto": wantedPhoto,
  };
  return { create: load("src/app/api/wanted/route.ts", deps), edit: load("src/app/api/wanted/[id]/route.ts", deps) };
}

function wantedRequest(extra = {}, method = "POST") {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ name: "Blaster", set: "BT01", category: "rare", maxPrice: "500", note: "n", ...extra })) {
    if (v !== null) fd.append(k, v);
  }
  return new Request("https://tcs.test/api/wanted", { method, body: fd });
}
const jpeg = () => new File([JPEG], "c.jpg", { type: "image/jpeg" });
const post = (status = "active") => ({ poster_id: "poster", status });

test("a wanted post is created from valid input, and the form checks are strict", async () => {
  const db = wantedDb({ post: null });
  const { create } = wantedRoutes("poster", db);
  const res = await create.POST(wantedRequest());
  assert.equal(res.status, 200);
  assert.equal((await res.json()).id, "w-new");
  assert.equal(db.calls.inserts[0].poster_id, "poster");
  assert.equal(db.calls.inserts[0].max_price, 500);
  assert.equal(db.calls.uploads.length, 0, "a photo is optional");

  for (const extra of [{ name: "" }, { category: "weird" }, { maxPrice: "0" }, { maxPrice: "abc" }, { note: "x".repeat(401) }, { name: "x".repeat(121) }]) {
    const bad = wantedDb({ post: null });
    assert.equal((await wantedRoutes("poster", bad).create.POST(wantedRequest(extra))).status, 400);
    assert.equal(bad.calls.inserts.length, 0, "nothing is created for invalid input");
  }
  const signedOut = wantedRoutes(null, wantedDb({ post: null }));
  assert.equal((await signedOut.create.POST(wantedRequest())).status, 403);
});

test("a reference photo is stored under wanted/<id>/ and linked to the post; a fake image creates nothing", async () => {
  const db = wantedDb({ post: null });
  const res = await wantedRoutes("poster", db).create.POST(wantedRequest({ photo: jpeg() }));
  assert.equal(res.status, 200);
  assert.match(db.calls.uploads[0].path, /^wanted\/w-new\/photo-[0-9a-f-]+\.jpg$/);
  assert.equal(db.calls.uploads[0].opts.contentType, "image/jpeg");
  assert.match(db.calls.updates[0].photo_url, /^https:\/\/files\.test\/wanted\/w-new\//);

  const fake = wantedDb({ post: null });
  const bad = await wantedRoutes("poster", fake).create.POST(wantedRequest({ photo: new File(["<svg onload=alert(1)>............"], "c.jpg", { type: "image/jpeg" }) }));
  assert.equal(bad.status, 400);
  assert.equal(fake.calls.inserts.length, 0);
  assert.equal(fake.calls.uploads.length, 0);
});

test("the poster can edit their open post and replace its photo; the update is limited to their own open row", async () => {
  const db = wantedDb({ post: post() });
  const { edit } = wantedRoutes("poster", db);
  const res = await edit.PATCH(wantedRequest({ maxPrice: "900", photo: jpeg() }, "PATCH"), { params: Promise.resolve({ id: "w1" }) });
  assert.equal(res.status, 200);
  assert.equal(db.calls.updates[0].max_price, 900);
  assert.match(db.calls.updates[0].photo_url, /wanted\/w1\//);
  assert.equal(db.calls.filters[0].poster_id, "poster");
  assert.equal(db.calls.filters[0].status, "active");

  const keep = wantedDb({ post: post() });
  await wantedRoutes("poster", keep).edit.PATCH(wantedRequest({}, "PATCH"), { params: Promise.resolve({ id: "w1" }) });
  assert.equal("photo_url" in keep.calls.updates[0], false, "no new photo keeps the current one");
});

test("someone else's post, a closed post, and invalid input are all refused when editing", async () => {
  const params = { params: Promise.resolve({ id: "w1" }) };
  const stranger = wantedDb({ post: post() });
  assert.equal((await wantedRoutes("other", stranger).edit.PATCH(wantedRequest({}, "PATCH"), params)).status, 404);
  assert.equal(stranger.calls.updates.length, 0);

  const closed = wantedDb({ post: post("closed") });
  assert.equal((await wantedRoutes("poster", closed).edit.PATCH(wantedRequest({}, "PATCH"), params)).status, 409);
  assert.equal(closed.calls.updates.length, 0);

  const bad = wantedDb({ post: post() });
  assert.equal((await wantedRoutes("poster", bad).edit.PATCH(wantedRequest({ category: "weird" }, "PATCH"), params)).status, 400);
  assert.equal(bad.calls.updates.length, 0);
});

function wantedActions(userId, db) {
  return load("src/app/wanted/actions.ts", {
    "next/cache": { revalidatePath() {} },
    "@/lib/supabase/server": { createServiceClient: () => db.client },
    "@/lib/session": { requireVerifiedUserId: async () => userId },
  });
}

test("only the poster can close their post, and only once", async () => {
  const ok = wantedDb({ post: post() });
  assert.equal((await wantedActions("poster", ok).closeWantedPost("w1")).success, true);
  assert.equal(ok.calls.updates[0].status, "closed");

  assert.ok((await wantedActions("other", wantedDb({ post: post() })).closeWantedPost("w1")).error);
  assert.ok((await wantedActions("poster", wantedDb({ post: post("closed") })).closeWantedPost("w1")).error);
});

test("nobody can add messages to a closed post", async () => {
  assert.match((await wantedActions("resp", wantedDb({ post: post("closed") })).sendWantedPostMessage("w1", "resp", "hi")).error, /ปิดแล้ว/);

  const open = wantedDb({ post: post() });
  assert.equal((await wantedActions("resp", open).sendWantedPostMessage("w1", "resp", "hi")).success, true);
  assert.equal(open.calls.inserts.length, 1);
});
