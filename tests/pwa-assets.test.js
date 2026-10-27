import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const manifest = JSON.parse(readFileSync(join(root, "manifest.webmanifest"), "utf8"));
const html = readFileSync(join(root, "index.html"), "utf8");
const serviceWorker = readFileSync(join(root, "service-worker.js"), "utf8");
const script = readFileSync(join(root, "script.js"), "utf8");

function pngDimensions(path) {
  const bytes = readFileSync(path);
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `${path} should be a PNG`);
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

function localAssetPath(url) {
  return join(root, url.replace(/^\.\//, ""));
}

test("web app manifest defines installable display and valid icon sizes", () => {
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.theme_color, "#07111f");
  assert.ok(manifest.icons.some((icon) => icon.purpose === "maskable"));

  for (const icon of manifest.icons) {
    const path = localAssetPath(icon.src);
    assert.ok(existsSync(path), `Missing manifest icon: ${icon.src}`);
    const expectedSize = Number(icon.sizes.split("x")[0]);
    assert.deepEqual(pngDimensions(path), [expectedSize, expectedSize]);
  }
});

test("all linked local app assets exist, including device-sized splash screens", () => {
  const assetUrls = [...html.matchAll(/(?:href|src)="(\.\/assets\/[^\"]+)"/g)].map((match) => match[1]);
  assert.ok(assetUrls.length > 0);
  for (const url of assetUrls) assert.ok(existsSync(localAssetPath(url)), `Missing HTML asset: ${url}`);

  const splashUrls = assetUrls.filter((url) => url.includes("/splash/"));
  assert.ok(splashUrls.length >= 5, "Expected multiple device-specific Apple startup images");
  for (const url of splashUrls) {
    const match = url.match(/splash-(iphone|ipad)-(\d+)x(\d+)\.png$/);
    assert.ok(match, `Unexpected splash filename: ${url}`);
    const scale = match[1] === "ipad" ? 2 : 3;
    assert.deepEqual(
      pngDimensions(localAssetPath(url)),
      [Number(match[2]) * scale, Number(match[3]) * scale],
    );
  }
});

test("scanner is bundled locally for offline use and QR payloads stay out of the cache", () => {
  assert.match(script, /decodeFromConstraints/);
  assert.match(script, /decodeFromImageUrl/);
  assert.match(script, /addQrStudioMark/);
  assert.match(script, /addHistoryItem\("generated"/);
  assert.match(script, /addHistoryItem\("scanned"/);
  assert.match(html, /mailto:medsonkasese@yahoo\.com/);
  assert.match(html, /id="autoOpenToggle"/);
  assert.match(html, /id="cameraLightToggle"/);
  assert.match(html, /id="themeSelect"/);
  assert.match(serviceWorker, /\.\/assets\/vendor\/zxing-browser\.min\.js/);
  assert.match(serviceWorker, /requestUrl\.origin !== self\.location\.origin/);
  assert.doesNotMatch(serviceWorker, /quickchart\.io/);

  const appShell = serviceWorker.match(/const APP_SHELL = \[([\s\S]*?)\];/);
  assert.ok(appShell, "Service worker should declare its app shell");
  const shellUrls = [...appShell[1].matchAll(/"([^\"]+)"/g)].map((match) => match[1]);
  assert.ok(shellUrls.includes("./app-state.js"), "Service worker should cache settings/history helpers for offline use");
  for (const url of shellUrls) {
    assert.ok(existsSync(localAssetPath(url)), `Missing service-worker app-shell asset: ${url}`);
  }
});
