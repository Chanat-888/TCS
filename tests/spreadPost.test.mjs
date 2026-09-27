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
    exports, Date, Math, String, Promise, Object, Array, Number, Infinity, Uint8Array, File, Response, Request, FormData, JSON, crypto, console,
    require(name) {
      if (!(name in dependencies)) throw new Error("Unexpected dependency: " + name);
      return dependencies[name];
    },
  }, { filename: path });
  return exports;
}

const plain = (x) => JSON.parse(JSON.stringify(x));
const vanguard = load("src/lib/vanguard.ts");
const spread = load("src/lib/spreadPost.ts", { "@/lib/vanguard": vanguard });
const imageUpload = load("src/lib/imageUpload.ts");
const orderCreate = load("src/lib/orderCreate.ts");

const good = (over = {}) => ({ photoIndex: 0, x: 30, y: 40, name: "Blaster Blade", rarity: "RRR", condition: "สภาพสมบูรณ์ (Near Mint)", price: 500, ...over });
const fresh = (n, over = {}) => Array.from({ length: n }, () => good(over));

// ---------- validation ----------
test("a spread post needs 1-30 valid, priced, pinned cards", () => {
  assert.equal(spread.parseSpreadItems([good()], 1).ok, true);
  assert.equal(spread.parseSpreadItems([], 1).ok, false);
  assert.equal(spread.parseSpreadItems("nope", 1).ok, false);
  assert.equal(spread.parseSpreadItems(fresh(31), 1).ok, false);
  assert.equal(spread.parseSpreadItems(fresh(30), 1).ok, true);
});

test("each card's fields are checked and the error names the card", () => {
  for (const bad of [
    { name: "" }, { name: "x".repeat(81) }, { rarity: "MYTHIC" }, { rarity: "" }, { condition: "" },
    { price: 0 }, { price: -5 }, { price: 1.5 }, { price: 2_000_000 }, { price: "abc" },
    { photoIndex: 1 }, { photoIndex: -1 }, { photoIndex: 0.5 }, { x: -1 }, { x: 101 }, { y: -0.1 }, { y: 100.5 }, { x: "left" },
  ]) {
    const result = spread.parseSpreadItems([good(), good(bad)], 1);
    assert.equal(result.ok, false, JSON.stringify(bad));
    assert.match(result.error, /ใบที่ 2/);
  }
  assert.equal(spread.parseSpreadItems([good({ price: "1200", x: "10", y: "20" })], 1).ok, true);
  assert.equal(spread.parseSpreadItems([good({ x: 0, y: 100 })], 1).ok, true);
  assert.equal(spread.parseSpreadItems([null], 1).ok, false);
});

test("a pin may sit on any of the uploaded photos", () => {
  assert.equal(spread.parseSpreadItems([good({ photoIndex: 2 })], 3).ok, true);
  assert.equal(spread.parseSpreadItems([good({ photoIndex: 3 })], 3).ok, false);
});

test("totals and the headline price come from the cards", () => {
  const items = [{ price: 500 }, { price: 120 }, { price: 999 }];
  assert.equal(spread.cheapestPrice(items), 120);
  assert.equal(spread.totalPrice(items), 1619);
});

// ---------- server actions ----------
function makeDb({ listing, unpaid = null, claim = () => [{ id: "i1", price: 500 }], attach = (ids) => ids.map((id) => ({ id })), orderError = null } = {}) {
  const calls = { updates: [], inserts: [] };
  const client = {
    from(table) {
      const filters = {};
      let mode = "select";
      let values = null;
      const chain = {
        select() { return chain; },
        eq(c, v) { filters[c] = ["eq", v]; return chain; },
        in(c, v) { filters[c] = ["in", v]; return chain; },
        is(c, v) { filters[c] = ["is", v]; return chain; },
        limit() { return chain; },
        update(v) { mode = "update"; values = v; return chain; },
        insert(v) {
          calls.inserts.push({ table, values: v });
          const p = { select() { return p; }, single: async () => ({ data: orderError ? null : { id: "order-1" }, error: orderError }), then(res) { res({ error: null }); } };
          return p;
        },
        maybeSingle: async () => ({ data: table === "listings" ? listing : table === "orders" ? unpaid : null }),
        then(resolve) {
          if (mode === "update") {
            calls.updates.push({ table, values, filters });
            if (table === "listing_items" && values.status === "reserved") return resolve({ data: claim(filters), error: null });
            if (table === "listing_items" && values.order_id) return resolve({ data: attach(filters.id[1]), error: null });
            return resolve({ data: [{ id: "row" }], error: null });
          }
          resolve({ data: [], error: null });
        },
      };
      return chain;
    },
  };
  return { client, calls };
}

function actions(userId, db) {
  return load("src/app/listings/[id]/spreadActions.ts", {
    "next/cache": { revalidatePath() {} },
    "@/lib/supabase/server": { createServiceClient: () => db.client },
    "@/lib/session": { requireVerifiedUserId: async () => userId },
    "@/lib/orderCreate": orderCreate,
    "@/lib/spreadPost": spread,
  });
}

const SPREAD = { id: "L", seller_id: "seller", status: "active", post_kind: "spread" };

test("picked cards become one order for their combined price, and the cards are tied to it", async () => {
  const db = makeDb({ listing: SPREAD, claim: () => [{ id: "a", price: 500 }, { id: "b", price: 250 }] });
  const result = await actions("buyer", db).reserveItems("L", ["a", "b"]);
  assert.equal(result.success, true);
  assert.equal(result.orderId, "order-1");
  const order = db.calls.inserts.find((i) => i.table === "orders").values;
  assert.equal(order.amount, 750);
  assert.equal(order.buyer_id, "buyer");
  assert.equal(order.seller_id, "seller");
  assert.equal(order.status, "PENDING_PAYMENT");
  const claim = db.calls.updates[0];
  assert.equal(claim.filters.status[1], "available"); // only cards still available are taken
  assert.equal(claim.values.reserved_by, "buyer");
  const attach = db.calls.updates.find((u) => u.values.order_id);
  assert.equal(attach.values.order_id, "order-1");
  assert.equal(attach.filters.reserved_by[1], "buyer");
});

test("if any picked card was taken first, nothing is bought and the ones we did get are given back", async () => {
  const db = makeDb({ listing: SPREAD, claim: () => [{ id: "a", price: 500 }] }); // asked for a and b, got only a
  const result = await actions("buyer", db).reserveItems("L", ["a", "b"]);
  assert.match(result.error, /มีคนเลือกไปแล้ว/);
  assert.equal(db.calls.inserts.filter((i) => i.table === "orders").length, 0);
  const release = db.calls.updates.at(-1);
  assert.equal(release.values.status, "available");
  assert.deepEqual(plain(release.filters.id[1]), ["a"]);
  assert.equal(release.filters.reserved_by[1], "buyer"); // never frees someone else's hold
});

test("a failed order releases the cards; a card that can't be tied to the order cancels it", async () => {
  const noOrder = makeDb({ listing: SPREAD, claim: () => [{ id: "a", price: 100 }], orderError: { message: "x" } });
  assert.ok((await actions("buyer", noOrder).reserveItems("L", ["a"])).error);
  assert.equal(noOrder.calls.updates.at(-1).values.status, "available");

  const partial = makeDb({ listing: SPREAD, claim: () => [{ id: "a", price: 100 }, { id: "b", price: 100 }], attach: () => [{ id: "a" }] });
  const result = await actions("buyer", partial).reserveItems("L", ["a", "b"]);
  assert.ok(result.error);
  assert.ok(partial.calls.updates.some((u) => u.table === "orders" && u.values.status === "CANCELLED"));
});

test("you cannot buy your own post, a closed post, a single-item listing, or with nothing picked", async () => {
  const mine = makeDb({ listing: SPREAD });
  assert.ok((await actions("seller", mine).reserveItems("L", ["a"])).error);
  const closed = makeDb({ listing: { ...SPREAD, status: "cancelled" } });
  assert.ok((await actions("buyer", closed).reserveItems("L", ["a"])).error);
  const single = makeDb({ listing: { ...SPREAD, post_kind: "single" } });
  assert.ok((await actions("buyer", single).reserveItems("L", ["a"])).error);
  const empty = makeDb({ listing: SPREAD });
  assert.ok((await actions("buyer", empty).reserveItems("L", [])).error);
  for (const db of [mine, closed, single, empty]) assert.equal(db.calls.updates.length, 0);
});

test("a buyer with an unpaid order on the post must pay it first (no locking up all the stock)", async () => {
  const db = makeDb({ listing: SPREAD, unpaid: { id: "old-order" } });
  const result = await actions("buyer", db).reserveItems("L", ["a"]);
  assert.match(result.error, /ยังไม่ได้ชำระเงิน/);
  assert.equal(result.orderId, "old-order");
  assert.equal(db.calls.updates.length, 0);
});

test("only the seller can close their spread post, and only once", async () => {
  const ok = makeDb({ listing: SPREAD });
  assert.equal((await actions("seller", ok).closeSpreadPost("L")).success, true);
  assert.equal(ok.calls.updates[0].values.status, "cancelled");
  assert.equal(ok.calls.updates[0].filters.status[1], "active");

  const other = makeDb({ listing: SPREAD });
  assert.ok((await actions("someone", other).closeSpreadPost("L")).error);
  assert.equal(other.calls.updates.length, 0);
});

// ---------- creation route ----------
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

function routeDb({ itemsError = null, uploadFails = false } = {}) {
  const calls = { listings: [], items: [], deleted: 0, uploads: [], updates: [] };
  const client = {
    from(table) {
      return {
        insert(v) {
          if (table === "listings") {
            calls.listings.push(v);
            return { select: () => ({ single: async () => ({ data: { id: "L1", name: v.name }, error: null }) }) };
          }
          calls.items.push(v);
          return Promise.resolve({ error: itemsError });
        },
        update(v) { calls.updates.push(v); return { eq: async () => ({}) }; },
        delete() { calls.deleted++; return { eq: async () => ({}) }; },
      };
    },
    storage: {
      from: () => ({
        upload: async (path, _b, opts) => { calls.uploads.push({ path, opts }); return { error: uploadFails ? { message: "x" } : null }; },
        getPublicUrl: (p) => ({ data: { publicUrl: "https://files.test/" + p } }),
      }),
    },
  };
  const route = load("src/app/api/listings/spread/route.ts", {
    "next/server": { NextResponse: Response },
    "@/lib/session": { getVerifiedUserId: async () => "seller" },
    "@/lib/supabase/server": { createServiceClient: () => client },
    "@/lib/imageUpload": imageUpload,
    "@/lib/spreadPost": spread,
  });
  return { route, calls };
}

function post({ photos = 1, items = [good()], title = "การ์ดชุดใหม่ทั้งกอง", extra = {} } = {}) {
  const fd = new FormData();
  for (let i = 0; i < photos; i++) fd.append(`photo${i}`, new File([JPEG], `p${i}.jpg`, { type: "image/jpeg" }));
  fd.append("title", title);
  fd.append("items", JSON.stringify(items));
  for (const [k, v] of Object.entries(extra)) fd.append(k, v);
  return new Request("https://tcs.test/api/listings/spread", { method: "POST", body: fd });
}

test("a valid spread post creates the listing, one row per card, and stores the photos", async () => {
  const { route, calls } = routeDb();
  const res = await route.POST(post({ photos: 2, items: [good({ price: 900 }), good({ price: 300, name: "Gancelot", x: 60, y: 10 })] }));
  assert.equal(res.status, 200);
  const listing = calls.listings[0];
  assert.equal(listing.post_kind, "spread");
  assert.equal(listing.start_price, 300); // headline price = cheapest card
  assert.equal(listing.buy_now_price, 300);
  assert.equal(calls.items[0].length, 2);
  assert.deepEqual(plain(calls.items[0].map((i) => i.position)), [1, 2]); // numbered in pin order
  assert.equal(calls.items[0][1].x, 60);
  assert.equal(calls.items[0][1].photo_index, 0);
  assert.equal(calls.uploads.length, 2);
  assert.match(calls.uploads[0].path, /^L1\/post-0-[0-9a-f-]+\.jpg$/);
  assert.equal(calls.uploads[0].opts.contentType, "image/jpeg");
  assert.equal(calls.updates.at(-1).photo_urls.length, 2);
});

test("bad input creates nothing: no photos, bad cards, bad title, or a fake image", async () => {
  for (const req of [
    post({ photos: 0 }),
    post({ items: [] }),
    post({ items: [good({ price: 0 })] }),
    post({ title: "x" }),
    post({ items: [good({ photoIndex: 3 })] }),
  ]) {
    const { route, calls } = routeDb();
    const res = await route.POST(req);
    assert.equal(res.status >= 400 && res.status < 500, true);
    assert.equal(calls.listings.length, 0);
  }
  const fake = new FormData();
  fake.append("photo0", new File(["<svg onload=alert(1)>............"], "a.jpg", { type: "image/jpeg" }));
  fake.append("title", "ชื่อโพสต์");
  fake.append("items", JSON.stringify([good()]));
  const { route, calls } = routeDb();
  assert.equal((await route.POST(new Request("https://tcs.test/x", { method: "POST", body: fake }))).status, 400);
  assert.equal(calls.listings.length, 0);
});

test("if saving the cards or the photos fails, the half-made post is removed", async () => {
  const items = routeDb({ itemsError: { message: "x" } });
  assert.equal((await items.route.POST(post())).status, 500);
  assert.equal(items.calls.deleted, 1);

  const photos = routeDb({ uploadFails: true });
  assert.equal((await photos.route.POST(post())).status, 500);
  assert.equal(photos.calls.deleted, 1);
});

test("an unreadable request body gives a clear 413", async () => {
  const { route } = routeDb();
  const res = await route.POST(new Request("https://tcs.test/x", { method: "POST", headers: { "content-type": "multipart/form-data; boundary=x" }, body: "garbage" }));
  assert.equal(res.status, 413);
});
