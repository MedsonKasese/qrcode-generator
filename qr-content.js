const requiredValue = (value, label) => {
  const clean = String(value ?? "").trim();
  if (!clean) throw new Error(`${label} is required.`);
  return clean;
};

const normalizePhone = (value, label) => {
  const raw = requiredValue(value, label);
  const phone = raw.replace(/[\s().-]/g, "");
  if (!/^\+?\d+$/.test(phone)) {
    throw new Error(`${label} must contain digits and may start with +.`);
  }
  return phone;
};

const escapeWifi = (value) => String(value ?? "").replace(/[\\;,:" ]/g, (character) => {
  if (character === " ") return " ";
  return `\\${character}`;
});

const escapeVCard = (value) => String(value ?? "")
  .replace(/\\/g, "\\\\")
  .replace(/\r?\n/g, "\\n")
  .replace(/([,;])/g, "\\$1");

/** Build the standards-based payload that will be encoded in a QR code. */
export function buildQrPayload(type, values = {}) {
  switch (type) {
    case "text":
      return requiredValue(values.text, "Text");

    case "url": {
      const rawUrl = requiredValue(values.url, "Website URL");
      let url;
      try {
        url = new URL(rawUrl);
      } catch {
        throw new Error("Enter a complete website URL, such as https://example.com.");
      }
      if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error("Website links must start with http:// or https://.");
      }
      return url.href;
    }

    case "wifi": {
      const ssid = requiredValue(values.ssid, "Network name");
      const security = ["WPA", "WEP", "nopass"].includes(values.security) ? values.security : "WPA";
      const password = security === "nopass" ? "" : requiredValue(values.password, "Wi-Fi password");
      const hidden = values.hidden ? "true" : "false";
      return `WIFI:T:${security};S:${escapeWifi(ssid)};P:${escapeWifi(password)};H:${hidden};;`;
    }

    case "email": {
      const address = requiredValue(values.email, "Email address");
      const query = [];
      if (String(values.subject ?? "").trim()) query.push(`subject=${encodeURIComponent(values.subject.trim())}`);
      if (String(values.body ?? "").trim()) query.push(`body=${encodeURIComponent(values.body.trim())}`);
      return `mailto:${address}${query.length ? `?${query.join("&")}` : ""}`;
    }

    case "phone":
      return `tel:${normalizePhone(values.phone, "Phone number")}`;

    case "sms": {
      const phone = normalizePhone(values.phone, "Recipient phone number");
      const message = requiredValue(values.message, "Message");
      return `sms:${phone}?body=${encodeURIComponent(message)}`;
    }

    case "contact": {
      const name = requiredValue(values.name, "Full name");
      const lines = [
        "BEGIN:VCARD",
        "VERSION:3.0",
        `FN:${escapeVCard(name)}`,
      ];
      if (String(values.organization ?? "").trim()) lines.push(`ORG:${escapeVCard(values.organization.trim())}`);
      if (String(values.phone ?? "").trim()) lines.push(`TEL;TYPE=CELL:${escapeVCard(normalizePhone(values.phone, "Phone number"))}`);
      if (String(values.email ?? "").trim()) lines.push(`EMAIL:${escapeVCard(values.email.trim())}`);
      lines.push("END:VCARD");
      return lines.join("\r\n");
    }

    default:
      throw new Error("Choose a supported QR code type.");
  }
}
