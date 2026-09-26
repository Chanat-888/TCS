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
    Date,
    Promise,
    File,
    Uint8Array,
    String,
    Math,
    crypto,
    require(name) {
      if (!(name in dependencies)) throw new Error("Unexpected dependency: " + name);
      return dependencies[name];
    },
  }, { filename: path });
  return exports;
}

const plain = (x) => JSON.parse(JSON.stringify(x));

// A tiny Supabase stand-in: reads return the given rows; every guarded update is
// recorded with its filters and answers with the rows configured for that table.
function makeDb({ orders = null, disputes = null, claim = {}, viewer = { is_admin: true }, storageFails = false } = {}) {
  const calls = { updates: [], inserts: [], uploads: [], removed: [] };
  const client = {
    storage: {
      from: () => ({
        upload: async (path, _bytes, opts) => {
          calls.uploads.push({ path, opts });
          return { error: storageFails ? { message: "x" } : null };
        },
        remove: async (paths) => { calls.removed.push(...paths); return {}; },
        getPublicUrl: (path) => ({ data: { publicUrl: "https://files.test/" + path } }),
      }),
    },
    from(table) {
      const filters = {};
      let mode = "select";
      let values = null;
      const rowsFor = () => (table === "orders" ? orders : table === "disputes" ? disputes : table === "profiles" ? viewer : null);
      const chain = {
        select() { return chain; },
        insert(v) { mode = "insert"; values = v; return chain; },
        update(v) { mode = "update"; values = v; return chain; },
        eq(col, val) { filters[col] = val; return chain; },
        in(col, val) { filters[col] = val; return chain; },
        is(col, val) { filters[col] = val; return chain; },
        maybeSingle: async () => ({ data: rowsFor(), error: null }),
        single: async () => ({ data: rowsFor(), error: null }),
        then(resolve) {
          if (mode === "insert") calls.inserts.push({ table, values });
          if (mode === "update") calls.updates.push({ table, values, filters });
          const rows = mode === "update" ? (claim[table] ?? [{ id: "row" }]) : null;
          resolve({ data: rows, error: null });
        },
      };
      return chain;
    },
  };
  return { client, calls };
}

const session = (userId) => ({
  requireVerifiedUserId: async () => userId,
  getVerifiedUserId: async () => userId,
  getSessionUserId: async () => userId,
});
const noop = { revalidatePath() {} };

// ---------- video validation ----------
const video = load("src/lib/videoUpload.ts");
const bytes = (s) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));
const mp4 = () => bytes("\0\0\0\x20ftypisom\0\0\0\0");
const mov = () => bytes("\0\0\0\x14ftypqt  \0\0\0\0");

test("only real MP4/MOV bytes are accepted, whatever the file claims to be", () => {
  assert.equal(video.sniffVideoType(mp4()).ext, "mp4");
  assert.equal(video.sniffVideoType(mov()).contentType, "video/quicktime");
  assert.equal(video.sniffVideoType(bytes("\0\0\0\x20moov\0\0\0\0\0\0\0\0")).ext, "mov");
  assert.equal(video.sniffVideoType(bytes("<html><script>alert(1)</script>")), null);
  assert.equal(video.sniffVideoType(bytes("GIF89a......ftyp")), null);
  assert.equal(video.sniffVideoType(bytes("short")), null);
});

test("an oversized or empty file is rejected before its bytes are read", async () => {
  const empty = await video.checkVideoFile(new File([], "a.mp4", { type: "video/mp4" }));
  assert.equal(empty.ok, false);
  const fake = await video.checkVideoFile(new File(["not a video at all, just text"], "evil.mp4", { type: "video/mp4" }));
  assert.equal(fake.ok, false);
  const good = await video.checkVideoFile(new File([mp4()], "clip.bin", { type: "text/html" }));
  assert.equal(good.ok, true);
  assert.equal(good.type.contentType, "video/mp4");
});

// ---------- buyer unboxing video route ----------
function buyerRoute(order, opts) {
  const db = makeDb({ orders: order, ...opts });
  const route = load("src/app/api/orders/[id]/video/route.ts", {
    "next/server": { NextResponse: Response },
    "@/lib/session": session("buyer"),
    "@/lib/supabase/server": { createServiceClient: () => db.client },
    "@/lib/videoUpload": video,
  });
  return { route, db };
}
const upload = (bytesArr, name = "clip.mp4") => {
  const fd = new FormData();
  fd.append("video", new File([bytesArr], name, { type: "video/mp4" }));
  return new Request("https://tcs.test/api/orders/o/video", { method: "POST", body: fd });
};
const params = { params: Promise.resolve({ id: "o" }) };
const SHIPPED = { id: "o", buyer_id: "buyer", seller_id: "seller", status: "SHIPPED", unboxing_video_url: null };

test("the unboxing video is recorded once: a second upload cannot replace it or reset the timer", async () => {
  const { route, db } = buyerRoute({ ...SHIPPED, status: "DELIVERED", unboxing_video_url: "https://files.test/v.mp4" });
  const res = await route.POST(upload(mp4()), params);
  assert.equal(res.status, 409);
  assert.equal(db.calls.uploads.length, 0);
  assert.equal(db.calls.updates.length, 0);
});

test("a non-video upload is refused and nothing is stored", async () => {
  const { route, db } = buyerRoute(SHIPPED);
  const res = await route.POST(upload(bytes("<script>alert(1)</script>........"), "x.mp4"), params);
  assert.equal(res.status, 400);
  assert.equal(db.calls.uploads.length, 0);
});

test("a valid unboxing video uploads to a fresh path with a sniffed type and claims the order atomically", async () => {
  const { route, db } = buyerRoute(SHIPPED);
  const res = await route.POST(upload(mp4(), "../../weird name.exe"), params);
  assert.equal(res.status, 200);
  assert.match(db.calls.uploads[0].path, /^o\/unboxing-[0-9a-f-]+\.mp4$/);
  assert.equal(db.calls.uploads[0].opts.contentType, "video/mp4");
  const update = db.calls.updates[0];
  assert.equal(update.values.status, "DELIVERED");
  assert.equal(update.filters.status, "SHIPPED");
  assert.equal(update.filters.unboxing_video_url, null);
});

test("if another upload wins the race, the losing file is removed and the request is refused", async () => {
  const { route, db } = buyerRoute(SHIPPED, { claim: { orders: [] } });
  const res = await route.POST(upload(mp4()), params);
  assert.equal(res.status, 409);
  assert.equal(db.calls.removed.length, 1);
});

// ---------- seller packing video route ----------
function sellerRoute(order) {
  const db = makeDb({ orders: order });
  const route = load("src/app/api/orders/[id]/packing-video/route.ts", {
    "next/server": { NextResponse: Response },
    "@/lib/session": session("seller"),
    "@/lib/supabase/server": { createServiceClient: () => db.client },
    "@/lib/videoUpload": video,
  });
  return { route, db };
}
const PAID_ORDER = { id: "o", buyer_id: "buyer", seller_id: "seller", status: "PAID_HELD" };

test("the seller can upload a packing video only before shipping", async () => {
  const ok = sellerRoute(PAID_ORDER);
  const res = await ok.route.POST(upload(mov(), "pack.mov"), params);
  assert.equal(res.status, 200);
  assert.match(ok.db.calls.uploads[0].path, /^o\/packing-[0-9a-f-]+\.mov$/);
  assert.equal(ok.db.calls.updates[0].filters.status, "PAID_HELD");
  assert.ok(ok.db.calls.updates[0].values.packing_video_url);

  const late = sellerRoute({ ...PAID_ORDER, status: "SHIPPED" });
  assert.equal((await late.route.POST(upload(mp4()), params)).status, 400);
  assert.equal(late.db.calls.uploads.length, 0);
});

test("only the seller of the order can upload its packing video, and it must be a real video", async () => {
  const stranger = sellerRoute({ ...PAID_ORDER, seller_id: "someone-else" });
  assert.equal((await stranger.route.POST(upload(mp4()), params)).status, 404);
  const fake = sellerRoute(PAID_ORDER);
  assert.equal((await fake.route.POST(upload(bytes("plain text file............")), params)).status, 400);
  assert.equal(fake.db.calls.uploads.length, 0);
});

// ---------- shipping needs the seller's video ----------
function sellerActions(order, opts) {
  const db = makeDb({ orders: order, ...opts });
  const actions = load("src/app/orders/[id]/seller/actions.ts", {
    "next/cache": noop,
    "@/lib/supabase/server": { createServiceClient: () => db.client },
    "@/lib/session": session("seller"),
  });
  return { actions, db };
}

test("shipping and meet-up hand-over are refused until the seller has uploaded a packing video", async () => {
  const ship = sellerActions({ ...PAID_ORDER, delivery_method: "ship" });
  assert.ok((await ship.actions.confirmShipment("o", "Flash Express", "TH1")).error);
  assert.equal(ship.db.calls.updates.length, 0);

  const meet = sellerActions({ ...PAID_ORDER, delivery_method: "meetup" });
  assert.ok((await meet.actions.confirmHandover("o")).error);
  assert.equal(meet.db.calls.updates.length, 0);

  const withVideo = sellerActions({ ...PAID_ORDER, delivery_method: "ship", packing_video_url: "https://files.test/p.mp4" });
  assert.equal((await withVideo.actions.confirmShipment("o", "Flash Express", "TH1")).success, true);
});

test("shipping loses cleanly if the order moved on (e.g. was disputed) in the meantime", async () => {
  const { actions } = sellerActions(
    { ...PAID_ORDER, delivery_method: "ship", packing_video_url: "https://files.test/p.mp4" },
    { claim: { orders: [] } }
  );
  assert.ok((await actions.confirmShipment("o", "Flash Express", "TH1")).error);
});

// ---------- approve vs dispute ----------
function orderActions(order, opts) {
  const db = makeDb({ orders: order, ...opts });
  const actions = load("src/app/orders/[id]/actions.ts", {
    "next/cache": noop,
    "@/lib/supabase/server": { createServiceClient: () => db.client },
    "@/lib/session": session("buyer"),
  });
  return { actions, db };
}
const DELIVERED = { id: "o", buyer_id: "buyer", seller_id: "seller", status: "DELIVERED", unboxing_video_url: "https://files.test/v.mp4" };

test("approving only completes an order that is still DELIVERED", async () => {
  const ok = orderActions(DELIVERED);
  assert.equal((await ok.actions.approveOrder("o")).success, true);
  assert.equal(ok.db.calls.updates[0].filters.status, "DELIVERED");

  // A dispute opened in the same instant: the guarded update matches no row.
  const raced = orderActions(DELIVERED, { claim: { orders: [] } });
  const result = await raced.actions.approveOrder("o");
  assert.ok(result.error);
  assert.equal(result.success, undefined);
});

function disputeActions(order, opts) {
  const db = makeDb({ orders: order, ...opts });
  const actions = load("src/app/orders/[id]/dispute/actions.ts", {
    "next/cache": noop,
    "@/lib/supabase/server": { createServiceClient: () => db.client },
    "@/lib/session": session("buyer"),
  });
  return { actions, db };
}

test("opening a dispute claims the DELIVERED order first, so it can happen only once", async () => {
  const ok = disputeActions(DELIVERED);
  assert.equal((await ok.actions.fileDispute("o", "condition", "มีรอย")).success, true);
  assert.equal(ok.db.calls.updates[0].values.status, "DISPUTED");
  assert.equal(ok.db.calls.updates[0].filters.status, "DELIVERED");
  assert.equal(ok.db.calls.inserts.length, 1);

  // Double click / order already completed: nothing is inserted.
  const dup = disputeActions(DELIVERED, { claim: { orders: [] } });
  assert.ok((await dup.actions.fileDispute("o", "condition", "มีรอย")).error);
  assert.equal(dup.db.calls.inserts.length, 0);
});

// ---------- admin decision ----------
function adminActions(dispute, opts) {
  const db = makeDb({ disputes: dispute, ...opts });
  const actions = load("src/app/admin/disputes/[id]/actions.ts", {
    "next/cache": noop,
    "@/lib/supabase/server": { createServiceClient: () => db.client },
    "@/lib/session": session("admin"),
  });
  return { actions, db };
}
const OPEN_DISPUTE = { id: "d", order_id: "o", decision: null };

test("a dispute is decided once, and the order moves only from DISPUTED", async () => {
  const ok = adminActions(OPEN_DISPUTE);
  assert.equal((await ok.actions.resolveDispute("d", "release", "ผู้ขายส่งถูกต้อง")).success, true);
  const [disputeUpdate, orderUpdate] = ok.db.calls.updates;
  assert.equal(disputeUpdate.filters.decision, null);
  assert.equal(orderUpdate.values.status, "COMPLETED");
  assert.equal(orderUpdate.filters.status, "DISPUTED");

  const refund = adminActions(OPEN_DISPUTE);
  await refund.actions.resolveDispute("d", "refund", "ของไม่ตรงปก");
  assert.equal(refund.db.calls.updates[1].values.status, "REFUNDED");
});

test("an already-decided dispute cannot be decided again", async () => {
  const done = adminActions({ ...OPEN_DISPUTE, decision: "release" });
  assert.ok((await done.actions.resolveDispute("d", "refund", "เปลี่ยนใจ")).error);
  assert.equal(done.db.calls.updates.length, 0);

  // Two admins at once: the second's guarded claim matches nothing.
  const raced = adminActions(OPEN_DISPUTE, { claim: { disputes: [] } });
  assert.ok((await raced.actions.resolveDispute("d", "refund", "x")).error);
  assert.equal(raced.db.calls.updates.filter((u) => u.table === "orders").length, 0);
});

test("if the order is no longer DISPUTED the decision is rolled back, not applied", async () => {
  const { actions, db } = adminActions(OPEN_DISPUTE, { claim: { orders: [] } });
  const result = await actions.resolveDispute("d", "release", "ok");
  assert.ok(result.error);
  const rollback = db.calls.updates.at(-1);
  assert.equal(rollback.table, "disputes");
  assert.deepEqual(plain(rollback.values), { decision: null, resolution_note: null, decided_at: null });
});

test("non-admins cannot decide a dispute", async () => {
  const { actions, db } = adminActions(OPEN_DISPUTE, { viewer: { is_admin: false } });
  assert.ok((await actions.resolveDispute("d", "release", "x")).error);
  assert.equal(db.calls.updates.length, 0);
});
