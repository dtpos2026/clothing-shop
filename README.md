# DT Fabric POS — Digital Target Fabric & Clothing Store Management System

One product, three apps, one business identity:

| App | Tech | Output |
|---|---|---|
| **Windows desktop** | React + Electron 41 | `DT-Fabric-POS-Setup-<ver>.exe` (NSIS) and portable ZIP |
| **Android** | Same React app + Capacitor 8 (native camera, ML Kit scanner, files, share, notifications, WhatsApp/print plugin) | `app-release.apk` |
| **Super Admin web panel** | React (`admin.html`) + Firebase Hosting | `dist-admin/` |
| **Cloud** | Firebase Auth, Firestore, Storage, Cloud Functions, FCM | `firebase/`, `functions/` |

Windows and Android run the *same* business code (`src/`), so stock, POS, accounting, backup
and licensing behave identically on both. Everything works offline; Firebase sync is optional.

## Highlights
- **Fabric inventory**: meter / suit / piece selling, individual **Thaan (roll)** tracking with its own
  cost & history (50 m thaan − 4 m sale = 46 m), colour variants, wholesale/retail prices,
  damaged stock & adjustments, roll-accurate valuation.
- **POS**: search & scan (USB / Bluetooth HID scanners, camera), split payments (Cash, Bank, Card,
  JazzCash, EasyPaisa), udhar, discounts, returns & exchanges, hold/resume, 58/80 mm + A4/A5 printing.
- **Barcode & QR**: EAN-13/EAN-8/Code 128/QR, unique code generation, label sheets (38×25 … A4 40-up).
- **Six invoice templates** + designer (colours, logo, fields, column widths, paper, terms).
- **Export & Share Center**: PDF, PNG, CSV (Urdu-safe), Excel, ZIP; direct WhatsApp sharing.
- **Cross-platform backup** `.dtbackup.zip` with SHA-256 integrity, preview, safety backup, merge/replace.
- **Accounting** from real transactions: cash book, P&L (actual roll cost), customer & supplier ledgers, day close.
- **Unified license** (Ed25519-signed, device-bound, offline grace) controlled from the Super Admin panel.
- English / **اردو (RTL)**.

## Quick start
```bash
npm install
npm run dev          # web dev server (http://localhost:8080)
npm test             # unit tests (vitest)
npm run e2e          # end-to-end tests (Playwright)
npm run build        # production web build → dist/
```
Platform builds, signing and Firebase setup: **[docs/BUILD.md](docs/BUILD.md)**, **[docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md)**.

## Documentation
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — modules, data flow, sync, licensing, security
- [docs/MIGRATION.md](docs/MIGRATION.md) — database/schema migration from v1/v2 and upgrade safety
- [docs/BUILD.md](docs/BUILD.md) — Windows installer, Android APK, admin panel, CI
- [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md) — what you need to provide to enable the cloud
- [docs/QA_REPORT.md](docs/QA_REPORT.md) — what was tested, results, known limitations

© Digital Target
