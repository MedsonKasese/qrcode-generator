import { buildQrPayload } from "./qr-content.js";

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
}

function scannedFormatName(result) {
  const format = result.getBarcodeFormat();
  const formatName = window.QRStudioScanner?.BarcodeFormat?.[format] ?? String(format);
  return formatName.replace(/_/g, " ");
}

function showScannedResult(result, source) {
  if (!result) return;
  stopCameraScanner();
  scannerFormat.textContent = `${scannedFormatName(result)} · ${source}`;
  scannerText.textContent = result.getText();
  scannerResult.hidden = false;
  scannerStatus.textContent = `Code detected with ${source}.`;
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
    else scannerStatus.textContent = "Scanning. Hold a QR code or barcode steadily in the camera view.";
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

showActiveFields();
updateColorLabels();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.warn("QR Studio could not register its offline cache.", error);
    });
  });
}
