import { buildQrPayload } from "./qr-content.js";
import {
  createHistoryEntry,
  HISTORY_LIMIT,
  readHistory,
  readSettings,
  safeWebsiteUrl,
  writeHistory,
  writeSettings,
} from "./app-state.js";

const form = document.getElementById("qrForm");
const contentType = document.getElementById("contentType");
const previewPanel = document.querySelector(".preview-panel");
const previewPlaceholder = document.getElementById("previewPlaceholder");
const qrImage = document.getElementById("qrImage");
const loading = document.getElementById("loading");
const generateButton = document.getElementById("generateButton");
const downloadButton = document.getElementById("downloadButton");
const copyButton = document.getElementById("copyButton");
const statusMessage = document.getElementById("statusMessage");
const installButton = document.getElementById("installButton");
const autoOpenToggle = document.getElementById("autoOpenToggle");
const cameraLightToggle = document.getElementById("cameraLightToggle");
const themeSelect = document.getElementById("themeSelect");
const settingsStatus = document.getElementById("settingsStatus");
const historyList = document.getElementById("historyList");
const historyEmpty = document.getElementById("historyEmpty");
const historyStatus = document.getElementById("historyStatus");
const clearHistoryButton = document.getElementById("clearHistoryButton");
const wifiSecurity = document.getElementById("wifiSecurity");
const wifiPassword = document.getElementById("wifiPassword");
const wifiPasswordColumn = document.getElementById("wifiPasswordColumn");
const qrDark = document.getElementById("qrDark");
const qrLight = document.getElementById("qrLight");
const appIcon = new Image();
appIcon.src = new URL("./assets/icons/icon-512.png", import.meta.url).href;
const startScanButton = document.getElementById("startScanButton");
const stopScanButton = document.getElementById("stopScanButton");
const scanImageInput = document.getElementById("scanImageInput");
const scannerCamera = document.getElementById("scannerCamera");
const scannerVideo = document.getElementById("scannerVideo");
const scannerStatus = document.getElementById("scannerStatus");
const scannerResult = document.getElementById("scannerResult");
const scannerFormat = document.getElementById("scannerFormat");
const scannerText = document.getElementById("scannerText");
const copyScanResultButton = document.getElementById("copyScanResultButton");
const openScanWebsiteButton = document.getElementById("openScanWebsiteButton");
const requiredByType = {
  text: ["textValue"],
  url: ["urlValue"],
  wifi: ["wifiName"],
  email: ["emailAddress"],
  phone: ["phoneNumber"],
  sms: ["smsNumber", "smsMessage"],
  contact: ["contactName"],
};

let currentObjectUrl = "";
let currentPayload = "";
let currentRequest = null;
let requestVersion = 0;
let deferredInstallPrompt = null;
let scannerReader = null;
let scannerControls = null;
let cameraScanActive = false;
const settings = readSettings();
const historyItems = readHistory();
const systemThemePreference = window.matchMedia?.("(prefers-color-scheme: light)");

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("is-error", isError);
}

function clearCurrentCode() {
  requestVersion += 1;
  currentRequest?.abort();
  currentRequest = null;
  if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
  currentObjectUrl = "";
  currentPayload = "";
  qrImage.removeAttribute("src");
  qrImage.hidden = true;
  previewPlaceholder.hidden = false;
  loading.hidden = true;
  previewPanel.setAttribute("aria-busy", "false");
  generateButton.disabled = false;
  downloadButton.disabled = true;
  copyButton.disabled = true;
}

function showActiveFields() {
  document.querySelectorAll(".content-fields").forEach((fieldset) => {
    const active = fieldset.id === `fields-${contentType.value}`;
    fieldset.hidden = !active;
    fieldset.disabled = !active;
    fieldset.querySelectorAll("input, textarea").forEach((field) => { field.required = false; });
  });
  (requiredByType[contentType.value] || []).forEach((id) => {
    document.getElementById(id).required = true;
  });
  syncWifiPassword();
}

function syncWifiPassword() {
  const needsPassword = wifiSecurity.value !== "nopass";
  wifiPassword.disabled = !needsPassword || contentType.value !== "wifi";
  wifiPassword.required = needsPassword && contentType.value === "wifi";
  wifiPasswordColumn.hidden = !needsPassword;
}

function updateColorLabels() {
  document.getElementById("darkColorValue").textContent = qrDark.value.toUpperCase();
  document.getElementById("lightColorValue").textContent = qrLight.value.toUpperCase();
}

function applyTheme(theme) {
  const useLight = theme === "light" || (theme === "system" && systemThemePreference?.matches);
  document.documentElement.dataset.theme = useLight ? "light" : "dark";
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.content = useLight ? "#f2f6fa" : "#07111f";
}

function saveSettings(message = "Settings are saved only on this device.") {
  settingsStatus.textContent = writeSettings(settings)
    ? message
    : "Could not save settings in this browser. Check its storage settings.";
}

function renderHistory() {
  historyList.replaceChildren();
  historyEmpty.hidden = historyItems.length > 0;
  clearHistoryButton.disabled = historyItems.length === 0;

  historyItems.forEach((entry) => {
    const item = document.createElement("article");
    item.className = "history-item";
    item.setAttribute("role", "listitem");

    const heading = document.createElement("div");
    heading.className = "history-item-heading";
    const title = document.createElement("strong");
    title.textContent = `${entry.kind === "generated" ? "Generated" : "Scanned"} · ${entry.label}`;
    const time = document.createElement("time");
    const date = new Date(entry.timestamp);
    time.textContent = Number.isNaN(date.getTime()) ? "Saved" : date.toLocaleString();
    heading.append(title, time);

    const payload = document.createElement("p");
    payload.className = "history-payload";
    payload.textContent = entry.payload.length > 280 ? `${entry.payload.slice(0, 280)}…` : entry.payload;

    let fullPayloadDetails = null;
    if (entry.payload.length > 280) {
      fullPayloadDetails = document.createElement("details");
      fullPayloadDetails.className = "history-full-content";
      const fullPayloadSummary = document.createElement("summary");
      fullPayloadSummary.textContent = "View full content";
      const fullPayload = document.createElement("pre");
      fullPayload.textContent = entry.payload;
      fullPayloadDetails.append(fullPayloadSummary, fullPayload);
    }

    const actions = document.createElement("div");
    actions.className = "history-actions";
    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "button button-copy";
    copyButton.textContent = "Copy content";
    copyButton.dataset.action = "copy";
    copyButton.dataset.itemId = entry.id;
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "button button-quiet";
    removeButton.textContent = "Remove";
    removeButton.dataset.action = "remove";
    removeButton.dataset.itemId = entry.id;
    actions.append(copyButton, removeButton);
    item.append(heading, payload);
    if (fullPayloadDetails) item.append(fullPayloadDetails);
    item.append(actions);
    historyList.append(item);
  });

  historyStatus.textContent = historyItems.length
    ? `${historyItems.length} ${historyItems.length === 1 ? "code" : "codes"} saved on this device.`
    : "";
}

function addHistoryItem(kind, payload, label) {
  try {
    historyItems.unshift(createHistoryEntry({ kind, payload, label }));
    historyItems.splice(HISTORY_LIMIT);
    const saved = writeHistory(historyItems);
    renderHistory();
    if (!saved) historyStatus.textContent = "This code is in history for this session, but browser storage could not save it.";
  } catch {
    historyStatus.textContent = "This code could not be added to history.";
  }
}

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const temporaryInput = document.createElement("textarea");
    temporaryInput.value = value;
    temporaryInput.setAttribute("readonly", "");
    temporaryInput.style.position = "fixed";
    temporaryInput.style.opacity = "0";
    document.body.append(temporaryInput);
    temporaryInput.select();
    const copied = document.execCommand("copy");
    temporaryInput.remove();
    return copied;
  }
}

function autoOpenScannedWebsite(payload) {
  if (!settings.autoOpenWebsites) return false;
  const safeUrl = safeWebsiteUrl(payload);
  if (!safeUrl) return false;
  const link = document.createElement("a");
  link.href = safeUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  return true;
}

async function applyCameraLight(enabled) {
  const track = scannerVideo.srcObject?.getVideoTracks?.()[0];
  if (!track?.applyConstraints) return false;
  try {
    const capabilities = track.getCapabilities?.();
    if (capabilities?.torch !== true) return false;
    await track.applyConstraints({ advanced: [{ torch: enabled }] });
    return true;
  } catch {
    return false;
  }
}

function readFormValues() {
  return {
    text: document.getElementById("textValue").value,
    url: document.getElementById("urlValue").value,
    ssid: document.getElementById("wifiName").value,
    security: wifiSecurity.value,
    password: wifiPassword.value,
    hidden: document.getElementById("wifiHidden").checked,
    email: document.getElementById("emailAddress").value,
    subject: document.getElementById("emailSubject").value,
    body: document.getElementById("emailBody").value,
    phone: document.getElementById("phoneNumber").value,
    smsPhone: document.getElementById("smsNumber").value,
    smsMessage: document.getElementById("smsMessage").value,
    name: document.getElementById("contactName").value,
    organization: document.getElementById("contactOrganization").value,
    contactPhone: document.getElementById("contactPhone").value,
    contactEmail: document.getElementById("contactEmail").value,
  };
}

function payloadForCurrentType(values) {
  if (contentType.value === "sms") {
    return buildQrPayload("sms", { phone: values.smsPhone, message: values.smsMessage });
  }
  if (contentType.value === "contact") {
    return buildQrPayload("contact", {
      name: values.name,
      organization: values.organization,
      phone: values.contactPhone,
      email: values.contactEmail,
    });
  }
  return buildQrPayload(contentType.value, values);
}

async function addQrStudioMark(qrBlob) {
  await appIcon.decode();
  const sourceUrl = URL.createObjectURL(qrBlob);
  try {
    const qrSource = new Image();
    qrSource.src = sourceUrl;
    await qrSource.decode();

    const canvas = document.createElement("canvas");
    canvas.width = qrSource.naturalWidth;
    canvas.height = qrSource.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser could not prepare the QR Studio logo overlay.");
    context.drawImage(qrSource, 0, 0);

    const badgeSize = Math.round(Math.min(canvas.width, canvas.height) * 0.2);
    const iconSize = Math.round(badgeSize * 0.82);
    const centerX = (canvas.width - badgeSize) / 2;
    const centerY = (canvas.height - badgeSize) / 2;
    context.fillStyle = "#ffffff";
    context.fillRect(centerX, centerY, badgeSize, badgeSize);
    context.drawImage(
      appIcon,
      (canvas.width - iconSize) / 2,
      (canvas.height - iconSize) / 2,
      iconSize,
      iconSize,
    );

    const resultBlob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!resultBlob) throw new Error("This browser could not export the QR code image.");
    return resultBlob;
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

function getScannerReader() {
  const Reader = window.QRStudioScanner?.BrowserMultiFormatReader;
  if (!Reader) throw new Error("The local scanner could not be loaded. Refresh the app and try again.");
  if (!scannerReader) scannerReader = new Reader();
  return scannerReader;
}

function stopCameraScanner() {
  cameraScanActive = false;
  try {
    scannerControls?.stop();
  } catch (error) {
    console.warn("QR Studio could not stop scanner controls cleanly.", error);
  }
  scannerControls = null;
  const stream = scannerVideo.srcObject;
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    scannerVideo.srcObject = null;
  }
  scannerCamera.hidden = true;
  startScanButton.disabled = false;
  stopScanButton.disabled = true;
}

function clearScannedResult() {
  scannerResult.hidden = true;
  scannerFormat.textContent = "";
  scannerText.textContent = "";
  openScanWebsiteButton.hidden = true;
  openScanWebsiteButton.href = "#";
}

function scannedFormatName(result) {
  const format = result.getBarcodeFormat();
  const formatName = window.QRStudioScanner?.BarcodeFormat?.[format] ?? String(format);
  return formatName.replace(/_/g, " ");
}

function showScannedResult(result, source) {
  if (!result) return;
  stopCameraScanner();
  const format = scannedFormatName(result);
  const payload = result.getText();
  scannerFormat.textContent = `${format} · ${source}`;
  scannerText.textContent = payload;
  scannerResult.hidden = false;
  addHistoryItem("scanned", payload, format);
  const websiteUrl = safeWebsiteUrl(payload);
  openScanWebsiteButton.hidden = !websiteUrl;
  openScanWebsiteButton.href = websiteUrl || "#";
  const openedWebsite = autoOpenScannedWebsite(payload);
  scannerStatus.textContent = openedWebsite
    ? `Website detected with ${source}. Automatic opening was requested; if blocked, use Open website below.`
    : websiteUrl
      ? `Website detected with ${source}. Use Open website below to continue.`
      : `Code detected with ${source}.`;
}

async function startCameraScanner() {
  stopCameraScanner();
  clearScannedResult();
  if (!navigator.mediaDevices?.getUserMedia) {
    scannerStatus.textContent = "Camera scanning requires HTTPS or localhost. You can still choose an image to scan.";
    return;
  }

  let reader;
  try {
    reader = getScannerReader();
  } catch (error) {
    scannerStatus.textContent = error.message;
    return;
  }

  cameraScanActive = true;
  scannerCamera.hidden = false;
  startScanButton.disabled = true;
  stopScanButton.disabled = false;
  scannerStatus.textContent = "Requesting camera access…";

  try {
    const controls = await reader.decodeFromConstraints(
      { video: { facingMode: { ideal: "environment" } }, audio: false },
      scannerVideo,
      (result) => {
        if (result && cameraScanActive) showScannedResult(result, "camera");
      },
    );
    scannerControls = controls;
    if (!cameraScanActive) controls.stop();
    else if (settings.useCameraLight) {
      const lightEnabled = await applyCameraLight(true);
      if (cameraScanActive) {
        scannerStatus.textContent = lightEnabled
          ? "Scanning with the camera light on. Hold a QR code or barcode steadily in view."
          : "Scanning. This camera does not support flashlight control; try more light or choose an image.";
      }
    } else scannerStatus.textContent = "Scanning. Hold a QR code or barcode steadily in the camera view.";
  } catch (error) {
    stopCameraScanner();
    if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
      scannerStatus.textContent = "Camera access was denied. Allow camera access in your browser, or choose an image instead.";
    } else if (error.name === "NotFoundError" || error.name === "OverconstrainedError") {
      scannerStatus.textContent = "No usable camera was found. You can still choose an image to scan.";
    } else {
      scannerStatus.textContent = "Camera could not start. Check browser permissions or choose an image instead.";
    }
  }
}

async function scanSelectedImage(file) {
  if (!file) return;
  stopCameraScanner();
  clearScannedResult();
  if (!file.type.startsWith("image/")) {
    scannerStatus.textContent = "Choose a valid image file containing a QR code or barcode.";
    scanImageInput.value = "";
    return;
  }

  scannerStatus.textContent = "Reading the image on this device…";
  const imageUrl = URL.createObjectURL(file);
  try {
    const result = await getScannerReader().decodeFromImageUrl(imageUrl);
    showScannedResult(result, "image");
  } catch {
    scannerStatus.textContent = "No supported code was found. Try a sharper, well-lit image with the code fully visible.";
  } finally {
    URL.revokeObjectURL(imageUrl);
    scanImageInput.value = "";
  }
}

function handleFormEdit(event) {
  if (event.target === contentType) showActiveFields();
  if (event.target === wifiSecurity) syncWifiPassword();
  if (event.target === qrDark || event.target === qrLight) updateColorLabels();
  clearCurrentCode();
  setStatus("Your settings changed. Generate a new QR code to update the preview.");
}

form.addEventListener("input", handleFormEdit);
form.addEventListener("change", handleFormEdit);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;

  let payload;
  try {
    payload = payloadForCurrentType(readFormValues());
  } catch (error) {
    setStatus(error.message, true);
    return;
  }

  clearCurrentCode();
  const thisRequest = requestVersion;
  const controller = new AbortController();
  currentRequest = controller;
  loading.hidden = false;
  previewPlaceholder.hidden = true;
  previewPanel.setAttribute("aria-busy", "true");
  generateButton.disabled = true;
  setStatus("Creating your QR code…");

  const query = new URLSearchParams({
    text: payload,
    size: document.getElementById("qrSize").value,
    dark: qrDark.value.slice(1),
    light: qrLight.value.slice(1),
    ecLevel: document.getElementById("qrErrorCorrection").value,
    margin: "2",
  });

  let pendingObjectUrl = "";
  try {
    const response = await fetch(`https://quickchart.io/qr?${query.toString()}`, {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error("The QR service could not create an image. Please try again.");

    const qrBlob = await response.blob();
    if (!qrBlob.type.startsWith("image/")) {
      throw new Error("The QR service returned an unexpected response. Please try again.");
    }

    const imageBlob = await addQrStudioMark(qrBlob);
    pendingObjectUrl = URL.createObjectURL(imageBlob);
    qrImage.src = pendingObjectUrl;
    await qrImage.decode();
    if (thisRequest !== requestVersion) {
      URL.revokeObjectURL(pendingObjectUrl);
      return;
    }

    currentObjectUrl = pendingObjectUrl;
    pendingObjectUrl = "";
    currentPayload = payload;
    qrImage.hidden = false;
    previewPlaceholder.hidden = true;
    downloadButton.disabled = false;
    copyButton.disabled = false;
    addHistoryItem("generated", payload, contentType.options[contentType.selectedIndex].textContent);
    setStatus("Your QR code is ready, with the QR Studio icon centered.");
  } catch (error) {
    if (pendingObjectUrl) URL.revokeObjectURL(pendingObjectUrl);
    if (error.name !== "AbortError" && thisRequest === requestVersion) {
      previewPlaceholder.hidden = false;
      setStatus(error.message || "Could not create the QR code. Check your connection and try again.", true);
    }
  } finally {
    if (thisRequest === requestVersion) {
      currentRequest = null;
      loading.hidden = true;
      previewPanel.setAttribute("aria-busy", "false");
      generateButton.disabled = false;
    }
  }
});

downloadButton.addEventListener("click", () => {
  if (!currentObjectUrl) return;
  const link = document.createElement("a");
  link.href = currentObjectUrl;
  link.download = "qr-code.png";
  document.body.append(link);
  link.click();
  link.remove();
});

copyButton.addEventListener("click", async () => {
  if (!currentPayload) return;
  try {
    await navigator.clipboard.writeText(currentPayload);
    setStatus("QR content copied to your clipboard.");
  } catch {
    const temporaryInput = document.createElement("textarea");
    temporaryInput.value = currentPayload;
    temporaryInput.setAttribute("readonly", "");
    temporaryInput.style.position = "fixed";
    temporaryInput.style.opacity = "0";
    document.body.append(temporaryInput);
    temporaryInput.select();
    const copied = document.execCommand("copy");
    temporaryInput.remove();
    setStatus(copied ? "QR content copied to your clipboard." : "Clipboard access was blocked by your browser.", !copied);
  }
});

startScanButton.addEventListener("click", startCameraScanner);
stopScanButton.addEventListener("click", () => {
  stopCameraScanner();
  scannerStatus.textContent = "Camera stopped.";
});
scanImageInput.addEventListener("change", () => scanSelectedImage(scanImageInput.files?.[0]));

historyList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const entry = historyItems.find((item) => item.id === button.dataset.itemId);
  if (!entry) return;

  if (button.dataset.action === "copy") {
    historyStatus.textContent = await copyText(entry.payload)
      ? "Code content copied to your clipboard."
      : "Clipboard access was blocked by your browser.";
    return;
  }

  if (button.dataset.action === "remove") {
    const index = historyItems.findIndex((item) => item.id === entry.id);
    if (index !== -1) historyItems.splice(index, 1);
    const saved = writeHistory(historyItems);
    renderHistory();
    if (!saved) historyStatus.textContent = "The item was removed for this session, but browser storage could not be updated.";
  }
});

clearHistoryButton.addEventListener("click", () => {
  if (!historyItems.length || !window.confirm("Clear all saved QR history from this browser?")) return;
  historyItems.length = 0;
  const saved = writeHistory(historyItems);
  renderHistory();
  if (!saved) historyStatus.textContent = "History was cleared for this session, but browser storage could not be updated.";
});

autoOpenToggle.addEventListener("change", () => {
  settings.autoOpenWebsites = autoOpenToggle.checked;
  saveSettings(settings.autoOpenWebsites
    ? "Scanned HTTP and HTTPS links may now open automatically in a new tab."
    : "Automatic website opening is off.");
});

cameraLightToggle.addEventListener("change", async () => {
  settings.useCameraLight = cameraLightToggle.checked;
  saveSettings(settings.useCameraLight
    ? "Camera light will be used during live scanning where supported."
    : "Camera light will stay off during scanning.");
  if (!cameraScanActive || !scannerVideo.srcObject) {
    scannerStatus.textContent = settings.useCameraLight
      ? "Camera light preference saved; it will apply when a live scan starts."
      : "Camera light preference saved.";
    return;
  }
  const applied = await applyCameraLight(settings.useCameraLight);
  scannerStatus.textContent = applied
    ? settings.useCameraLight ? "Camera light turned on." : "Camera light turned off."
    : "This camera does not support flashlight control.";
});

themeSelect.addEventListener("change", () => {
  settings.theme = themeSelect.value;
  applyTheme(settings.theme);
  saveSettings("Theme preference saved on this device.");
});

systemThemePreference?.addEventListener("change", () => {
  if (settings.theme === "system") applyTheme("system");
});

copyScanResultButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(scannerText.textContent);
    scannerStatus.textContent = "Scanned content copied to your clipboard.";
  } catch {
    const temporaryInput = document.createElement("textarea");
    temporaryInput.value = scannerText.textContent;
    temporaryInput.setAttribute("readonly", "");
    temporaryInput.style.position = "fixed";
    temporaryInput.style.opacity = "0";
    document.body.append(temporaryInput);
    temporaryInput.select();
    const copied = document.execCommand("copy");
    temporaryInput.remove();
    scannerStatus.textContent = copied
      ? "Scanned content copied to your clipboard."
      : "Clipboard access was blocked by your browser.";
  }
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installButton.hidden = true;
  if (outcome === "accepted") setStatus("QR Studio was installed on your device.");
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  installButton.hidden = true;
});

form.addEventListener("reset", () => {
  window.setTimeout(() => {
    clearCurrentCode();
    showActiveFields();
    updateColorLabels();
    setStatus("Choose a type and enter your content to get started.");
  }, 0);
});

autoOpenToggle.checked = settings.autoOpenWebsites;
cameraLightToggle.checked = settings.useCameraLight;
themeSelect.value = settings.theme;
applyTheme(settings.theme);
renderHistory();
showActiveFields();
updateColorLabels();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.warn("QR Studio could not register its offline cache.", error);
    });
  });
}
