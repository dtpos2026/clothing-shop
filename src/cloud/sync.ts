/**
 * Offline-first cloud sync (Firestore).
 *
 *   businesses/{businessId}/{collection}/{recordId} = { d: record, del, rev, dev, at }
 *   businesses/{businessId}/meta/settings           = { d: settings, rev, dev, at }
 *   businesses/{businessId}/meta/counters           = { invoiceCounter, purchaseCounter, returnCounter }
 *
 * - Local changes are detected by identity diff and recorded in a persisted "dirty" set
 *   immediately, so an app close/crash before upload loses nothing.
 * - Uploads are batched; Firestore's persistent cache keeps queued writes across restarts
 *   and retries them automatically when the connection returns.
 * - Downloads use listeners filtered by server time; merge is last-writer-wins per record
 *   (see core/syncDiff.ts). Conflicts are surfaced in the sync status.
 */
import type { Unsubscribe } from 'firebase/firestore';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { useStore, type BusinessData } from '@/store/useStore';
import { SYNC_COLLECTIONS, applyRemote, diffCollections, key, type RemoteDoc, type SyncCollection } from '@/core/syncDiff';
import { getDeviceId } from '@/platform/device';
import { getFirebase, isFirebaseConfigured } from './firebase';
import { useCloudStatus, useDeviceConfig } from './status';

const REVS_KEY = 'dt-sync-revs';
const DIRTY_KEY = 'dt-sync-dirty';
const SKEW_MS = 5 * 60_000;
const BATCH = 400;

let revs = new Map<string, number>();
let dirty = new Set<string>();
let prev: Partial<BusinessData> = {};
let applyingRemote = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let listeners: Unsubscribe[] = [];
let storeUnsub: (() => void) | null = null;
let lastRev = 0;
let running = false;
const conflicts = new Set<string>();

const status = () => useCloudStatus.getState();
const nextRev = () => (lastRev = Math.max(Date.now(), lastRev + 1));

function persistSoon() {
  if (persistTimer) return;
  persistTimer = setTimeout(async () => {
    persistTimer = null;
    await idbSet(REVS_KEY, [...revs.entries()]);
    await idbSet(DIRTY_KEY, [...dirty]);
  }, 400);
}

function snapshotOf(s: ReturnType<typeof useStore.getState>): Partial<BusinessData> {
  const out: Record<string, unknown> = { settings: s.settings, invoiceCounter: s.invoiceCounter, purchaseCounter: s.purchaseCounter, returnCounter: s.returnCounter };
  for (const c of SYNC_COLLECTIONS) out[c] = s[c];
  return out as Partial<BusinessData>;
}

/** Called on every store change. Cheap: identity comparisons only. */
function onLocalChange(s: ReturnType<typeof useStore.getState>) {
  if (applyingRemote) return;
  const next = snapshotOf(s);
  const changed = diffCollections(prev as never, next as never);
  if (next.settings !== prev.settings) changed.push('meta|settings');
  if (next.invoiceCounter !== prev.invoiceCounter || next.purchaseCounter !== prev.purchaseCounter || next.returnCounter !== prev.returnCounter) changed.push('meta|counters');
  prev = next;
  if (changed.length === 0) return;
  changed.forEach(k => dirty.add(k));
  status().set({ pending: dirty.size });
  persistSoon();
  scheduleFlush();
}

function scheduleFlush(delay = 1200) {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => { flushTimer = null; void flush(); }, delay);
}

function businessId() {
  return useStore.getState().businessId;
}

/** Upload dirty records. Safe to call any time; no-op when not running. */
export async function flush(): Promise<void> {
  if (!running || dirty.size === 0) return;
  const { db } = await getFirebase();
  const { doc, writeBatch, serverTimestamp } = await import('firebase/firestore');
  const s = useStore.getState();
  const bid = businessId();
  const dev = getDeviceId();
  const keys = [...dirty];
  status().set({ sync: navigator.onLine ? 'syncing' : 'offline', pending: keys.length });
  try {
    for (let i = 0; i < keys.length; i += BATCH) {
      const batch = writeBatch(db);
      for (const k of keys.slice(i, i + BATCH)) {
        const [c, id] = k.split('|');
        const rev = nextRev();
        revs.set(k, rev);
        if (c === 'meta') {
          if (id === 'settings') batch.set(doc(db, 'businesses', bid, 'meta', 'settings'), { d: s.settings, rev, dev, at: serverTimestamp() });
          else batch.set(doc(db, 'businesses', bid, 'meta', 'counters'), { invoiceCounter: s.invoiceCounter, purchaseCounter: s.purchaseCounter, returnCounter: s.returnCounter, rev, dev, at: serverTimestamp() }, { merge: true });
          continue;
        }
        const rec = (s[c as SyncCollection] as { id: string }[]).find(r => r.id === id);
        batch.set(doc(db, 'businesses', bid, c, id), rec ? { d: rec, del: false, rev, dev, at: serverTimestamp() } : { del: true, rev, dev, at: serverTimestamp() });
      }
      // commit() resolves on server ack; the write is already durable in the offline queue
      const p = batch.commit();
      keys.slice(i, i + BATCH).forEach(k => dirty.delete(k));
      p.then(() => {
        status().set({ sync: dirty.size ? 'syncing' : 'idle', lastSyncAt: new Date().toISOString(), syncError: undefined });
      }).catch(err => {
        status().set({ sync: 'error', syncError: String(err?.message || err) });
      });
    }
    persistSoon();
    status().set({ pending: dirty.size, sync: navigator.onLine ? 'syncing' : 'offline' });
    if (navigator.onLine) {
      const { waitForPendingWrites } = await import('firebase/firestore');
      await Promise.race([waitForPendingWrites(db), new Promise(r => setTimeout(r, 15000))]);
      status().set({ sync: 'idle', lastSyncAt: new Date().toISOString() });
    }
  } catch (err) {
    status().set({ sync: 'error', syncError: err instanceof Error ? err.message : String(err) });
    scheduleFlush(15_000); // retry with backoff
  }
}

function applyDocs(collection: SyncCollection, docs: RemoteDoc[]) {
  const s = useStore.getState();
  const r = applyRemote(s as never, collection, docs, revs, dirty);
  r.conflicts.forEach(c => conflicts.add(c));
  if (r.applied > 0) {
    applyingRemote = true;
    try {
      useStore.setState({ [collection]: (r.next as Record<string, unknown>)[collection] } as never);
      prev = { ...prev, [collection]: useStore.getState()[collection] };
    } finally {
      applyingRemote = false;
    }
  }
  if (r.conflicts.length) {
    status().set({ syncError: `${conflicts.size} record(s) were edited on two devices at once; this device's version was kept. Please re-check stock for recently sold items.` });
  }
  persistSoon();
}

async function startListeners() {
  const { db } = await getFirebase();
  const { collection, doc, onSnapshot, query, where, Timestamp } = await import('firebase/firestore');
  const bid = businessId();
  const me = getDeviceId();
  const cfg = useDeviceConfig.getState();
  const pulled = { ...cfg.pulledRev };
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  const markPulled = (c: string, ms: number) => {
    if (ms <= (pulled[c] || 0)) return;
    pulled[c] = ms;
    if (!saveTimer) saveTimer = setTimeout(() => { saveTimer = null; useDeviceConfig.getState().setConfig({ pulledRev: { ...pulled } }); }, 2000);
  };

  for (const c of SYNC_COLLECTIONS) {
    const since = Math.max(0, (pulled[c] || 0) - SKEW_MS);
    const q = since > 0 ? query(collection(db, 'businesses', bid, c), where('at', '>', Timestamp.fromMillis(since))) : collection(db, 'businesses', bid, c);
    listeners.push(onSnapshot(q, { includeMetadataChanges: false }, snap => {
      const docs: RemoteDoc[] = [];
      let maxAt = 0;
      for (const ch of snap.docChanges()) {
        if (ch.type === 'removed' || ch.doc.metadata.hasPendingWrites) continue;
        const data = ch.doc.data() as { d?: { id: string }; del?: boolean; rev: number; dev: string; at?: { toMillis(): number } };
        if (data.at) maxAt = Math.max(maxAt, data.at.toMillis());
        if (data.dev === me && (revs.get(key(c, ch.doc.id)) || 0) >= data.rev) continue; // own echo
        docs.push({ id: ch.doc.id, d: data.d, del: data.del, rev: data.rev, dev: data.dev });
      }
      if (docs.length) applyDocs(c, docs);
      if (maxAt) markPulled(c, maxAt);
      status().set({ lastSyncAt: new Date().toISOString(), sync: dirty.size ? 'syncing' : 'idle' });
    }, err => status().set({ sync: 'error', syncError: `${c}: ${err.message}` })));
  }

  listeners.push(onSnapshot(doc(db, 'businesses', bid, 'meta', 'settings'), snap => {
    const data = snap.data() as { d?: BusinessData['settings']; rev: number; dev: string } | undefined;
    if (!data?.d || snap.metadata.hasPendingWrites) return;
    const k = 'meta|settings';
    if ((revs.get(k) || 0) >= data.rev || dirty.has(k)) return;
    revs.set(k, data.rev);
    applyingRemote = true;
    try { useStore.setState({ settings: { ...useStore.getState().settings, ...data.d } }); prev = { ...prev, settings: useStore.getState().settings }; } finally { applyingRemote = false; }
  }));
  listeners.push(onSnapshot(doc(db, 'businesses', bid, 'meta', 'counters'), snap => {
    const d = snap.data() as { invoiceCounter?: number; purchaseCounter?: number; returnCounter?: number } | undefined;
    if (!d || snap.metadata.hasPendingWrites) return;
    const s = useStore.getState();
    const merged = {
      invoiceCounter: Math.max(s.invoiceCounter, d.invoiceCounter || 0),
      purchaseCounter: Math.max(s.purchaseCounter, d.purchaseCounter || 0),
      returnCounter: Math.max(s.returnCounter, d.returnCounter || 0),
    };
    if (merged.invoiceCounter !== s.invoiceCounter || merged.purchaseCounter !== s.purchaseCounter || merged.returnCounter !== s.returnCounter) {
      applyingRemote = true;
      try { useStore.setState(merged); prev = { ...prev, ...merged }; } finally { applyingRemote = false; }
    }
  }));
}

export interface StartOptions {
  /** First link of this device: 'merge' uploads everything local; 'replace' wipes local first. */
  initialMode?: 'merge' | 'replace';
}

export async function startSync(opts: StartOptions = {}): Promise<void> {
  if (running || !isFirebaseConfigured()) return;
  const { auth } = await getFirebase();
  if (!auth.currentUser) { status().set({ sync: 'disabled', syncError: 'Sign in to enable cloud sync' }); return; }
  running = true;
  revs = new Map((await idbGet<[string, number][]>(REVS_KEY)) || []);
  dirty = new Set((await idbGet<string[]>(DIRTY_KEY)) || []);

  if (opts.initialMode === 'replace') {
    const empty: Record<string, unknown[]> = {};
    for (const c of SYNC_COLLECTIONS) empty[c] = [];
    applyingRemote = true;
    try { useStore.setState(empty as never); } finally { applyingRemote = false; }
    revs.clear();
    dirty.clear();
    useDeviceConfig.getState().setConfig({ pulledRev: {} });
  } else if (opts.initialMode === 'merge') {
    const s = useStore.getState();
    for (const c of SYNC_COLLECTIONS) for (const r of s[c] as { id: string }[]) dirty.add(key(c, r.id));
    dirty.add('meta|settings');
    dirty.add('meta|counters');
    useDeviceConfig.getState().setConfig({ pulledRev: {} });
  }

  prev = snapshotOf(useStore.getState());
  storeUnsub = useStore.subscribe(onLocalChange);
  status().set({ sync: navigator.onLine ? 'syncing' : 'offline', pending: dirty.size, syncError: undefined });
  await startListeners();
  scheduleFlush(300);
}

export function stopSync() {
  running = false;
  listeners.forEach(u => u());
  listeners = [];
  storeUnsub?.();
  storeUnsub = null;
  if (flushTimer) clearTimeout(flushTimer);
  status().set({ sync: 'disabled', pending: 0 });
}

export const isSyncRunning = () => running;

export async function syncNow() {
  scheduleFlush(0);
}

/** Does the cloud workspace already have data? (Used to choose merge vs replace on first link.) */
export async function cloudHasData(): Promise<boolean> {
  const { db } = await getFirebase();
  const { collection, getDocs, limit, query } = await import('firebase/firestore');
  const snap = await getDocs(query(collection(db, 'businesses', businessId(), 'products'), limit(1)));
  return !snap.empty;
}

/** Register this device's FCM token so Cloud Functions can push notifications to it. */
export async function saveDeviceToken(token: string) {
  if (!running) return;
  const { db } = await getFirebase();
  const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
  await setDoc(doc(db, 'businesses', businessId(), 'devices', getDeviceId()), { fcmToken: token, updatedAt: serverTimestamp() }, { merge: true });
}
