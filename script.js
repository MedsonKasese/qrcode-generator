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
const wifiSecurity = document.getElementById("wifiSecurity");
const wifiPassword = document.getElementById("wifiPassword");
const wifiPasswordColumn = document.getElementById("wifiPasswordColumn");
const qrDark = document.getElementById("qrDark");
const qrLight = document.getElementById("qrLight");
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

    const imageBlob = await response.blob();
    if (!imageBlob.type.startsWith("image/")) {
      throw new Error("The QR service returned an unexpected response. Please try again.");
    }

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
    setStatus("Your QR code is ready to download or share.");
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
