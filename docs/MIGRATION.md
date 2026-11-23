# Database migration (v1/v2 → v3.0)

## What happens on first start of v3.0
1. **Windows data folder** – older builds stored data under `%APPDATA%\vite_react_shadcn_ts\db`
   (Electron uses the package name). v3 uses `%APPDATA%\dt-fabric-pos\db`. On first start, if the new
   folder has no database, the newest legacy database is **copied** (never moved). A `MIGRATED_FROM.txt`
   records the source. The old folder stays untouched as a fallback.
2. **Schema** – the persisted store gets `version: 2`. `core/migrations.ts` (`migrateState`) runs for
   any older version:
   - adds empty `suppliers, purchases, supplierPayments, stockAdjustments, cashEntries, dayClosings`
   - adds a permanent `businessId` (workspace identity shared by Windows + Android)
   - marks existing sales `kind: 'sale'`
   - **does not modify or delete any existing record**; all new product/sale fields are optional.
3. **Demo data** is only seeded on a brand-new, empty install (after storage has loaded), never on top of
   real data, and never again after it has been removed.

The same migration runs when restoring a backup, so a v1 `.json` backup restores into v3 on Windows or
Android.

## Behaviour changes that protect data
| v1/v2 behaviour | v3 |
|---|---|
| **Day Close deleted all sales** | Saves a closing record (expected vs counted cash); sales history kept. Dashboard "today" resets by date. |
| Restore dropped khata, accounts, transactions, leads | Restore covers every collection, shows a preview first, makes a safety backup, offers merge or replace. |
| JSON written in place (power cut could corrupt it) | Atomic write (temp file + rename) with `.bak` fallback on read. |
| Two windows could write the same DB | Single-instance lock. |

## Field mapping
| Area | v1 | v3 |
|---|---|---|
| Meter product price | `salePrice` per suit | unchanged; optional `pricePerMeter`, `wholesalePrice`, `wholesalePricePerMeter` |
| Meter stock | `stockQty` / `colorStocks` | unchanged until the first thaan is received, then derived from `rolls` (old stock becomes `OPEN-n` rolls) |
| Cart line | quantity in suits for meter products | `sellUnit` (`meter`/`suit`/`piece`); missing ⇒ legacy meaning (`suit`) |
| Payment | `paymentMethod` + `amountPaid` | plus `payments[]` (split); old sales read via `salePayments()` |
| Receipt template | `classic/bordered/modern/compact` | still supported (Legacy); 6 new templates + `invoiceDesign` |
| Categories/fabrics | fixed enums | open lists + custom entries in Settings → Catalogue |

## Adding a future migration
1. Increase `SCHEMA_VERSION` in `src/core/defaults.ts`.
2. Add an `if (fromVersion < N)` block in `migrateState` (pure, idempotent, never drop unknown keys).
3. Add a test in `src/test/core/store-backup.test.ts`.
Backups from a newer schema are refused by older apps with a clear "update first" message.

## Rollback
- Windows: the legacy data folder is untouched; reinstalling v2 reads it again (sales recorded in v3 since
  the upgrade are only in the new folder — take a v3 backup first).
- Any platform: Backup → "Restore last safety backup…".
