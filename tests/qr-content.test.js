import test from "node:test";
import assert from "node:assert/strict";
import { buildQrPayload } from "../qr-content.js";

test("text payloads preserve the entered text and reject blank content", () => {
  assert.equal(buildQrPayload("text", { text: "  meet at noon  " }), "meet at noon");
  assert.throws(() => buildQrPayload("text", { text: "   " }), /Text is required/);
});

test("website links must be valid HTTP or HTTPS URLs", () => {
  assert.equal(buildQrPayload("url", { url: "https://example.com/path" }), "https://example.com/path");
  assert.throws(() => buildQrPayload("url", { url: "example.com" }), /complete website URL/);
  assert.throws(() => buildQrPayload("url", { url: "ftp://example.com/file" }), /http:\/\/ or https:\/\//);
});

test("Wi-Fi payloads escape reserved characters and support open networks", () => {
  assert.equal(
    buildQrPayload("wifi", { ssid: "Room;2:4", security: "WPA", password: "a,b\\c", hidden: true }),
    "WIFI:T:WPA;S:Room\\;2\\:4;P:a\\,b\\\\c;H:true;;",
  );
  assert.equal(
    buildQrPayload("wifi", { ssid: "Guest", security: "nopass", password: "", hidden: false }),
    "WIFI:T:nopass;S:Guest;P:;H:false;;",
  );
  assert.throws(() => buildQrPayload("wifi", { ssid: "Home", security: "WPA", password: "" }), /Wi-Fi password is required/);
});

test("email and SMS payloads encode query data safely", () => {
  assert.equal(
    buildQrPayload("email", { email: "hello@example.com", subject: "Question & answer", body: "Hi\nthere" }),
    "mailto:hello@example.com?subject=Question%20%26%20answer&body=Hi%0Athere",
  );
  assert.equal(buildQrPayload("email", { email: "hello@example.com" }), "mailto:hello@example.com");
  assert.equal(
    buildQrPayload("sms", { phone: "+1 555 010 1234", message: "On my way!" }),
    "sms:+15550101234?body=On%20my%20way!",
  );
});

test("phone payloads use a tel URI", () => {
  assert.equal(buildQrPayload("phone", { phone: "+1 (555) 010-1234" }), "tel:+15550101234");
  assert.throws(() => buildQrPayload("phone", { phone: "call me" }), /must contain digits/);
});

test("contact cards create escaped vCard 3.0 data", () => {
  assert.equal(
    buildQrPayload("contact", { name: "Alex, Jr", organization: "Studio; North", phone: "+1 555 010 1234", email: "alex@example.com" }),
    "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Alex\\, Jr\r\nORG:Studio\\; North\r\nTEL;TYPE=CELL:+15550101234\r\nEMAIL:alex@example.com\r\nEND:VCARD",
  );
  assert.throws(() => buildQrPayload("contact", { name: "" }), /Full name is required/);
});

test("unknown types fail clearly", () => {
  assert.throws(() => buildQrPayload("barcode", { text: "abc" }), /supported QR code type/);
});
