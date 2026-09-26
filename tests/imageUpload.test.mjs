import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(path, dependencies = {}, extra = {}) {
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
    ...extra,
  }, { filename: path });
  return exports;
}

const img = load("src/lib/imageUpload.ts");
const bytes = (arr) => new Uint8Array([...arr, ...new Array(Math.max(0, 16 - arr.length)).fill(0)]);
const ascii = (s) => [...s].map((c) => c.charCodeAt(0));
const JPEG = bytes([0xff, 0xd8, 0xff, 0xe0]);
const PNG = bytes([0x89, ...ascii("PNG"), 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP = bytes([...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP")]);
const GIF = bytes(ascii("GIF89a"));

test("photos are recognised by their real bytes, not the name or claimed type", () => {
  assert.equal(img.sniffImageType(JPEG).contentType, "image/jpeg");
  assert.equal(img.sniffImageType(PNG).ext, "png");
  assert.equal(img.sniffImageType(WEBP).ext, "webp");
  assert.equal(img.sniffImageType(GIF).ext, "gif");
  assert.equal(img.sniffImageType(bytes(ascii("<svg xmlns=\"http://www.w3.org/2000/svg\">"))), null);
  assert.equal(img.sniffImageType(bytes(ascii("<html><script>alert(1)</script>"))), null);
  assert.equal(img.sniffImageType(bytes([1, 2, 3])), null);
});

test("an SVG or script renamed .jpg is refused; an oversized or empty photo is refused before reading", async () => {
  const fakeSvg = await img.checkPhotoFile(new File(["<svg onload=alert(1)></svg>...."], "card.jpg", { type: "image/jpeg" }), "ด้านหน้า");
  assert.equal(fakeSvg.ok, false);
  const empty = await img.checkPhotoFile(new File([], "a.jpg", { type: "image/jpeg" }), "ด้านหน้า");
  assert.equal(empty.ok, false);
  const big = new File([new Uint8Array(img.MAX_PHOTO_BYTES + 1)], "big.jpg", { type: "image/jpeg" });
  const tooBig = await img.checkPhotoFile(big, "ด้านหลัง");
  assert.equal(tooBig.ok, false);
  assert.match(tooBig.error, /ใหญ่เกินไป/);
  assert.match(tooBig.error, /ด้านหลัง/);
  const good = await img.checkPhotoFile(new File([JPEG], "whatever.exe", { type: "text/plain" }), "ด้านหน้า");
  assert.equal(good.ok, true);
  assert.equal(good.type.contentType, "image/jpeg");
});

// ---------- client helper never leaves the UI stuck ----------
test("postForm turns network failures and non-JSON error pages into readable errors", async () => {
  const run = (fetchImpl) => load("src/lib/clientImage.ts", {}, { fetch: fetchImpl }).postForm("/x", new FormData());

  const offline = await run(async () => { throw new TypeError("Failed to fetch"); });
  assert.equal(offline.ok, false);
  assert.match(offline.error, /เชื่อมต่อ/);

  const htmlError = await run(async () => new Response("<html>Internal Server Error</html>", { status: 500 }));
  assert.equal(htmlError.ok, false);
  assert.equal(htmlError.status, 500);
  assert.ok(htmlError.error.length > 0);

  const tooLarge = await run(async () => new Response("", { status: 413 }));
  assert.match(tooLarge.error, /ใหญ่เกินไป/);

  const serverMessage = await run(async () => Response.json({ error: "กรอกข้อมูลให้ครบ" }, { status: 400 }));
  assert.equal(serverMessage.error, "กรอกข้อมูลให้ครบ");

  const ok = await run(async () => Response.json({ id: "abc" }));
  assert.equal(ok.ok, true);
  assert.equal(ok.data.id, "abc");
});

// ---------- create route ----------
function route(formDataFails = false) {
  const calls = { inserted: 0, deleted: 0, uploads: [] };
  const supabase = {
    from: () => ({
      insert: () => { calls.inserted++; return { select: () => ({ single: async () => ({ data: { id: "L1", name: "n", start_price: 100 }, error: null }) }) }; },
      update: () => ({ eq: async () => ({}) }),
      delete: () => { calls.deleted++; return { eq: async () => ({}) }; },
    }),
    storage: {
      from: () => ({
        upload: async (path, _b, opts) => { calls.uploads.push({ path, opts }); return { error: null }; },
        getPublicUrl: (p) => ({ data: { publicUrl: "https://files.test/" + p } }),
      }),
    },
  };
  const module = load("src/app/api/listings/route.ts", {
    "next/server": { NextResponse: Response },
    "@/lib/session": { getVerifiedUserId: async () => "seller" },
    "@/lib/supabase/server": { createServiceClient: () => supabase },
    "@/lib/vanguard": { parseListingDetails: () => ({ ok: true, rarity: "RRR", quantity: 1, hasExtras: null }) },
    "@/lib/imageUpload": img,
  });
  return { module, calls };
}

function listingRequest({ front, back }) {
  const fd = new FormData();
  fd.append("front", front);
  fd.append("back", back);
  for (const [k, v] of Object.entries({ name: "n", set: "s", category: "rare", condition: "c", startPrice: "100", description: "" })) fd.append(k, v);
  return new Request("https://tcs.test/api/listings", { method: "POST", body: fd });
}

test("a photo that isn't a real image is refused before any listing is created", async () => {
  const { module, calls } = route();
  const evil = new File(["<svg onload=alert(1)>............"], "card.jpg", { type: "image/jpeg" });
  const res = await module.POST(listingRequest({ front: evil, back: new File([JPEG], "b.jpg", { type: "image/jpeg" }) }));
  assert.equal(res.status, 400);
  assert.equal(calls.inserted, 0);
  assert.equal(calls.uploads.length, 0);
});

test("valid photos are stored under a fresh path with the sniffed type, not the client's", async () => {
  const { module, calls } = route();
  const res = await module.POST(listingRequest({
    front: new File([GIF], "anim.GIF.exe", { type: "text/html" }),
    back: new File([PNG], "b.svg", { type: "image/svg+xml" }),
  }));
  assert.equal(res.status, 200);
  assert.equal(calls.uploads.length, 2);
  assert.match(calls.uploads[0].path, /^L1\/front-[0-9a-f-]+\.gif$/);
  assert.equal(calls.uploads[0].opts.contentType, "image/gif");
  assert.match(calls.uploads[1].path, /^L1\/back-[0-9a-f-]+\.png$/);
  assert.equal(calls.uploads[1].opts.contentType, "image/png");
});

test("an unreadable (over-limit) request body gives a clear 413 instead of a bare server error", async () => {
  const { module } = route();
  const req = new Request("https://tcs.test/api/listings", { method: "POST", headers: { "content-type": "multipart/form-data; boundary=x" }, body: "not a valid multipart body" });
  const res = await module.POST(req);
  assert.equal(res.status, 413);
  assert.ok((await res.json()).error);
});
