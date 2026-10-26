# QR Studio

A lightweight, responsive QR code generator that works as a static website. Create QR codes for plain text, website links, Wi-Fi access, email, phone numbers, text messages, and contact cards (vCard).

## Features

- Seven payload formats, with validation and standards-friendly QR data.
- Custom code and background colors, three image sizes, and four error-correction levels.
- PNG download, copyable QR payload, responsive layout, keyboard support, and accessible status messages.
- No runtime package dependencies or build step.

## Run locally

Serve this folder with any static web server. For example, with Python:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000> in a browser. The app calls QuickChart's QR endpoint to create the PNG, so an internet connection is needed. QR content is sent to that service; do not encode passwords, private data, or other sensitive information.

## Test

The payload format tests use Node.js's built-in test runner and require no package installation:

```sh
npm test
```
