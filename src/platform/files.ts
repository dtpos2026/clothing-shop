/**
 * Save / share / pick files on every platform.
 *
 * Nothing here ever claims a file was *delivered*: share results only say whether a
 * share target was opened. Every share has a "save a copy" fallback.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isAndroid, isElectron } from './device';

export type FileData = Blob | Uint8Array | string;

export interface SaveResult { ok: boolean; cancelled?: boolean; location?: string; error?: string }
export type ShareStatus = 'opened' | 'dismissed' | 'saved-for-manual-share' | 'unsupported' | 'error';
export interface ShareResult { status: ShareStatus; message: string; location?: string; app?: string }

interface DtNativePlugin {
  shareToWhatsApp(opts: { uri: string; mime: string; phone?: string; text?: string; business?: boolean }): Promise<{ opened: boolean; package?: string }>;
  isAppInstalled(opts: { package: string }): Promise<{ installed: boolean }>;
  printHtml(opts: { html: string; jobName: string; widthMm?: number }): Promise<{ started: boolean }>;
}
export const DtNative = registerPlugin<DtNativePlugin>('DtNative');

export async function toBytes(data: FileData): Promise<Uint8Array> {
  if (data instanceof Uint8Array) return data;
  if (typeof data === 'string') return new TextEncoder().encode(data);
  return new Uint8Array(await data.arrayBuffer());
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export const safeFileName = (name: string) => name.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '_').slice(0, 120);

function browserDownload(bytes: Uint8Array, fileName: string, mime: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const EXT_FILTERS: Record<string, { name: string; extensions: string[] }> = {
  pdf: { name: 'PDF', extensions: ['pdf'] }, png: { name: 'PNG image', extensions: ['png'] },
  csv: { name: 'CSV', extensions: ['csv'] }, xlsx: { name: 'Excel', extensions: ['xlsx'] },
  zip: { name: 'ZIP', extensions: ['zip'] }, json: { name: 'JSON', extensions: ['json'] },
};

/** Ask where to save (Windows), save into Documents/DigitalTargetPOS (Android) or download (browser). */
export async function saveFile(data: FileData, fileName: string, mime: string): Promise<SaveResult> {
  const name = safeFileName(fileName);
  try {
    const bytes = await toBytes(data);
    if (isElectron()) {
      const ext = name.split('.').pop() || '';
      const path = await window.electronAPI!.saveFile({ defaultName: name, data: bytes, filters: EXT_FILTERS[ext] ? [EXT_FILTERS[ext]] : undefined });
      return path ? { ok: true, location: path } : { ok: false, cancelled: true };
    }
    if (Capacitor.isNativePlatform()) {
      const path = `DigitalTargetPOS/${name}`;
      try {
        const r = await Filesystem.writeFile({ path, data: bytesToBase64(bytes), directory: Directory.Documents, recursive: true });
        return { ok: true, location: `Documents/${path}` + (r.uri ? '' : '') };
      } catch {
        // Some devices restrict public Documents – fall back to app-specific external storage (no permission needed)
        const r = await Filesystem.writeFile({ path, data: bytesToBase64(bytes), directory: Directory.External, recursive: true });
        return { ok: true, location: r.uri };
      }
    }
    browserDownload(bytes, name, mime);
    return { ok: true, location: 'Downloads' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Write to the app's private area (safety backups, temp share files). */
export async function writeAppFile(relPath: string, data: FileData): Promise<string> {
  const bytes = await toBytes(data);
  if (isElectron()) return window.electronAPI!.writeAppFile(relPath, bytes);
  if (Capacitor.isNativePlatform()) {
    const r = await Filesystem.writeFile({ path: relPath, data: bytesToBase64(bytes), directory: Directory.Data, recursive: true });
    return r.uri;
  }
  const { set } = await import('idb-keyval');
  await set(`file:${relPath}`, bytes);
  return `indexeddb://${relPath}`;
}

export async function readAppFile(relPath: string): Promise<Uint8Array | null> {
  if (isElectron()) return window.electronAPI!.readAppFile(relPath);
  if (Capacitor.isNativePlatform()) {
    try {
      const r = await Filesystem.readFile({ path: relPath, directory: Directory.Data });
      const b64 = typeof r.data === 'string' ? r.data : bytesToBase64(await toBytes(r.data));
      return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    } catch { return null; }
  }
  const { get } = await import('idb-keyval');
  return (await get(`file:${relPath}`)) || null;
}

async function cacheUri(bytes: Uint8Array, fileName: string): Promise<string> {
  const r = await Filesystem.writeFile({ path: `share/${safeFileName(fileName)}`, data: bytesToBase64(bytes), directory: Directory.Cache, recursive: true });
  return r.uri;
}

/** System share sheet (Android, Windows/Chrome Web Share) with save fallback. */
export async function shareFile(data: FileData, fileName: string, mime: string, opts: { title?: string; text?: string } = {}): Promise<ShareResult> {
  const bytes = await toBytes(data);
  try {
    if (Capacitor.isNativePlatform()) {
      const uri = await cacheUri(bytes, fileName);
      const r = await Share.share({ title: opts.title, text: opts.text, files: [uri], dialogTitle: opts.title || 'Share' });
      return { status: 'opened', app: r.activityType, message: r.activityType ? `Opened ${r.activityType}. Complete sending there.` : 'Share sheet opened.' };
    }
    const file = new File([bytes as BlobPart], fileName, { type: mime });
    if (!isElectron() && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: opts.title, text: opts.text });
      return { status: 'opened', message: 'Share sheet opened. Complete sending in the chosen app.' };
    }
  } catch (e) {
    if (e instanceof Error && /abort|cancel/i.test(e.name + e.message)) return { status: 'dismissed', message: 'Sharing was cancelled.' };
  }
  const saved = await saveFile(bytes, fileName, mime);
  if (saved.ok) {
    if (isElectron() && saved.location) void window.electronAPI!.revealFile(saved.location);
    return { status: 'saved-for-manual-share', location: saved.location, message: `Saved to ${saved.location}. Attach it manually in the app you want to share with.` };
  }
  return { status: saved.cancelled ? 'dismissed' : 'error', message: saved.error || 'Not saved.' };
}

/** Pakistani numbers → international format for WhatsApp (0300-1234567 → 923001234567). */
export function normalizeWhatsAppPhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  let d = phone.replace(/\D/g, '');
  if (!d) return undefined;
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0') && d.length === 11) d = `92${d.slice(1)}`;
  if (d.length === 10 && d.startsWith('3')) d = `92${d}`;
  return d.length >= 10 ? d : undefined;
}

export function whatsAppTextUrl(text: string, phone?: string) {
  const p = normalizeWhatsAppPhone(phone);
  return `https://wa.me/${p || ''}?text=${encodeURIComponent(text)}`;
}

/**
 * Share a file directly to WhatsApp.
 *  - Android: opens WhatsApp (or WhatsApp Business) with the file attached; when a phone number
 *    is given WhatsApp opens that chat, otherwise its contact/group picker.
 *  - Windows / browser: saves the file, opens WhatsApp (desktop/web) on the chat; the user attaches it.
 */
export async function shareToWhatsApp(data: FileData, fileName: string, mime: string, opts: { phone?: string; text?: string } = {}): Promise<ShareResult> {
  const bytes = await toBytes(data);
  const phone = normalizeWhatsAppPhone(opts.phone);
  if (isAndroid()) {
    try {
      const uri = await cacheUri(bytes, fileName);
      const r = await DtNative.shareToWhatsApp({ uri, mime, phone, text: opts.text });
      if (r.opened) return { status: 'opened', app: r.package, message: 'WhatsApp opened with the file attached. Tap Send in WhatsApp to deliver it.' };
    } catch { /* fall through to share sheet */ }
    const r = await shareFile(bytes, fileName, mime, { text: opts.text });
    return { ...r, message: `WhatsApp is not installed or could not be opened directly. ${r.message}` };
  }
  // Desktop: Web Share (Edge/Chrome on Windows lists WhatsApp) if available
  if (!isElectron()) {
    const file = new File([bytes as BlobPart], fileName, { type: mime });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: opts.text });
        return { status: 'opened', message: 'Share sheet opened – choose WhatsApp to send.' };
      } catch (e) {
        if (e instanceof Error && /abort/i.test(e.name)) return { status: 'dismissed', message: 'Sharing was cancelled.' };
      }
    }
  }
  const saved = isElectron()
    ? { ok: true, location: await window.electronAPI!.writeAppFile(`Shared/${safeFileName(fileName)}`, bytes) }
    : await saveFile(bytes, fileName, mime);
  if (!saved.ok) return { status: 'error', message: 'Could not prepare the file for WhatsApp.' };
  const url = whatsAppTextUrl(opts.text || `Please find attached: ${fileName}`, phone);
  if (isElectron()) {
    await window.electronAPI!.revealFile(saved.location!);
    await window.electronAPI!.openExternal(url);
  } else {
    window.open(url, '_blank', 'noopener');
  }
  return {
    status: 'saved-for-manual-share', location: saved.location,
    message: `File saved to ${saved.location}. WhatsApp has been opened – drag the file into the chat and press Send.`,
  };
}

/** Modern system file picker (no storage permission needed on Android). */
export function pickFile(accept: string): Promise<{ name: string; bytes: Uint8Array; type: string } | null> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      resolve({ name: f.name, type: f.type, bytes: new Uint8Array(await f.arrayBuffer()) });
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}
