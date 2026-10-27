export const SETTINGS_STORAGE_KEY = "qr-studio-settings-v1";
export const HISTORY_STORAGE_KEY = "qr-studio-history-v1";
export const HISTORY_LIMIT = 50;

export const DEFAULT_SETTINGS = Object.freeze({
  autoOpenWebsites: false,
  useCameraLight: false,
  theme: "system",
});

const validThemes = new Set(["system", "light", "dark"]);

function getStorage(storage) {
  const resolved = storage ?? globalThis.localStorage;
  if (!resolved) throw new Error("Browser storage is unavailable.");
  return resolved;
}

export function readSettings(storage) {
  try {
    const saved = JSON.parse(getStorage(storage).getItem(SETTINGS_STORAGE_KEY) || "{}");
    return {
      autoOpenWebsites: saved.autoOpenWebsites === true,
      useCameraLight: saved.useCameraLight === true,
      theme: validThemes.has(saved.theme) ? saved.theme : DEFAULT_SETTINGS.theme,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function writeSettings(settings, storage) {
  try {
    const clean = {
      autoOpenWebsites: settings.autoOpenWebsites === true,
      useCameraLight: settings.useCameraLight === true,
      theme: validThemes.has(settings.theme) ? settings.theme : DEFAULT_SETTINGS.theme,
    };
    getStorage(storage).setItem(SETTINGS_STORAGE_KEY, JSON.stringify(clean));
    return true;
  } catch {
    return false;
  }
}

export function readHistory(storage) {
  try {
    const saved = JSON.parse(getStorage(storage).getItem(HISTORY_STORAGE_KEY) || "[]");
    if (!Array.isArray(saved)) return [];
    return saved
      .filter((entry) => entry && ["generated", "scanned"].includes(entry.kind)
        && typeof entry.payload === "string"
        && typeof entry.timestamp === "string")
      .map((entry) => ({
        id: String(entry.id || `${entry.timestamp}-${entry.kind}`),
        kind: entry.kind,
        label: typeof entry.label === "string" ? entry.label.slice(0, 80) : "QR code",
        payload: entry.payload,
        timestamp: entry.timestamp,
      }))
      .slice(0, HISTORY_LIMIT);
  } catch {
    return [];
  }
}

export function writeHistory(history, storage) {
  try {
    getStorage(storage).setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, HISTORY_LIMIT)));
    return true;
  } catch {
    return false;
  }
}

export function createHistoryEntry({ kind, payload, label, now = new Date() }) {
  if (!["generated", "scanned"].includes(kind)) throw new Error("Unsupported history entry type.");
  const cleanPayload = String(payload ?? "");
  if (!cleanPayload) throw new Error("QR code content is required.");
  return {
    id: `qr-${now.getTime()}-${Math.random().toString(36).slice(2, 9)}`,
    kind,
    label: String(label ?? "QR code").slice(0, 80),
    payload: cleanPayload,
    timestamp: now.toISOString(),
  };
}

export function safeWebsiteUrl(value) {
  try {
    const url = new URL(String(value ?? "").trim());
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}
