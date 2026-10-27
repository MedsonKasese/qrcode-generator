# QR Studio

A lightweight, responsive QR code generator that works as a static website. Create QR codes for plain text, website links, Wi-Fi access, email, phone numbers, text messages, and contact cards (vCard).

## Features

- Seven payload formats, with validation and standards-friendly QR data.
- Custom code and background colors, three image sizes, and four error-correction levels; generated QR images include the QR Studio icon in the center, with high error correction selected by default.
- PNG download, copyable QR payload, responsive layout, keyboard support, and accessible status messages.
- Installable PWA with an offline app shell, app icons, and device-sized iOS startup images.
- Camera and image scanning for QR codes and common 1D/2D barcodes. Decoding runs locally in the browser; camera frames and chosen images are not uploaded.
- No install or build step. The ZXing scanner bundle is included locally for offline use.

## Run locally

Serve this folder with any static web server. For example, with Python:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000> in a browser. HTTPS or localhost is required for camera access and service workers. The app calls QuickChart's QR endpoint to create the base image, so an internet connection is needed to generate QR codes. QR content is sent to that service; do not encode passwords, private data, or other sensitive information. The center icon is added locally after the image is returned.

To install the app, use the browser's install option when available; iOS users can use Safari's Share menu and choose **Add to Home Screen**. The static interface and scanner work offline after the app shell has been cached, but QR generation still requires an internet connection.

## Test

The payload and PWA asset checks use Node.js's built-in test runner and require no package installation:

```sh
npm test
```

The scanner bundle is based on [ZXing Browser](https://github.com/zxing-js/browser) 0.1.5 and [ZXing JS](https://github.com/zxing-js/library) 0.21.3. Their MIT license texts are included in `assets/vendor/`.
