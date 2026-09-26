import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(path) {
  const code = ts.transpileModule(readFileSync(new URL("../" + path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, Math, Number }, { filename: path });
  return exports;
}

const edit = load("src/lib/photoEdit.ts");
const plain = (x) => JSON.parse(JSON.stringify(x));
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

test("turning a crop clockwise then anti-clockwise gives the same crop back", () => {
  const r = { x: 0.1, y: 0.2, w: 0.5, h: 0.3 };
  const back = edit.rotateRectCcw(edit.rotateRectCw(r));
  for (const k of ["x", "y", "w", "h"]) near(back[k], r[k]);
  // four turns is a full circle
  let spun = r;
  for (let i = 0; i < 4; i++) spun = edit.rotateRectCw(spun);
  for (const k of ["x", "y", "w", "h"]) near(spun[k], r[k]);
});

test("a clockwise turn moves the top-left area to the top-right", () => {
  const rotated = edit.rotateRectCw({ x: 0, y: 0, w: 0.4, h: 0.2 });
  near(rotated.x, 0.8);
  near(rotated.y, 0);
  near(rotated.w, 0.2);
  near(rotated.h, 0.4);
});

test("a crop is kept inside the photo and never tiny", () => {
  const r = edit.clampRect({ x: 0.95, y: -0.2, w: 0.5, h: 0.01 });
  assert.ok(r.x >= 0 && r.x + r.w <= 1 + 1e-9);
  assert.ok(r.y >= 0 && r.y + r.h <= 1 + 1e-9);
  assert.ok(r.h >= edit.MIN_CROP);
});

test("pins stay on their cards when the photo is rotated a quarter turn", () => {
  // A pin at the top-left corner of the photo ends up at the top-right after a clockwise turn.
  const [tl] = edit.transformPins([{ x: 10, y: 20 }], 1, edit.FULL_RECT);
  assert.equal(tl.x, 80); // 100 - 20
  assert.equal(tl.y, 10);
  assert.equal(tl.kept, true);

  // Four quarter turns bring every pin home.
  const [home] = edit.transformPins([{ x: 33.3, y: 71.2 }], 4, edit.FULL_RECT);
  assert.equal(home.x, 33.3);
  assert.equal(home.y, 71.2);
  const [three] = edit.transformPins([{ x: 10, y: 20 }], 3, edit.FULL_RECT);
  const [back] = edit.transformPins([{ x: 10, y: 20 }], -1, edit.FULL_RECT); // one anti-clockwise turn == three clockwise
  assert.deepEqual(plain(three), plain(back));
});

test("cropping re-bases pins to the new frame and drops the ones outside it", () => {
  const crop = { x: 0.5, y: 0.0, w: 0.5, h: 0.5 }; // the top-right quarter
  const pins = [
    { x: 75, y: 25 }, // in the middle of the crop
    { x: 10, y: 10 }, // outside (left of it)
    { x: 90, y: 80 }, // outside (below it)
    { x: 50, y: 0 }, // exactly on the crop's corner: kept
  ];
  const moved = edit.transformPins(pins, 0, crop);
  assert.deepEqual(plain(moved.map((m) => m.kept)), [true, false, false, true]);
  assert.equal(moved[0].x, 50);
  assert.equal(moved[0].y, 50);
  assert.equal(moved[3].x, 0);
  assert.equal(moved[3].y, 0);
});

test("rotating and then cropping applies the turn first, in the turned frame", () => {
  // Pin near the top-left of the original; after one clockwise turn it is near the top-right,
  // which is where this crop (the right half) is.
  const [pin] = edit.transformPins([{ x: 10, y: 20 }], 1, { x: 0.5, y: 0, w: 0.5, h: 1 });
  assert.equal(pin.kept, true);
  assert.equal(pin.x, 60); // (0.8 - 0.5) / 0.5
  assert.equal(pin.y, 10);
});

// ---------- image decoding fallback ----------
function loadImageModule(globals) {
  const code = ts.transpileModule(readFileSync(new URL("../src/lib/loadImage.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, Promise, ...globals }, { filename: "loadImage.ts" });
  return exports;
}

test("images decode through createImageBitmap when it works", async () => {
  let closed = 0;
  const { loadImage } = loadImageModule({ createImageBitmap: async () => ({ width: 640, height: 480, close: () => closed++ }) });
  const image = await loadImage({});
  assert.equal(image.width, 640);
  assert.equal(image.height, 480);
  image.close();
  assert.equal(closed, 1);
});

test("if createImageBitmap is missing or fails, an <img> element is used instead so the photo is still usable", async () => {
  const revoked = [];
  class FakeImage {
    async decode() { this.naturalWidth = 800; this.naturalHeight = 600; }
  }
  const globals = { Image: FakeImage, URL: { createObjectURL: () => "blob:x", revokeObjectURL: (u) => revoked.push(u) } };

  for (const bitmap of [{ createImageBitmap: async () => { throw new Error("unsupported"); } }, {}]) {
    const { loadImage } = loadImageModule({ ...globals, ...bitmap });
    const image = await loadImage({});
    assert.equal(image.width, 800);
    assert.equal(image.height, 600);
    image.close();
  }
  assert.deepEqual(revoked, ["blob:x", "blob:x"]); // the temporary URL is always released
});

test("a file that cannot be decoded at all is reported, and its temporary URL is released", async () => {
  const revoked = [];
  class BrokenImage {
    async decode() { throw new Error("bad image"); }
  }
  const { loadImage } = loadImageModule({
    createImageBitmap: async () => { throw new Error("no"); },
    Image: BrokenImage,
    URL: { createObjectURL: () => "blob:y", revokeObjectURL: (u) => revoked.push(u) },
  });
  await assert.rejects(loadImage({}));
  assert.deepEqual(revoked, ["blob:y"]);
});
