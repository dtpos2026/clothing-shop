/**
 * Pure helpers for the sync engine (unit tested).
 *
 * Change detection relies on immutability: store actions replace only the records they
 * change, so comparing object identity per id finds exactly the edited/new/deleted records.
 */
export const SYNC_COLLECTIONS = [
  'products', 'customers', 'sales', 'credits', 'khataEntries', 'goodsReceivings',
  'expenses', 'savingsTargets', 'users', 'accounts', 'accountTransactions', 'leads',
  'suppliers', 'purchases', 'supplierPayments', 'stockAdjustments', 'cashEntries', 'dayClosings',
] as const;
// heldBills are deliberately per-device (a parked bill belongs to that counter)
export type SyncCollection = (typeof SYNC_COLLECTIONS)[number];

export const key = (c: string, id: string) => `${c}|${id}`;

type Rec = { id: string };
type Snap = Partial<Record<SyncCollection, Rec[]>>;

export function diffCollections(prev: Snap, next: Snap): string[] {
  const changed: string[] = [];
  for (const c of SYNC_COLLECTIONS) {
    const a = prev[c] || [];
    const b = next[c] || [];
    if (a === b) continue;
    const before = new Map(a.map(r => [r.id, r]));
    for (const r of b) {
      if (before.get(r.id) !== r) changed.push(key(c, r.id));
      before.delete(r.id);
    }
    for (const id of before.keys()) changed.push(key(c, id)); // deleted
  }
  return changed;
}

export interface RemoteDoc { id: string; d?: Rec; del?: boolean; rev: number; dev: string }

export interface ApplyResult<T extends Snap> { next: T; applied: number; conflicts: string[]; skipped: number }

/**
 * Last-writer-wins merge of remote docs into local collections.
 * - remote older than (or equal to) what we already have → skipped
 * - local has unpushed edits (dirty) → local wins now and will overwrite remote on flush;
 *   reported as a conflict so the user can double-check (e.g. stock counts)
 */
export function applyRemote<T extends Snap>(
  state: T, collection: SyncCollection, docs: RemoteDoc[], revs: Map<string, number>, dirty: Set<string>,
): ApplyResult<T> {
  let list = (state[collection] || []) as Rec[];
  let applied = 0, skipped = 0;
  const conflicts: string[] = [];
  const idx = new Map(list.map((r, i) => [r.id, i]));
  let copied = false;
  const ensureCopy = () => { if (!copied) { list = [...list]; copied = true; } };
  const removed = new Set<string>();
  for (const doc of docs) {
    const k = key(collection, doc.id);
    if ((revs.get(k) || 0) >= doc.rev) { skipped++; continue; }
    if (dirty.has(k)) { conflicts.push(k); continue; }
    revs.set(k, doc.rev);
    if (doc.del || !doc.d) {
      if (idx.has(doc.id)) { removed.add(doc.id); applied++; }
      continue;
    }
    ensureCopy();
    const i = idx.get(doc.id);
    if (i === undefined) { idx.set(doc.id, list.length); list.push(doc.d); } else list[i] = doc.d;
    removed.delete(doc.id);
    applied++;
  }
  if (removed.size) list = list.filter(r => !removed.has(r.id));
  return { next: { ...state, [collection]: list }, applied, conflicts, skipped };
}
