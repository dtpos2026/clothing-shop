/**
 * Cross-platform backup format (identical on Windows and Android).
 *
 *   <name>.dtbackup.zip
 *   ├── manifest.json        format id, versions, business id, counts, per-file SHA-256, checksum
 *   ├── data.json            all business collections + settings (images replaced by asset refs)
 *   ├── templates/invoice.json  invoice design, receipt template, label settings
 *   └── images/
 *       ├── logo.png, payment-qr.png, developer-logo.png
 *       └── products/<productId>.jpg
 *
 * Safety rules for import:
 *  - only whitelisted paths are read; anything else is ignored and reported, never executed
 *  - entry count and total size limits guard against zip bombs
 *  - every file's SHA-256 must match the manifest; data.json must match `checksum`
 *  - a backup from a newer schema is refused instead of being guessed at
 *  - legacy v1 JSON backups ({products, customers, ...}) are still accepted
 */
import JSZip from 'jszip';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import type { BusinessData } from '@/store/useStore';
import { BUSINESS_COLLECTIONS, migrateState } from './migrations';
import { APP_VERSION, SCHEMA_VERSION } from './defaults';

export const BACKUP_FORMAT = 'dt-fabric-pos-backup';
export const BACKUP_FORMAT_VERSION = 2;
export const BACKUP_EXTENSION = '.dtbackup.zip';

const MAX_ENTRIES = 5000;
const MAX_TOTAL_BYTES = 512 * 1024 * 1024;
const ALLOWED_PATH = /^(manifest\.json|data\.json|templates\/[A-Za-z0-9_.-]+\.json|images\/(products\/)?[A-Za-z0-9_.-]+\.(png|jpe?g|webp|gif))$/;

export interface BackupManifest {
  format: typeof BACKUP_FORMAT;
  formatVersion: number;
  schemaVersion: number;
  appVersion: string;
  businessId: string;
  businessName: string;
  createdAt: string;
  platform: string;
  deviceId: string;
  counts: Record<string, number>;
  files: Record<string, { sha256: string; size: number }>;
  /** SHA-256 of data.json – the integrity checksum shown to users. */
  checksum: string;
}

export interface BackupPreview {
  manifest: BackupManifest;
  data: BusinessData;
  legacy: boolean;
  warnings: string[];
  sizeBytes: number;
}

export const sha256Hex = (bytes: Uint8Array) => bytesToHex(sha256(bytes));

const DATA_URL = /^data:(image\/(png|jpe?g|webp|gif));base64,(.+)$/;
const extFor = (mime: string) => (mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : mime.includes('gif') ? 'gif' : 'jpg');
const mimeFor = (path: string) => (path.endsWith('.png') ? 'image/png' : path.endsWith('.webp') ? 'image/webp' : path.endsWith('.gif') ? 'image/gif' : 'image/jpeg');

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

export function countRecords(data: Partial<BusinessData>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const c of BUSINESS_COLLECTIONS) counts[c] = Array.isArray(data[c]) ? (data[c] as unknown[]).length : 0;
  return counts;
}

export interface BuildMeta { platform: string; deviceId: string; appVersion?: string; createdAt?: string }

export async function buildBackupZip(data: BusinessData, meta: BuildMeta): Promise<{ bytes: Uint8Array; manifest: BackupManifest; fileName: string }> {
  const zip = new JSZip();
  const files: BackupManifest['files'] = {};
  const put = (path: string, bytes: Uint8Array) => {
    zip.file(path, bytes);
    files[path] = { sha256: sha256Hex(bytes), size: bytes.length };
  };

  // Pull images out of the JSON so data.json stays small and readable
  const clone: BusinessData = JSON.parse(JSON.stringify(data));
  const extract = (value: string | undefined, path: string): string | undefined => {
    const m = value?.match(DATA_URL);
    if (!m) return value;
    const full = `${path}.${extFor(m[1])}`;
    put(full, b64ToBytes(m[3]));
    return `asset:${full}`;
  };
  clone.products = clone.products.map(p => ({ ...p, imageUrl: extract(p.imageUrl, `images/products/${p.id.replace(/[^A-Za-z0-9_-]/g, '_')}`) }));
  clone.settings = {
    ...clone.settings,
    logoUrl: extract(clone.settings.logoUrl, 'images/logo') || '',
    customQrUrl: extract(clone.settings.customQrUrl, 'images/payment-qr') || '',
    developerLogoUrl: extract(clone.settings.developerLogoUrl, 'images/developer-logo') || '',
  };
  put('templates/invoice.json', utf8ToBytes(JSON.stringify({
    receiptTemplate: clone.settings.receiptTemplate,
    invoiceDesign: clone.settings.invoiceDesign || null,
    labelDefaults: clone.settings.labelDefaults || null,
  }, null, 2)));

  const dataBytes = utf8ToBytes(JSON.stringify({ ...clone, schemaVersion: SCHEMA_VERSION }));
  put('data.json', dataBytes);

  const createdAt = meta.createdAt || new Date().toISOString();
  const manifest: BackupManifest = {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    appVersion: meta.appVersion || APP_VERSION,
    businessId: data.businessId,
    businessName: data.settings?.storeName || '',
    createdAt,
    platform: meta.platform,
    deviceId: meta.deviceId,
    counts: countRecords(data),
    files,
    checksum: files['data.json'].sha256,
  };
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  const safeName = (manifest.businessName || 'business').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'business';
  const stamp = createdAt.replace(/[:]/g, '').replace(/\..+$/, '');
  return { bytes, manifest, fileName: `${safeName}-${stamp}${BACKUP_EXTENSION}` };
}

export class BackupError extends Error {}

function looksLikeZip(bytes: Uint8Array) {
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

/** Parse + validate a backup without touching app state. */
export async function readBackup(input: Uint8Array | ArrayBuffer | string): Promise<BackupPreview> {
  const bytes = typeof input === 'string' ? utf8ToBytes(input) : input instanceof Uint8Array ? input : new Uint8Array(input);
  const warnings: string[] = [];

  if (!looksLikeZip(bytes)) {
    // Legacy v1 JSON backup
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new BackupError('This file is not a valid backup (neither ZIP nor JSON).');
    }
    if (!parsed || !Array.isArray(parsed.products)) throw new BackupError('JSON file does not contain shop data.');
    const fromVersion = typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : 1;
    if (fromVersion > SCHEMA_VERSION) throw new BackupError('This backup was made by a newer version of the app. Please update first.');
    const data = migrateState(parsed, fromVersion) as unknown as BusinessData;
    warnings.push('Legacy JSON backup (v1): no checksum available, product images not included.');
    const checksum = sha256Hex(bytes);
    return {
      legacy: true, warnings, data, sizeBytes: bytes.length,
      manifest: {
        format: BACKUP_FORMAT, formatVersion: 1, schemaVersion: fromVersion, appVersion: 'v1',
        businessId: String(data.businessId || ''), businessName: data.settings?.storeName || '',
        createdAt: '', platform: 'unknown', deviceId: '', counts: countRecords(data), files: {}, checksum,
      },
    };
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
  } catch {
    throw new BackupError('ZIP file is damaged or incomplete.');
  }
  const entries = Object.values(zip.files).filter(f => !f.dir);
  if (entries.length > MAX_ENTRIES) throw new BackupError('Backup contains too many files.');
  let declared = 0;
  for (const e of entries) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    declared += (e as any)._data?.uncompressedSize || 0;
  }
  if (declared > MAX_TOTAL_BYTES) throw new BackupError('Backup is larger than allowed (possible corrupt or malicious file).');

  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) throw new BackupError('manifest.json missing – this is not a shop backup.');
  let manifest: BackupManifest;
  try {
    manifest = JSON.parse(await manifestFile.async('string'));
  } catch {
    throw new BackupError('manifest.json is not valid JSON.');
  }
  if (manifest.format !== BACKUP_FORMAT) throw new BackupError('Unknown backup format.');
  if (manifest.formatVersion > BACKUP_FORMAT_VERSION || manifest.schemaVersion > SCHEMA_VERSION) {
    throw new BackupError('This backup was made by a newer version of the app. Please update first.');
  }

  const contents = new Map<string, Uint8Array>();
  for (const e of entries) {
    const name = e.name;
    if (name === 'manifest.json') continue;
    if (name.includes('..') || name.startsWith('/') || name.includes('\\') || !ALLOWED_PATH.test(name)) {
      warnings.push(`Ignored unexpected file: ${name}`);
      continue;
    }
    const b = await e.async('uint8array');
    const expected = manifest.files?.[name];
    if (!expected) { warnings.push(`Ignored file not listed in manifest: ${name}`); continue; }
    if (sha256Hex(b) !== expected.sha256) throw new BackupError(`Integrity check failed for ${name} – the backup is corrupted or was modified.`);
    contents.set(name, b);
  }
  for (const name of Object.keys(manifest.files || {})) {
    if (!contents.has(name)) throw new BackupError(`Backup is incomplete: ${name} is missing.`);
  }
  const dataBytes = contents.get('data.json');
  if (!dataBytes) throw new BackupError('data.json missing.');
  if (sha256Hex(dataBytes) !== manifest.checksum) throw new BackupError('Checksum mismatch – backup data is corrupted.');

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(new TextDecoder().decode(dataBytes));
  } catch {
    throw new BackupError('data.json is not valid JSON.');
  }
  const inline = (v: unknown) => {
    if (typeof v !== 'string' || !v.startsWith('asset:')) return v;
    const path = v.slice(6);
    const b = contents.get(path);
    if (!b) { warnings.push(`Missing image ${path}`); return ''; }
    return `data:${mimeFor(path)};base64,${bytesToB64(b)}`;
  };
  const products = (raw.products as Record<string, unknown>[] | undefined) || [];
  raw.products = products.map(p => ({ ...p, imageUrl: inline(p.imageUrl) || undefined }));
  const settings = (raw.settings as Record<string, unknown>) || {};
  raw.settings = { ...settings, logoUrl: inline(settings.logoUrl), customQrUrl: inline(settings.customQrUrl), developerLogoUrl: inline(settings.developerLogoUrl) };

  const data = migrateState(raw, typeof raw.schemaVersion === 'number' ? raw.schemaVersion : manifest.schemaVersion) as unknown as BusinessData;
  const counts = countRecords(data);
  for (const [k, v] of Object.entries(manifest.counts || {})) {
    if (counts[k] !== undefined && counts[k] !== v) warnings.push(`Record count mismatch for ${k}: manifest ${v}, data ${counts[k]}`);
  }
  return { manifest, data, legacy: false, warnings, sizeBytes: bytes.length };
}

export interface MergeStats { [collection: string]: { added: number; duplicates: number } }

/**
 * Merge an incoming backup into current data without overwriting anything:
 * records with an existing id are kept as-is (duplicates), products whose SKU or
 * barcode already exists are treated as duplicates too.
 */
export function mergeBusinessData(current: BusinessData, incoming: BusinessData): { merged: BusinessData; stats: MergeStats } {
  const merged = { ...current } as BusinessData;
  const stats: MergeStats = {};
  for (const c of BUSINESS_COLLECTIONS) {
    const cur = (current[c] as { id: string }[]) || [];
    const inc = (incoming[c] as { id: string }[]) || [];
    const ids = new Set(cur.map(r => r.id));
    let dupKeys: Set<string> | null = null;
    if (c === 'products') {
      dupKeys = new Set();
      for (const p of current.products) {
        if (p.sku) dupKeys.add(`sku:${p.sku.toUpperCase()}`);
        if (p.barcode) dupKeys.add(`bc:${p.barcode.toUpperCase()}`);
      }
    }
    const add: { id: string }[] = [];
    let duplicates = 0;
    for (const r of inc) {
      if (ids.has(r.id)) { duplicates++; continue; }
      if (dupKeys) {
        const p = r as unknown as { sku?: string; barcode?: string };
        if ((p.sku && dupKeys.has(`sku:${p.sku.toUpperCase()}`)) || (p.barcode && dupKeys.has(`bc:${p.barcode.toUpperCase()}`))) { duplicates++; continue; }
      }
      ids.add(r.id);
      add.push(r);
    }
    (merged as unknown as Record<string, unknown>)[c] = [...cur, ...add];
    stats[c] = { added: add.length, duplicates };
  }
  merged.invoiceCounter = Math.max(current.invoiceCounter || 0, incoming.invoiceCounter || 0);
  merged.purchaseCounter = Math.max(current.purchaseCounter || 0, incoming.purchaseCounter || 0);
  merged.returnCounter = Math.max(current.returnCounter || 0, incoming.returnCounter || 0);
  return { merged, stats };
}
