import { useState } from 'react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { Database, Download, Upload, History, ShieldCheck, AlertTriangle, Cloud, Share2, Loader2, RotateCcw, FileJson } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { pickFile, saveFile, shareFile } from '@/platform/files';
import { BackupError } from '@/core/backup';
import {
  createBackup, readBackup, restoreMerge, restoreReplace, loadSafetyBackup, type BackupPreview,
  uploadCloudBackup, listCloudBackups, downloadCloudBackup,
} from '@/services/backupService';
import { isFirebaseConfigured } from '@/cloud/firebase';
import { useCloudStatus } from '@/cloud/status';
import { DATASETS } from '@/lib/datasets';
import { BUSINESS_COLLECTIONS } from '@/core/migrations';

const LABEL: Record<string, string> = Object.fromEntries([
  ...DATASETS.map(d => [d.id, d.name]),
  ['credits', 'Udhar entries'], ['khataEntries', 'Khata entries'], ['goodsReceivings', 'Goods receivings'], ['heldBills', 'Held bills'],
  ['savingsTargets', 'Savings targets'], ['users', 'Users'], ['accounts', 'Accounts'], ['accountTransactions', 'Account transactions'],
  ['leads', 'Leads'], ['supplierPayments', 'Supplier payments'], ['stockAdjustments', 'Stock adjustments'], ['cashEntries', 'Cash entries'], ['dayClosings', 'Day closings'],
]);

export default function Backup() {
  const { backups, businessId, settings } = useStore();
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [cloudList, setCloudList] = useState<{ name: string; path: string; size: number; updated: string }[] | null>(null);
  const user = useCloudStatus(s => s.user);
  const current = useStore.getState().getBusinessData();

  const wrap = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); } finally { setBusy(null); }
  };

  const doBackup = (share: boolean) => wrap(share ? 'share' : 'save', async () => {
    const r = await createBackup('manual');
    if (share) toast.message((await shareFile(r.bytes, r.fileName, 'application/zip', { title: r.fileName })).message);
    else {
      const s = await saveFile(r.bytes, r.fileName, 'application/zip');
      if (s.ok) toast.success(`Backup saved: ${s.location}`, { description: `Checksum ${r.manifest.checksum.slice(0, 16)}…` });
    }
  });

  const openFile = () => wrap('open', async () => {
    const f = await pickFile('.zip,.json,application/zip,application/json');
    if (!f) return;
    try {
      setPreview(await readBackup(f.bytes));
    } catch (e) {
      toast.error(e instanceof BackupError ? e.message : `Could not read backup: ${String(e)}`);
    }
  });

  const restore = (mode: 'replace' | 'merge') => wrap(mode, async () => {
    if (!preview) return;
    if (mode === 'replace' && !confirm('Replace ALL current data with this backup? A safety backup of the current data is created first.')) return;
    if (mode === 'replace') {
      const safety = await restoreReplace(preview);
      toast.success('Backup restored', { description: `Previous data kept as safety backup: ${safety}` });
    } else {
      const { safety, stats } = await restoreMerge(preview);
      const added = Object.values(stats).reduce((a, s) => a + s.added, 0);
      const dups = Object.values(stats).reduce((a, s) => a + s.duplicates, 0);
      toast.success(`Merged ${added} new records, skipped ${dups} duplicates`, { description: `Safety backup: ${safety}` });
    }
    setPreview(null);
  });

  const undoLastRestore = () => wrap('undo', async () => {
    const bytes = await loadSafetyBackup();
    if (!bytes) { toast.error('No safety backup found on this device'); return; }
    setPreview(await readBackup(bytes));
  });

  const counts = preview ? BUSINESS_COLLECTIONS.map(c => ({ c, inc: (preview.data[c] as unknown[] | undefined)?.length || 0, cur: (current[c] as unknown[]).length })).filter(x => x.inc || x.cur) : [];
  const otherBusiness = preview && preview.manifest.businessId && preview.manifest.businessId !== businessId;

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Database className="w-6 h-6" /> Backup / Restore</h1>
        <p className="text-sm text-muted-foreground">One backup format for Windows and Android (.dtbackup.zip): data, product images, logo, invoice templates, schema version and SHA-256 checksum.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl">
        <div className="bg-card rounded-xl border border-border p-5 text-center space-y-3">
          <Download className="w-10 h-10 mx-auto text-primary" />
          <h3 className="font-semibold">Create backup</h3>
          <p className="text-xs text-muted-foreground">Save to a folder / USB / SD card, or share to Google Drive, WhatsApp, email…</p>
          <div className="flex gap-2">
            <Button onClick={() => doBackup(false)} className="flex-1" disabled={!!busy}>{busy === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}</Button>
            <Button variant="outline" onClick={() => doBackup(true)} disabled={!!busy}><Share2 className="w-4 h-4" /></Button>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-5 text-center space-y-3">
          <Upload className="w-10 h-10 mx-auto text-warning" />
          <h3 className="font-semibold">Restore backup</h3>
          <p className="text-xs text-muted-foreground">Accepts .dtbackup.zip from Windows or Android and old v1 .json backups. Contents are validated and previewed first.</p>
          <Button variant="outline" onClick={openFile} className="w-full" disabled={!!busy}>{busy === 'open' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Choose file…'}</Button>
        </div>
        <div className="bg-card rounded-xl border border-border p-5 text-center space-y-3">
          <Cloud className="w-10 h-10 mx-auto text-info" />
          <h3 className="font-semibold">Cloud backup</h3>
          {!isFirebaseConfigured() ? <p className="text-xs text-muted-foreground">Cloud is not configured in this build.</p>
            : !user ? <p className="text-xs text-muted-foreground">Sign in on Cloud & License to use cloud backups.</p> : (
              <div className="flex gap-2">
                <Button className="flex-1" disabled={!!busy} onClick={() => wrap('up', async () => { const p = await uploadCloudBackup(); toast.success(`Uploaded: ${p.split('/').pop()}`); })}>{busy === 'up' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Upload now'}</Button>
                <Button variant="outline" disabled={!!busy} onClick={() => wrap('list', async () => setCloudList(await listCloudBackups()))}>List</Button>
              </div>
            )}
        </div>
      </div>

      {cloudList && (
        <div className="bg-card rounded-xl border border-border p-4 max-w-5xl">
          <h3 className="font-semibold mb-2">Cloud backups</h3>
          {cloudList.length === 0 ? <p className="text-sm text-muted-foreground">None yet</p> : cloudList.map(c => (
            <div key={c.path} className="flex justify-between items-center py-2 border-t border-border text-sm">
              <span className="truncate">{c.name}</span>
              <span className="flex items-center gap-3 text-muted-foreground">{(c.size / 1024).toFixed(0)} KB · {format(parseISO(c.updated), 'dd MMM yyyy HH:mm')}
                <Button size="sm" variant="outline" onClick={() => wrap('dl', async () => setPreview(await readBackup(await downloadCloudBackup(c.path))))}>Restore…</Button></span>
            </div>
          ))}
        </div>
      )}

      <div className="bg-card rounded-xl border border-border p-5 max-w-5xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2"><History className="w-4 h-4" /> Backup history</h3>
          <Button size="sm" variant="ghost" onClick={undoLastRestore} disabled={!!busy}><RotateCcw className="w-3.5 h-3.5 me-1" />Restore last safety backup…</Button>
        </div>
        <p className="text-xs text-muted-foreground mb-2">An automatic backup is kept on this device every day (last 7 days), and a safety backup is made before every restore.{settings.lastBackupAt ? ` Last manual backup: ${format(parseISO(settings.lastBackupAt), 'dd MMM yyyy, hh:mm a')}.` : ''}</p>
        {backups.length === 0 ? <p className="text-sm text-muted-foreground">No backups created yet</p> : (
          <div className="space-y-1 max-h-64 overflow-auto">
            {backups.slice().reverse().map(b => (
              <div key={b.id} className="flex justify-between items-center py-1.5 border-b border-border last:border-0 text-sm">
                <span>{format(parseISO(b.date), 'dd MMM yyyy, hh:mm a')} <span className="text-xs px-1.5 py-0.5 rounded bg-muted ms-1 capitalize">{b.type}</span></span>
                <span className="text-muted-foreground text-xs">{b.size}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!preview} onOpenChange={v => !v && setPreview(null)}>
        <DialogContent className="sm:max-w-xl max-h-[92dvh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">{preview?.legacy ? <FileJson className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5 text-success" />} Backup preview</DialogTitle>
            <DialogDescription>Nothing has been changed yet. Review the contents, then choose how to restore.</DialogDescription>
          </DialogHeader>
          {preview && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-muted p-3">
                <span className="text-muted-foreground">Business</span><b>{preview.manifest.businessName || preview.data.settings?.storeName || '-'}</b>
                <span className="text-muted-foreground">Created</span><span>{preview.manifest.createdAt ? format(parseISO(preview.manifest.createdAt), 'dd MMM yyyy, hh:mm a') : 'unknown (v1)'}</span>
                <span className="text-muted-foreground">Made on</span><span className="capitalize">{preview.manifest.platform}</span>
                <span className="text-muted-foreground">Format / schema</span><span>v{preview.manifest.formatVersion} / v{preview.manifest.schemaVersion}</span>
                <span className="text-muted-foreground">Integrity</span><span className={preview.legacy ? 'text-warning' : 'text-success'}>{preview.legacy ? 'No checksum (legacy)' : 'Checksum verified ✓'}</span>
                <span className="text-muted-foreground">Size</span><span>{(preview.sizeBytes / 1024).toFixed(1)} KB</span>
              </div>
              {otherBusiness && <p className="flex gap-2 text-warning text-xs"><AlertTriangle className="w-4 h-4 flex-shrink-0" />This backup belongs to a different business workspace. "Replace" will switch this device to that business.</p>}
              {preview.warnings.map((w, i) => <p key={i} className="text-xs text-warning flex gap-2"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />{w}</p>)}
              <table className="w-full text-xs">
                <thead><tr className="text-muted-foreground"><th className="text-start py-1">Records</th><th className="text-end">In backup</th><th className="text-end">On this device now</th></tr></thead>
                <tbody>{counts.map(x => <tr key={x.c} className="border-t border-border"><td className="py-1">{LABEL[x.c] || x.c}</td><td className="text-end font-mono">{x.inc}</td><td className="text-end font-mono text-muted-foreground">{x.cur}</td></tr>)}</tbody>
              </table>
              <div className="grid sm:grid-cols-2 gap-2">
                <Button variant="outline" disabled={!!busy} onClick={() => restore('merge')}>{busy === 'merge' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Merge (add missing records)'}</Button>
                <Button variant="destructive" disabled={!!busy} onClick={() => restore('replace')}>{busy === 'replace' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Replace all data'}</Button>
              </div>
              <p className="text-[11px] text-muted-foreground">Merge never overwrites existing records; duplicates (same id, or product with the same SKU/barcode) are skipped. A safety backup of the current data is saved before either option.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
