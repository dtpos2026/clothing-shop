# Architecture

```
src/
  core/          pure business logic, no React/platform code — unit tested
    inventory.ts   units (meter/suit/piece), thaan/roll FIFO cutting, valuation, pricing tiers
    accounting.ts  cash book, P&L (COGS captured per sale), customer/supplier ledgers, amount in words
    barcode.ts     EAN-13/8 check digits, unique code/SKU generation, scan parsing (incl. v1 JSON QR)
    backup.ts      .dtbackup.zip build/validate/merge (manifest + SHA-256, safe extraction)
    license.ts     Ed25519 token verification, key format, offline grace
    migrations.ts  schema migrations (persisted state AND backups)
    syncDiff.ts    change detection + last-writer-wins merge
    csv.ts, defaults.ts
  store/useStore.ts   zustand store (persist v2) – single source of truth on each device
  platform/      one API, three implementations (Electron IPC / Capacitor / browser)
    files.ts  save, share, WhatsApp, pick   print.ts  scanner.ts  images.ts  notifications.ts  device.ts
  cloud/         Firebase bootstrap, sync engine, license service, runtime status
  services/      backup workflows, background services (alerts, auto-backup, license refresh)
  components/    UI (invoice templates, scanner, layout, share buttons, …)
  pages/         screens
  admin/         Super Admin panel (separate entry: admin.html)
electron/        Windows shell: JSON DB (atomic writes + .bak), file/print IPC, legacy data migration
android/         Capacitor project + DtNativePlugin.java (WhatsApp share, PrintManager)
functions/       Cloud Functions (license issuing/activation, admin ops, scheduled jobs)
firebase/        Firestore & Storage security rules, indexes
```

## Data & storage
- Each device keeps the full business dataset locally (Windows: `%APPDATA%/dt-fabric-pos/db/*.json`,
  Android/web: WebView storage). The app is fully functional offline.
- Records are immutable-updated; every collection is an array of records with a UUID `id`.
- Business identity: `businessId` (in data, travels with backups/sync). Device identity: `deviceId`
  (local only, never backed up — a restored backup cannot impersonate another device).

## Inventory model
Stock is stored in the product's **base unit** (meters or pieces). A cart line has a `sellUnit`:
`meter` (qty = meters), `suit` (meters = qty × suitCutMeters), `piece`. When a product has
`rolls`, rolls are the source of truth; `stockQty`/`colorStocks` are recomputed after every movement.
Sales deduct FIFO by receive date (or a chosen thaan) and record the actual **cost of goods**
(`costTotal`) per line, which drives profit. Legacy stock is converted to "opening" rolls when the first
thaan is received.

## Sync (optional, Firebase)
`businesses/{bid}/{collection}/{id} = { d: record, del, rev, dev, at }`.
Local edits → identity diff → persisted dirty set → batched Firestore writes (offline queue, automatic
retry). Remote changes → listeners filtered by server time → LWW by `rev`. Records edited on two devices
before syncing keep the local version and raise a visible conflict notice. Held bills stay per device.
Invoice numbers use a per-device series (`INV-W1-…`, `INV-A1-…`) so offline devices never collide.

**Known limitation:** stock counts use record-level LWW; if two devices sell the same product while
*both* are offline, the later upload wins for that product's stock figure (the sales themselves are never
lost). The app warns about such conflicts; a stock-movement ledger is the planned v3.1 improvement.

## Licensing
Super Admin issues a key → shop signs in and activates → Cloud Function checks status, owner email and
device limit, records the device, sets the user's `bid` claim and returns an **Ed25519-signed token**
bound to that `deviceId`. The apps embed only the public key and verify offline. Tokens must be refreshed
every `refreshDays`; after that an `offlineGraceDays` grace applies. Suspension/revocation reach devices
at the next refresh (refreshed tokens carry the new status). Without a configured public key (offline
builds) licensing is not enforced, so an existing shop is never locked out by an upgrade.

## Security
- Firestore rules: a user can only access `businesses/{bid}` matching their custom claim; writes blocked
  for suspended businesses; licenses/devices/logs are server-only.
- Backups: whitelisted paths only, size/entry limits, per-file SHA-256, newer-schema backups refused,
  nothing in a ZIP is ever executed.
- Electron: context isolation, sandboxed preload, app-file IPC confined to the app folder, external links
  restricted to https/WhatsApp, single instance, atomic DB writes with `.bak` fallback.
- CSV export guards against spreadsheet formula injection.
- Android: no broad storage permission (scoped storage / system picker); camera & notifications requested
  when used; FileProvider for shared files; cleartext traffic disabled; Android auto-backup disabled.
