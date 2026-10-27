import test from "node:test";
import assert from "node:assert/strict";
import {
  createHistoryEntry,
  DEFAULT_SETTINGS,
  HISTORY_LIMIT,
  HISTORY_STORAGE_KEY,
  readHistory,
  readSettings,
  safeWebsiteUrl,
  SETTINGS_STORAGE_KEY,
  writeHistory,
  writeSettings,
} from "../app-state.js";

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
}

test("settings use safe defaults, persist supported values, and reject unknown themes", () => {
  const storage = createStorage();
  assert.deepEqual(readSettings(storage), DEFAULT_SETTINGS);
  assert.equal(writeSettings({ autoOpenWebsites: true, useCameraLight: true, theme: "light" }, storage), true);
  assert.deepEqual(readSettings(storage), { autoOpenWebsites: true, useCameraLight: true, theme: "light" });
  assert.equal(writeSettings({ theme: "ultraviolet" }, storage), true);
  assert.deepEqual(readSettings(storage), { ...DEFAULT_SETTINGS });
  assert.equal(storage.getItem(SETTINGS_STORAGE_KEY) !== null, true);
});

test("history keeps valid newest items within its limit and survives malformed storage", () => {
  const storage = createStorage();
  const entries = Array.from({ length: HISTORY_LIMIT + 5 }, (_, index) => createHistoryEntry({
    kind: index % 2 ? "generated" : "scanned",
    label: `Item ${index}`,
    payload: `payload-${index}`,
  }));
  assert.equal(writeHistory(entries, storage), true);
  assert.equal(readHistory(storage).length, HISTORY_LIMIT);
  assert.equal(readHistory(storage)[0].payload, entries[0].payload);
  storage.setItem(HISTORY_STORAGE_KEY, "not json");
  assert.deepEqual(readHistory(storage), []);
});

test("history entries retain content and reject empty payloads", () => {
  const entry = createHistoryEntry({ kind: "scanned", label: "QR_CODE", payload: "https://example.com", now: new Date("2026-01-02T03:04:05.000Z") });
  assert.equal(entry.kind, "scanned");
  assert.equal(entry.payload, "https://example.com");
  assert.equal(entry.timestamp, "2026-01-02T03:04:05.000Z");
  assert.throws(() => createHistoryEntry({ kind: "generated", payload: "" }), /content is required/);
  assert.throws(() => createHistoryEntry({ kind: "other", payload: "value" }), /Unsupported/);
});

test("automatic opening accepts only credential-free HTTP and HTTPS URLs", () => {
  assert.equal(safeWebsiteUrl(" https://example.com/path "), "https://example.com/path");
  assert.equal(safeWebsiteUrl("http://example.com"), "http://example.com/");
  assert.equal(safeWebsiteUrl("javascript:alert(1)"), null);
  assert.equal(safeWebsiteUrl("mailto:hello@example.com"), null);
  assert.equal(safeWebsiteUrl("https://user:pass@example.com"), null);
  assert.equal(safeWebsiteUrl("example.com"), null);
});
