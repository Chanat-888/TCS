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
    exports, Date, Promise, String, Math,
    require(name) {
      if (!(name in dependencies)) throw new Error("Unexpected dependency: " + name);
      return dependencies[name];
    },
  }, { filename: path });
  return exports;
}

// A small Supabase stand-in: `owners` is the row read from orders / wanted_posts, `rows` the chat rows.
function makeDb({ owners, rows = [] }) {
  const calls = { inserts: [], chatReads: 0 };
  return {
    calls,
    client: {
      from(table) {
        const chain = {
          select() { return chain; },
          eq() { return chain; },
          order() { return chain; },
          insert(v) { calls.inserts.push({ table, values: v }); return Promise.resolve({ error: null }); },
          maybeSingle: async () => ({ data: owners }),
          then(resolve) {
            if (table === "messages" || table === "wanted_post_messages") calls.chatReads++;
            resolve({ data: rows, error: null });
          },
        };
        return chain;
      },
    },
  };
}

const order = (userId, db) =>
  load("src/app/orders/[id]/actions.ts", {
    "next/cache": { revalidatePath() {} },
    "@/lib/supabase/server": { createServiceClient: () => db.client },
    "@/lib/session": { requireVerifiedUserId: async () => userId },
  });
const wanted = (userId, db) =>
  load("src/app/wanted/actions.ts", {
    "next/navigation": { redirect() {} },
    "next/cache": { revalidatePath() {} },
    "@/lib/supabase/server": { createServiceClient: () => db.client },
    "@/lib/session": { requireVerifiedUserId: async () => userId },
  });

const ORDER = { buyer_id: "buyer", seller_id: "seller" };
const ROWS = [{ id: "m1", sender_id: "buyer", body: "hi", created_at: "2026-10-01T00:00:00Z" }];

test("only the buyer or seller can read an order's chat", async () => {
  for (const who of ["buyer", "seller"]) {
    const db = makeDb({ owners: ORDER, rows: ROWS });
    const result = await order(who, db).getOrderMessages("o1");
    assert.equal(result.messages.length, 1);
  }
  const db = makeDb({ owners: ORDER, rows: ROWS });
  const stranger = await order("stranger", db).getOrderMessages("o1");
  assert.ok(stranger.error);
  assert.equal(stranger.messages, undefined);
  assert.equal(db.calls.chatReads, 0, "a stranger's request never touches the messages");
  assert.ok((await order("buyer", makeDb({ owners: null })).getOrderMessages("missing")).error);
});

test("a chat message is trimmed, capped at 1000 characters, and refused from strangers", async () => {
  const db = makeDb({ owners: ORDER });
  assert.equal((await order("buyer", db).sendOrderMessage("o1", "  hello  ")).success, true);
  assert.equal(db.calls.inserts[0].values.body, "hello");
  assert.equal(db.calls.inserts[0].values.sender_id, "buyer");

  const long = makeDb({ owners: ORDER });
  assert.match((await order("buyer", long).sendOrderMessage("o1", "x".repeat(1001))).error, /ยาวเกินไป/);
  assert.equal(long.calls.inserts.length, 0);
  assert.equal((await order("buyer", makeDb({ owners: ORDER })).sendOrderMessage("o1", "x".repeat(1000))).success, true);

  const stranger = makeDb({ owners: ORDER });
  assert.ok((await order("stranger", stranger).sendOrderMessage("o1", "hi")).error);
  assert.equal(stranger.calls.inserts.length, 0);
});

test("only the poster and that responder can read a wanted-post thread", async () => {
  const post = { poster_id: "poster" };
  const poster = await wanted("poster", makeDb({ owners: post, rows: ROWS })).getWantedThreadMessages("w1", "resp");
  assert.equal(poster.messages.length, 1);
  const responder = await wanted("resp", makeDb({ owners: post, rows: ROWS })).getWantedThreadMessages("w1", "resp");
  assert.equal(responder.messages.length, 1);

  const db = makeDb({ owners: post, rows: ROWS });
  const other = await wanted("other", db).getWantedThreadMessages("w1", "resp");
  assert.ok(other.error);
  assert.equal(db.calls.chatReads, 0);
});

test("a wanted-post message over 1000 characters is refused", async () => {
  const db = makeDb({ owners: { poster_id: "poster" } });
  assert.match((await wanted("resp", db).sendWantedPostMessage("w1", "resp", "x".repeat(1001))).error, /ยาวเกินไป/);
  assert.equal(db.calls.inserts.length, 0);
  assert.equal((await wanted("resp", db).sendWantedPostMessage("w1", "resp", "hello")).success, true);
});
