import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// clientImage.ts is browser-only (canvas/document), so its dependencies
// (loadImage, imageUpload's sniffer) are stubbed the same way other browser
// modules are tested elsewhere in this suite.
function load(path, dependencies = {}) {
  const code = ts.transpileModule(readFileSync(new URL("../" + path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    Math,
    require(name) {
      if (!(name in dependencies)) throw new Error("Unexpected dependency: " + name);
      return dependencies[name];
    },
  }, { filename: path });
  return exports;
}

function fixture({ sniffed = null, closeCalls = [] } = {}) {
  return load("src/lib/clientImage.ts", {
    "@/lib/loadImage": { loadImage: async () => ({ width: 300, height: 400, close: () => closeCalls.push(true) }) },
    "@/lib/imageUpload": { sniffImageType: () => sniffed, MAX_PHOTO_BYTES: 4 * 1024 * 1024 },
  });
}

function fakeFile({ type = "image/gif", size = 1000, bytes = new Uint8Array([0x47, 0x49, 0x46]) } = {}) {
  return {
    type,
    size,
    slice: () => ({ arrayBuffer: async () => bytes.buffer }),
  };
}

test("a GIF is kept as-is (not flattened to a static JPEG), so it can still animate", async () => {
  const closeCalls = [];
  const clientImage = fixture({ sniffed: { ext: "gif", contentType: "image/gif" }, closeCalls });
  const file = fakeFile({ type: "image/gif" });
  const result = await clientImage.prepareCardPhoto(file);
  assert.equal(result.ok, true);
  assert.equal(result.file, file); // the exact original file, not a re-encoded copy
  assert.equal(result.width, 300);
  assert.equal(result.height, 400);
  assert.deepEqual(closeCalls, [true]); // the decoded bitmap used only to read dimensions is released
});

test("an animated file over the storage cap is rejected before it ever reaches the server", async () => {
  const clientImage = fixture({ sniffed: { ext: "webp", contentType: "image/webp" } });
  const file = fakeFile({ type: "image/webp", size: 5 * 1024 * 1024 });
  const result = await clientImage.prepareCardPhoto(file);
  assert.equal(result.ok, false);
  assert.match(result.error, /ใหญ่เกินไป/);
});

test("a WebP that can't be decoded at all is reported, not silently accepted", async () => {
  const clientImage = load("src/lib/clientImage.ts", {
    "@/lib/loadImage": { loadImage: async () => { throw new Error("bad file"); } },
    "@/lib/imageUpload": { sniffImageType: () => ({ ext: "webp", contentType: "image/webp" }), MAX_PHOTO_BYTES: 4 * 1024 * 1024 },
  });
  const result = await clientImage.prepareCardPhoto(fakeFile({ type: "image/webp" }));
  assert.equal(result.ok, false);
});
