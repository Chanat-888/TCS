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
    exports, console: { error() {} },
    require(name) {
      if (!(name in dependencies)) throw new Error("Unexpected dependency: " + name);
      return dependencies[name];
    },
  }, { filename: path });
  return exports;
}
const plain = (value) => JSON.parse(JSON.stringify(value));
const provinces = load("src/lib/thaiProvinces.ts");
const addresses = load("src/lib/addresses.ts", { "@/lib/thaiProvinces": provinces });

const GOOD = { label: "บ้าน", recipient: "สมชาย ใจดี", phone: "081-234-5678", address: "99/1 ถนนสุขุมวิท คลองเตย", province: "กรุงเทพมหานคร", postcode: "10110" };

// ---------- validation ----------
test("contact phones accept Thai mobile and landline formats and normalize them", () => {
  for (const [input, expected] of [["081-234-5678", "0812345678"], ["+66 81 234 5678", "0812345678"], ["66812345678", "0812345678"], ["02 123 4567", "021234567"]]) {
    assert.equal(addresses.cleanContactPhone(input), expected);
  }
  for (const bad of ["", "abc", "12345", "081234567890", "+1 212 555 1234", null, 812345678]) {
    assert.equal(addresses.cleanContactPhone(bad), null);
  }
});
test("a good address is accepted, normalized and stripped of invisible characters", () => {
  const result = addresses.cleanAddressInput({ ...GOOD, recipient: "  สมชาย\u200B   ใจดี ", address: "99/1\u202E ถนนสุขุมวิท" });
  assert.equal(result.ok, true);
  assert.equal(result.value.recipient, "สมชาย ใจดี");
  assert.ok(!/[\u200B\u202E]/.test(result.value.address));
  assert.equal(result.value.phone, "0812345678");
});
test("bad addresses are refused with a reason", () => {
  for (const patch of [
    { recipient: "a" }, { recipient: "" }, { phone: "abc" }, { address: "x" }, { address: "x".repeat(301) },
    { province: "Atlantis" }, { province: "" }, { postcode: "1011" }, { postcode: "101100" }, { postcode: "abcde" }, { label: "" }, { label: "x".repeat(21) },
  ]) {
    const result = addresses.cleanAddressInput({ ...GOOD, ...patch });
    assert.equal(result.ok, false, JSON.stringify(patch));
    assert.ok(result.error);
  }
  for (const junk of [null, undefined, "text", 42, []]) assert.equal(addresses.cleanAddressInput(junk).ok, false);
});
test("only known fields survive cleaning, so a client cannot smuggle extra columns", () => {
  const result = addresses.cleanAddressInput({ ...GOOD, user_id: "attacker", is_default: true, id: "x" });
  assert.deepEqual(Object.keys(result.value).sort(), ["address", "label", "phone", "postcode", "province", "recipient"]);
});

// ---------- a tiny Supabase stand-in that records what was written ----------
function makeDb({ order = null, single = {}, writeFails = [] } = {}) {
  const log = [];
  return {
    log,
    client: {
      from(table) {
        const state = { table, op: "select", values: null, filters: [] };
        const q = {
          select() { return q; },
          insert(values) { state.op = "insert"; state.values = values; return q; },
          update(values) { state.op = "update"; state.values = values; return q; },
          delete() { state.op = "delete"; return q; },
          eq(column, value) { state.filters.push([column, value]); return q; },
          maybeSingle: async () => ({ data: table === "orders" ? order : (single[table] ?? null), error: null }),
          then(resolve, reject) {
            log.push(plain(state));
            const failed = writeFails.includes(table);
            return Promise.resolve(failed ? { error: { code: "XX000" } } : { data: [{ id: "row" }], error: null }).then(resolve, reject);
          },
        };
        return q;
      },
    },
  };
}
const writes = (db, table, op) => db.log.filter((entry) => entry.table === table && entry.op === op);

// ---------- checkout ----------
const ORDER = { id: "order-1", buyer_id: "buyer", seller_id: "seller", status: "PENDING_PAYMENT" };
const SAVED = { id: "addr-1", label: "บ้าน", recipient: "สมชาย ใจดี", phone: "0812345678", address: "99/1 ถนนสุขุมวิท", province: "กรุงเทพมหานคร", postcode: "10110", is_default: true };

function checkout({ userId = "buyer", order = ORDER, saved = SAVED, existing = [], writeFails = [] } = {}) {
  const db = makeDb({ order, writeFails });
  const revalidated = [];
  const actions = load("src/app/checkout/[orderId]/actions.ts", {
    "next/cache": { revalidatePath: (path) => revalidated.push(path) },
    "@/lib/supabase/server": { createServiceClient: () => db.client },
    "@/lib/session": { requireVerifiedUserId: async () => userId },
    "@/lib/addressBook": {
      getAddress: async (uid, id) => (saved && uid === saved.owner && id === saved.id ? saved : (saved && !saved.owner && id === saved.id ? saved : null)),
      listAddresses: async () => existing,
    },
    "@/lib/addresses": addresses,
  });
  return { actions, db, revalidated };
}
const orderUpdate = (db) => writes(db, "orders", "update")[0];

test("paying with a saved address copies it into the order and keeps the default delivery method", async () => {
  const { actions, db } = checkout();
  const result = await actions.payOrder("order-1", { method: "promptpay", delivery: { type: "saved", addressId: "addr-1" } });
  assert.equal(result.success, true);
  assert.equal(result.deliveryMethod, "ship");
  const update = orderUpdate(db);
  assert.equal(update.values.status, "PAID_HELD");
  assert.equal(update.values.shipping_recipient, SAVED.recipient);
  assert.equal(update.values.shipping_postcode, "10110");
  assert.equal("delivery_method" in update.values, false, "ship is the column default, so checkout works before the migration");
  assert.ok(update.filters.some(([c, v]) => c === "status" && v === "PENDING_PAYMENT"), "guards against double payment");
});
test("someone else's saved address can never be used", async () => {
  const { actions, db } = checkout({ saved: null });
  const result = await actions.payOrder("order-1", { method: "promptpay", delivery: { type: "saved", addressId: "victims-address" } });
  assert.ok(result.error);
  assert.equal(writes(db, "orders", "update").length, 0);
});
test("meet-up stores no address at all and marks the order as meet-up", async () => {
  const { actions, db } = checkout();
  const result = await actions.payOrder("order-1", { method: "card", delivery: { type: "meetup" } });
  assert.equal(result.deliveryMethod, "meetup");
  const update = orderUpdate(db);
  assert.equal(update.values.delivery_method, "meetup");
  for (const key of ["shipping_recipient", "shipping_phone", "shipping_address", "shipping_province", "shipping_postcode"]) {
    assert.equal(update.values[key], null, key);
  }
});
test("a typed-in address is validated, and saving it never blocks payment", async () => {
  const fields = { recipient: "สมชาย ใจดี", phone: "081 234 5678", address: "99/1 ถนนสุขุมวิท", province: "กรุงเทพมหานคร", postcode: "10110" };
  const bad = checkout();
  assert.ok((await bad.actions.payOrder("order-1", { method: "promptpay", delivery: { type: "other", address: { ...fields, postcode: "12" } } })).error);
  assert.equal(writes(bad.db, "orders", "update").length, 0);

  const first = checkout({ existing: [] });
  assert.equal((await first.actions.payOrder("order-1", { method: "promptpay", delivery: { type: "other", address: fields, save: true } })).success, true);
  const saved = writes(first.db, "profile_addresses", "insert")[0];
  assert.equal(saved.values.user_id, "buyer");
  assert.equal(saved.values.is_default, true, "the first saved address becomes the default");

  const full = checkout({ existing: [1, 2, 3, 4, 5].map((n) => ({ id: "a" + n })) });
  assert.equal((await full.actions.payOrder("order-1", { method: "promptpay", delivery: { type: "other", address: fields, save: true } })).success, true);
  assert.equal(writes(full.db, "profile_addresses", "insert").length, 0, "the limit is respected");

  const broken = checkout({ existing: [], writeFails: ["profile_addresses"] });
  assert.equal((await broken.actions.payOrder("order-1", { method: "promptpay", delivery: { type: "other", address: fields, save: true } })).success, true);

  const unsaved = checkout({ existing: [] });
  await unsaved.actions.payOrder("order-1", { method: "promptpay", delivery: { type: "other", address: fields, save: false } });
  assert.equal(writes(unsaved.db, "profile_addresses", "insert").length, 0);
});
test("checkout refuses other people's orders, paid orders, and unknown choices", async () => {
  const other = checkout({ order: { ...ORDER, buyer_id: "someone-else" } });
  assert.ok((await other.actions.payOrder("order-1", { method: "promptpay", delivery: { type: "meetup" } })).error);
  const paid = checkout({ order: { ...ORDER, status: "PAID_HELD" } });
  assert.ok((await paid.actions.payOrder("order-1", { method: "promptpay", delivery: { type: "meetup" } })).error);
  const odd = checkout();
  for (const input of [
    { method: "promptpay", delivery: { type: "teleport" } }, { method: "promptpay", delivery: null },
    { method: "bitcoin", delivery: { type: "meetup" } }, { method: "promptpay" }, null,
  ]) assert.ok((await odd.actions.payOrder("order-1", input)).error, JSON.stringify(input));
  assert.equal(writes(odd.db, "orders", "update").length, 0);
});

// ---------- address book actions ----------
function book({ userId = "me", owned = {}, existing = [] } = {}) {
  const db = makeDb();
  const revalidated = [];
  const actions = load("src/app/profile/addressActions.ts", {
    "next/cache": { revalidatePath: (path) => revalidated.push(path) },
    "@/lib/supabase/server": { createServiceClient: () => db.client },
    "@/lib/session": { getSessionUserId: async () => userId },
    "@/lib/addressBook": {
      getAddress: async (uid, id) => (uid === "me" ? owned[id] ?? null : null),
      listAddresses: async () => existing,
    },
    "@/lib/addresses": addresses,
  });
  return { actions, db, revalidated };
}

test("address actions require a signed-in user and touch nothing otherwise", async () => {
  const { actions, db } = book({ userId: null });
  assert.ok((await actions.saveAddress(GOOD)).error);
  assert.ok((await actions.setDefaultAddress("a")).error);
  assert.ok((await actions.deleteAddress("a")).error);
  assert.equal(db.log.length, 0);
});
test("a new address is stored under the session user, never a client-supplied id", async () => {
  const { actions, db } = book();
  const result = await actions.saveAddress({ ...GOOD, user_id: "attacker", is_default: false });
  assert.equal(result.success, true);
  const insert = writes(db, "profile_addresses", "insert")[0];
  assert.equal(insert.values.user_id, "me");
  assert.equal(insert.values.is_default, true, "first address is the default");
  const second = book({ existing: [{ id: "x" }] });
  await second.actions.saveAddress(GOOD);
  assert.equal(writes(second.db, "profile_addresses", "insert")[0].values.is_default, false);
});
test("the five-address limit and validation are enforced before any write", async () => {
  const full = book({ existing: [1, 2, 3, 4, 5].map((n) => ({ id: "a" + n })) });
  assert.ok((await full.actions.saveAddress(GOOD)).error);
  assert.equal(full.db.log.length, 0);
  const invalid = book();
  assert.ok((await invalid.actions.saveAddress({ ...GOOD, postcode: "x" })).error);
  assert.equal(invalid.db.log.length, 0);
});
test("editing, defaulting and deleting are limited to the caller's own addresses", async () => {
  const mine = { id: "mine", is_default: false };
  const { actions, db } = book({ owned: { mine } });
  assert.ok((await actions.saveAddress(GOOD, "theirs")).error);
  assert.ok((await actions.setDefaultAddress("theirs")).error);
  assert.ok((await actions.deleteAddress("theirs")).error);
  assert.equal(db.log.length, 0, "nothing is written for someone else's address");

  assert.equal((await actions.saveAddress(GOOD, "mine")).success, true);
  const update = writes(db, "profile_addresses", "update")[0];
  assert.deepEqual(update.filters.sort(), [["id", "mine"], ["user_id", "me"]]);
});
test("making a default clears the old one first, and deleting the default promotes another", async () => {
  const { actions, db } = book({ owned: { mine: { id: "mine", is_default: true } }, existing: [{ id: "next" }] });
  await actions.setDefaultAddress("mine");
  const [clear, set] = writes(db, "profile_addresses", "update");
  assert.equal(clear.values.is_default, false);
  assert.equal(set.values.is_default, true);

  const del = book({ owned: { mine: { id: "mine", is_default: true } }, existing: [{ id: "next" }] });
  await del.actions.deleteAddress("mine");
  assert.equal(writes(del.db, "profile_addresses", "delete").length, 1);
  const promote = writes(del.db, "profile_addresses", "update")[0];
  assert.equal(promote.values.is_default, true);
  assert.deepEqual(promote.filters.sort(), [["id", "next"], ["user_id", "me"]]);
});

// ---------- seller ship / hand-over ----------
function seller({ userId = "seller", order }) {
  const db = makeDb({ order });
  const actions = load("src/app/orders/[id]/seller/actions.ts", {
    "next/cache": { revalidatePath() {} },
    "@/lib/supabase/server": { createServiceClient: () => db.client },
    "@/lib/session": { requireVerifiedUserId: async () => userId },
  });
  return { actions, db };
}
const PAID = { id: "o", seller_id: "seller", buyer_id: "buyer", status: "PAID_HELD", delivery_method: "ship", packing_video_url: "https://example.test/pack.mp4" };

test("shipped orders still need a courier and tracking number", async () => {
  const { actions, db } = seller({ order: PAID });
  assert.ok((await actions.confirmShipment("o", "", "TH1")).error);
  assert.ok((await actions.confirmShipment("o", "Flash Express", " ")).error);
  assert.equal((await actions.confirmShipment("o", "Flash Express", "TH123")).success, true);
  assert.equal(writes(db, "orders", "update")[0].values.status, "SHIPPED");
});
test("a meet-up order cannot be 'shipped', and only meet-up orders can be handed over", async () => {
  const meetup = seller({ order: { ...PAID, delivery_method: "meetup" } });
  assert.ok((await meetup.actions.confirmShipment("o", "Flash Express", "TH123")).error);
  assert.equal(writes(meetup.db, "orders", "update").length, 0);
  assert.equal((await meetup.actions.confirmHandover("o")).success, true);
  const update = writes(meetup.db, "orders", "update")[0];
  assert.equal(update.values.status, "SHIPPED");
  assert.equal(update.values.courier, undefined);
  assert.ok(update.filters.some(([c, v]) => c === "status" && v === "PAID_HELD"));

  const shipped = seller({ order: PAID });
  assert.ok((await shipped.actions.confirmHandover("o")).error);
  assert.equal(writes(shipped.db, "orders", "update").length, 0);
});
test("only the seller can hand over, and only while the order is paid and waiting", async () => {
  const notSeller = seller({ userId: "buyer", order: { ...PAID, delivery_method: "meetup" } });
  assert.ok((await notSeller.actions.confirmHandover("o")).error);
  const early = seller({ order: { ...PAID, delivery_method: "meetup", status: "PENDING_PAYMENT" } });
  assert.ok((await early.actions.confirmHandover("o")).error);
  const late = seller({ order: { ...PAID, delivery_method: "meetup", status: "COMPLETED" } });
  assert.ok((await late.actions.confirmHandover("o")).error);
  for (const s of [notSeller, early, late]) assert.equal(writes(s.db, "orders", "update").length, 0);
});

// ---------- privacy guards on the code and schema ----------
test("addresses are read only through server-only, user-scoped helpers", () => {
  const source = readFileSync(new URL("../src/lib/addressBook.ts", import.meta.url), "utf8");
  assert.match(source, /import "server-only"/);
  assert.equal((source.match(/\.eq\("user_id", userId\)/g) ?? []).length, 2, "every query filters by the session user");
});
test("the migration keeps addresses private", () => {
  const sql = readFileSync(new URL("../supabase/migrations/0010_delivery_addresses.sql", import.meta.url), "utf8");
  assert.match(sql, /alter table public\.profile_addresses enable row level security/);
  assert.match(sql, /revoke all on public\.profile_addresses from anon, authenticated/);
  assert.ok(!/create policy/i.test(sql), "no policy means the API roles get nothing");
  const code = sql.split("\n").filter((line) => !line.trim().startsWith("--")).join("\n");
  assert.ok(!/alter table (public\.)?profiles\b[^;]*add column/i.test(code), "no column is added to the public profiles table");
});
