/**
 * Backup workflows shared by every platform.
 * Restores ALWAYS create a safety backup of the current data first.
 */
import { useStore, type BusinessData } from '@/store/useStore';
import { buildBackupZip, mergeBusinessData, readBackup, type BackupPreview, type MergeStats } from '@/core/backup';
import { getDeviceId, getPlatform } from '@/platform/device';
import { readAppFile, writeAppFile } from '@/platform/files';
import { getFirebase, getStorageBucket, isFirebaseConfigured } from '@/cloud/firebase';

export async function createBackup(kind: 'manual' | 'auto' | 'safety' | 'cloud' = 'manual') {
  const data = useStore.getState().getBusinessData();
  const r = await buildBackupZip(data, { platform: getPlatform(), deviceId: getDeviceId() });
  useStore.getState().recordBackup({ date: r.manifest.createdAt, size: `${(r.bytes.length / 1024).toFixed(1)} KB`, type: kind, fileName: r.fileName });
  return r;
}

/** Stored inside the app's private storage; survives until overwritten. */
export async function saveSafetyBackup(reason: string): Promise<string> {
  const r = await createBackup('safety');
  const path = await writeAppFile(`backups/safety-latest${'.dtbackup.zip'}`, r.bytes);
  await writeAppFile(`backups/safety-${Date.now() % 5}.dtbackup.zip`, r.bytes); // small ring of 5
  void reason;
  return path;
}

export async function loadSafetyBackup(): Promise<Uint8Array | null> {
  return readAppFile('backups/safety-latest.dtbackup.zip');
}

/** One automatic backup per day, kept as a 7-day ring (Mon..Sun) in app storage. */
export async function autoBackupIfDue(): Promise<void> {
  const s = useStore.getState();
  const today = new Date().toISOString().slice(0, 10);
  const last = s.backups.filter(b => b.type === 'auto').slice(-1)[0];
  if (last && last.date.slice(0, 10) === today) return;
  if (s.products.length === 0 && s.sales.length === 0) return;
  const r = await createBackup('auto');
  const day = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()];
  await writeAppFile(`backups/auto-${day}.dtbackup.zip`, r.bytes);
}

export { readBackup };
export type { BackupPreview };

export async function restoreReplace(preview: BackupPreview): Promise<string> {
  const safety = await saveSafetyBackup('before-restore');
  useStore.getState().replaceBusinessData(preview.data);
  return safety;
}

export async function restoreMerge(preview: BackupPreview): Promise<{ safety: string; stats: MergeStats }> {
  const safety = await saveSafetyBackup('before-merge');
  const current = useStore.getState().getBusinessData();
  const { merged, stats } = mergeBusinessData(current, preview.data as BusinessData);
  useStore.getState().replaceBusinessData({ ...merged, businessId: current.businessId, settings: current.settings });
  return { safety, stats };
}

// ---------------- Cloud backups (Firebase Storage) ----------------
export async function uploadCloudBackup(): Promise<string> {
  if (!isFirebaseConfigured()) throw new Error('Cloud is not configured for this build.');
  const { auth } = await getFirebase();
  if (!auth.currentUser) throw new Error('Sign in on the Cloud & License page first.');
  const r = await createBackup('cloud');
  const { ref, uploadBytes } = await import('firebase/storage');
  const storage = await getStorageBucket();
  const path = `businesses/${useStore.getState().businessId}/backups/${r.fileName}`;
  await uploadBytes(ref(storage, path), r.bytes, { contentType: 'application/zip', customMetadata: { checksum: r.manifest.checksum, platform: r.manifest.platform } });
  return path;
}

export async function listCloudBackups(): Promise<{ name: string; path: string; size: number; updated: string }[]> {
  const { ref, listAll, getMetadata } = await import('firebase/storage');
  const storage = await getStorageBucket();
  const res = await listAll(ref(storage, `businesses/${useStore.getState().businessId}/backups`));
  const items = await Promise.all(res.items.map(async i => {
    const m = await getMetadata(i);
    return { name: i.name, path: i.fullPath, size: m.size, updated: m.updated };
  }));
  return items.sort((a, b) => b.updated.localeCompare(a.updated));
}

export async function downloadCloudBackup(path: string): Promise<Uint8Array> {
  const { ref, getBytes } = await import('firebase/storage');
  const storage = await getStorageBucket();
  return new Uint8Array(await getBytes(ref(storage, path)));
}
