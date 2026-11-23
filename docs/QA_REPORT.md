# QA & Testing Report — v3.0.0

Environment: Linux build container (Node 22, Chromium via Playwright 1.65, JDK 21, Android SDK 36,
Electron 41). Date: 2026-11-23.

## Automated results
| Suite | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` | ✅ 0 errors |
| Unit tests (core + store) | `npm test` | ✅ 44 / 44 |
| End-to-end (desktop 1366×820 + Pixel 7) | `npm run e2e` | ✅ 9 / 9 |
| Cloud Functions (license signing ↔ app verification) | `npm --prefix functions test` | ✅ 1 / 1 |
| Web build / Admin build | `npm run build`, `npm run build:admin` | ✅ |
| Android release APK | `./gradlew assembleRelease` | ✅ `app-release.apk` (v3.0.0, versionCode 30000, minSdk 24, targetSdk 36), signature verified with apksigner |
| Windows app | `electron-builder --win zip` | ✅ portable x64 build; NSIS installer ⚠️ see below |
| Electron runtime smoke test (Linux, same main/preload) | Playwright `_electron` | ✅ preload API, file IPC, path-traversal blocked, app renders |
| Windows upgrade with real v1 data | Electron + v1 store in legacy folder | ✅ products & sales preserved, schema 0 → 2, legacy folder untouched, no demo data injected |
| Lint (new code) | `eslint` on core/cloud/platform/services/admin/POS | ✅ clean (16 pre-existing errors remain in untouched v1 files) |

### Scenarios covered by tests
- **Thaan**: 50 m roll, sell 4 m → roll 46 m, product stock and cost of goods correct (unit + e2e through the real POS UI).
- Multiple rolls of one design (FIFO, chosen roll, per-roll cost), colour rolls, legacy stock → opening rolls.
- Meter / suit / piece pricing, wholesale tier, valuation.
- Split payments, udhar requires customer, credit created; cash book per method.
- Returns: restock to roll, udhar adjusted first, over-return refused, P&L nets returns.
- Day close keeps sales (v1 deleted them); cash difference.
- Purchases create thaans and supplier payable; damaged stock → loss in P&L.
- **Barcodes**: EAN-13/8 check digits, unique generation, duplicate rejection, scan parsing incl. v1 JSON QR stickers.
- **USB/Bluetooth HID scanner** (keyboard wedge) adds product to cart (e2e).
- **Camera scanner** dialog opens on the Android-size layout with a fake camera; manual code entry works.
- **Backup**: Windows→Android round-trip incl. images & Urdu text; tamper detection; path-traversal/exe entries ignored;
  newer-schema refusal; legacy v1 JSON; merge with duplicate detection; full UI flow save → preview → merge (e2e).
- **Exports**: CSV (BOM, Urdu, formula-injection guard) and XLSX downloads (e2e).
- **Licensing**: valid token on Windows & Android device ids, copied token rejected, forged expiry rejected,
  wrong signing key rejected, offline grace then lock-out, expired/suspended, key check character;
  server-signed tokens verify in the app's verifier.
- **Sync** merge logic: identity diff, LWW, tombstones, conflict reporting, no input mutation.
- Six invoice templates present and selectable as default (e2e); Urdu switches the UI to RTL (e2e).

## Not verifiable in this environment (needs your hardware / accounts)
| Item | Status | How to verify |
|---|---|---|
| Windows NSIS installer `.exe` | ⚠️ Wine crashes in this container, so the installer wrapper could not be produced here. The app itself built and runs. | Built automatically by CI on `windows-latest` (`.github/workflows/build.yml`), or `npm run electron:dist` on a Windows PC. |
| Real thermal printers (58/80 mm), silent printing | Not tested (no printer) | Settings → Printer → choose printer; print a receipt. |
| Physical USB / Bluetooth scanners | Logic tested via simulated fast keystrokes | Scan a label in POS. |
| Android device: ML Kit scanner, camera photos, notifications permission, WhatsApp direct share, system print | APK builds; not run on a phone here | Install the APK; checklist below. |
| Firebase sync / activation / FCM / Firestore rules on a live project | Code complete, not deployed (no Firebase project/credentials) | Follow docs/FIREBASE_SETUP.md; then test with two devices. |
| WhatsApp delivery | By design the app reports only that WhatsApp was **opened** with the file; delivery is confirmed by the user pressing Send. | — |

### Device checklist (Android)
1. Install APK → app opens offline with your data (restore a Windows backup via Backup → Choose file).
2. Scan button → Google scanner opens (first run may download the module); EAN-13 & QR labels found.
3. Inventory → product → camera icon → photo saved on product.
4. Settings → Notifications → Allow → Send test.
5. Invoice → PDF→WA with a customer phone → WhatsApp opens that chat with the PDF attached.
6. Invoice → Print → Android print dialog (Bluetooth thermal via RawBT print service, or Wi-Fi printer).
7. Export Center → Excel → Share → Google Drive/WhatsApp.

## Known limitations
- Sync uses record-level last-writer-wins; simultaneous offline sales of the same product on two devices
  can leave that product's stock figure from one device (sales are never lost; conflicts are flagged).
- Urdu translation covers navigation, POS and common actions; deeper report screens are still English
  (they accept and display Urdu data correctly, incl. PDF/PNG exports).
- jsPDF-based legacy reports (v1 "PDF Report" buttons) cannot shape Urdu; the new Export Center PDFs
  (HTML-rendered) can.
- The Android build merges `SCHEDULE_EXACT_ALARM` from the notifications plugin; remove it if Play policy
  requires (`tools:node="remove"` in the manifest) — reminders then fire at inexact times.
- Lint: 16 pre-existing errors in v1 files (`pdfExport.ts`, `Udhar.tsx`, …) were left unchanged.
