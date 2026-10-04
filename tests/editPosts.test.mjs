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
function wantedDb({ post }) {
  const calls = { updates: [], inserts: [], filters: [] };
  return {
    calls,
    client: {
      from() {
        const filters = {};
        const chain = {
          select() { return chain; },
          eq(col, val) { filters[col] = val; return chain; },
          insert(v) { calls.inserts.push(v); return Promise.resolve({ error: null }); },
          update(v) { calls.updates.push(v); calls.filters.push(filters); return chain; },
          maybeSingle: async () => ({ data: post }),
          then(resolve) {
            // An update only "matches" a row that is the poster's own and still active.
            const hit = post && filters.poster_id === post.poster_id && (filters.status ? filters.status === post.status : true);
            resolve({ data: hit ? [{ id: "w1" }] : [], error: null });
          },
        };
        return chain;
      },
    },
  };
}

function wantedActions(userId, db) {
  const redirects = [];
  const actions = load("src/app/wanted/actions.ts", {
    "next/navigation": { redirect: (to) => { redirects.push(to); throw new Error("redirect:" + to); } },
    "next/cache": { revalidatePath() {} },
    "@/lib/supabase/server": { createServiceClient: () => db.client },
    "@/lib/session": { requireVerifiedUserId: async () => userId },
  });
  return { actions, redirects };
}

const form = (extra = {}) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ name: "Blaster", set: "BT01", category: "rare", maxPrice: "500", note: "n", ...extra })) fd.append(k, v);
  return fd;
};

test("the poster can edit their open post; the update is limited to their own, still-open row", async () => {
  const db = wantedDb({ post: { poster_id: "poster", status: "active" } });
  const { actions, redirects } = wantedActions("poster", db);
  await assert.rejects(actions.updateWantedPost("w1", form({ maxPrice: "900" })), /redirect:\/profile/);
  assert.equal(db.calls.updates[0].max_price, 900);
  assert.equal(db.calls.filters[0].poster_id, "poster");
  assert.equal(db.calls.filters[0].status, "active");
  assert.deepEqual(redirects, ["/profile"]);
});

test("someone else's post, a closed post, and invalid input are all refused", async () => {
  const stranger = wantedActions("other", wantedDb({ post: { poster_id: "poster", status: "active" } }));
  await assert.rejects(stranger.actions.updateWantedPost("w1", form()), /redirect:\/wanted\/w1\/edit\?error=1/);

  const closed = wantedActions("poster", wantedDb({ post: { poster_id: "poster", status: "closed" } }));
  await assert.rejects(closed.actions.updateWantedPost("w1", form()), /edit\?error=1/);

  const db = wantedDb({ post: { poster_id: "poster", status: "active" } });
  const bad = wantedActions("poster", db);
  for (const extra of [{ name: "" }, { category: "weird" }, { maxPrice: "0" }, { maxPrice: "abc" }, { note: "x".repeat(401) }, { name: "x".repeat(121) }]) {
    await assert.rejects(bad.actions.updateWantedPost("w1", form(extra)), /edit\?error=1/);
  }
  assert.equal(db.calls.updates.length, 0, "nothing is written for invalid input");
});

test("creating a wanted post uses the same checks", async () => {
  const db = wantedDb({ post: null });
  const { actions } = wantedActions("poster", db);
  await assert.rejects(actions.createWantedPost(form({ category: "weird" })), /\/wanted\/new\?error=1/);
  assert.equal(db.calls.inserts.length, 0);
  await assert.rejects(actions.createWantedPost(form()), /redirect:\/profile/);
  assert.equal(db.calls.inserts[0].poster_id, "poster");
  assert.equal(db.calls.inserts[0].max_price, 500);
});

test("only the poster can close their post, and only once", async () => {
  const ok = wantedDb({ post: { poster_id: "poster", status: "active" } });
  assert.equal((await wantedActions("poster", ok).actions.closeWantedPost("w1")).success, true);
  assert.equal(ok.calls.updates[0].status, "closed");

  const stranger = wantedActions("other", wantedDb({ post: { poster_id: "poster", status: "active" } }));
  assert.ok((await stranger.actions.closeWantedPost("w1")).error);

  const again = wantedActions("poster", wantedDb({ post: { poster_id: "poster", status: "closed" } }));
  assert.ok((await again.actions.closeWantedPost("w1")).error);
});

test("nobody can add messages to a closed post", async () => {
  const closed = wantedActions("resp", wantedDb({ post: { poster_id: "poster", status: "closed" } }));
  assert.match((await closed.actions.sendWantedPostMessage("w1", "resp", "hi")).error, /ปิดแล้ว/);

  const open = wantedDb({ post: { poster_id: "poster", status: "active" } });
  assert.equal((await wantedActions("resp", open).actions.sendWantedPostMessage("w1", "resp", "hi")).success, true);
  assert.equal(open.calls.inserts.length, 1);
});
