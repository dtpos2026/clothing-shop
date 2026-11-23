/**
 * Schema migrations for persisted state AND backup payloads.
 *
 * v0/v1 → v2 (this release)
 *  - adds suppliers, purchases, supplierPayments, stockAdjustments, cashEntries, dayClosings
 *  - adds businessId (stable workspace identity shared by Windows + Android)
 *  - leaves every existing record untouched (new fields are optional)
 *  - `sales` that were wiped by the old destructive Day Close cannot be recovered,
 *    but from v2 Day Close never deletes sales.
 *
 * Rules: migrations must be pure, idempotent and never drop unknown keys.
 */
import { SCHEMA_VERSION } from './defaults';

export const BUSINESS_COLLECTIONS = [
  'products', 'customers', 'sales', 'credits', 'khataEntries', 'goodsReceivings', 'heldBills',
  'expenses', 'savingsTargets', 'users', 'accounts', 'accountTransactions', 'leads',
  'suppliers', 'purchases', 'supplierPayments', 'stockAdjustments', 'cashEntries', 'dayClosings',
] as const;
export type BusinessCollection = (typeof BUSINESS_COLLECTIONS)[number];

/** Scalars that belong to the business and travel with backups/sync. */
export const BUSINESS_SCALARS = ['settings', 'invoiceCounter', 'purchaseCounter', 'returnCounter', 'lastDayCloseDate', 'businessId', 'backups'] as const;

type AnyState = Record<string, unknown>;

export function migrateState(state: AnyState, fromVersion: number, makeId: () => string = () => crypto.randomUUID()): AnyState {
  const s: AnyState = { ...state };
  if (fromVersion < 2) {
    for (const c of BUSINESS_COLLECTIONS) if (!Array.isArray(s[c])) s[c] = [];
    if (typeof s.businessId !== 'string' || !s.businessId) s.businessId = `biz-${makeId()}`;
    if (typeof s.purchaseCounter !== 'number') s.purchaseCounter = 0;
    if (typeof s.returnCounter !== 'number') s.returnCounter = 0;
    // older builds stored sales without kind; keep them as normal sales
    s.sales = (s.sales as AnyState[]).map(x => (x && typeof x === 'object' && !('kind' in x) ? { ...x, kind: 'sale' } : x));
  }
  s.schemaVersion = SCHEMA_VERSION;
  return s;
}
