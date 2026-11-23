import { useState } from 'react';
import { toast } from 'sonner';
import JSZip from 'jszip';
import { Share2, Archive, Loader2, Info } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ExportButtons } from '@/components/share/ExportButtons';
import { DATASETS, buildDataset, type DatasetId } from '@/lib/datasets';
import { tableToCSV, fileStamp, slugify } from '@/lib/exporters';
import { saveFile, shareFile } from '@/platform/files';
import { createBackup } from '@/services/backupService';
import { cn } from '@/lib/utils';

export default function ExportCenter() {
  const getData = () => useStore.getState().getBusinessData();
  const settings = useStore(s => s.settings);
  const [ds, setDs] = useState<DatasetId>('sales');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const meta = DATASETS.find(d => d.id === ds)!;
  const range = meta.dated ? { from: from || undefined, to: to || undefined } : {};
  const preview = buildDataset(ds, getData(), range);

  const zipAll = async (share: boolean) => {
    setBusy(true);
    try {
      const zip = new JSZip();
      const data = getData();
      for (const d of DATASETS) zip.file(`csv/${slugify(d.name)}.csv`, tableToCSV(buildDataset(d.id, data, d.dated ? range : {})));
      const backup = await createBackup('manual');
      zip.file(`backup/${backup.fileName}`, backup.bytes);
      zip.file('README.txt', `${settings.storeName} – data export ${new Date().toLocaleString()}\r\n\r\ncsv/     one CSV per dataset (UTF-8 with BOM: opens in Excel with Urdu text)\r\nbackup/  full backup – restore it from Backup / Restore on Windows or Android\r\nChecksum (data.json SHA-256): ${backup.manifest.checksum}\r\n`);
      const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
      const name = `${slugify(settings.storeName)}-export-${fileStamp()}.zip`;
      if (share) toast.message((await shareFile(bytes, name, 'application/zip', { title: name })).message);
      else { const r = await saveFile(bytes, name, 'application/zip'); if (r.ok) toast.success(`Saved: ${r.location}`); }
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Share2 className="w-6 h-6" /> Export & Share Center</h1>
        <p className="text-sm text-muted-foreground">PDF, PNG, CSV and Excel for every report – save, share, or send on WhatsApp.</p>
      </div>

      <div className="grid lg:grid-cols-[260px_1fr] gap-4">
        <div className="bg-card rounded-xl border border-border p-2 h-fit">
          {DATASETS.map(d => (
            <button key={d.id} onClick={() => setDs(d.id)} className={cn('w-full text-start px-3 py-2 rounded-lg text-sm', ds === d.id ? 'bg-primary text-primary-foreground font-semibold' : 'hover:bg-muted')}>{d.name}</button>
          ))}
        </div>

        <div className="space-y-4 min-w-0">
          <div className="bg-card rounded-xl border border-border p-4 space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="me-auto"><h3 className="font-semibold">{preview.title}</h3><p className="text-xs text-muted-foreground">{preview.rows.length} rows{preview.subtitle ? ` · ${preview.subtitle}` : ''}</p></div>
              {meta.dated && (<>
                <div><Label className="text-xs">From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-9" /></div>
                <div><Label className="text-xs">To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-9" /></div>
              </>)}
            </div>
            <ExportButtons spec={() => buildDataset(ds, getData(), range)} />
          </div>

          <div className="bg-card rounded-xl border border-border overflow-auto max-h-[50vh]">
            <table className="w-full text-xs">
              <thead className="bg-muted sticky top-0"><tr>{preview.columns.map(c => <th key={c.header} className={cn('p-2 font-semibold whitespace-nowrap', c.numeric ? 'text-end' : 'text-start')}>{c.header}</th>)}</tr></thead>
              <tbody>
                {preview.rows.slice(0, 100).map((r, i) => (
                  <tr key={i} className="border-t border-border">{preview.columns.map(c => { const v = c.value(r); return <td key={c.header} className={cn('p-2', c.numeric && 'text-end font-mono')}>{typeof v === 'number' ? v.toLocaleString() : v}</td>; })}</tr>
                ))}
                {preview.rows.length === 0 && <tr><td className="p-6 text-center text-muted-foreground" colSpan={preview.columns.length}>No data</td></tr>}
              </tbody>
            </table>
            {preview.rows.length > 100 && <p className="text-xs text-muted-foreground p-2">Showing first 100 rows – exports include all {preview.rows.length}.</p>}
          </div>

          <div className="bg-card rounded-xl border border-border p-4 flex flex-wrap items-center gap-3">
            <Archive className="w-8 h-8 text-primary" />
            <div className="flex-1 min-w-[200px]">
              <h3 className="font-semibold">Complete ZIP export</h3>
              <p className="text-xs text-muted-foreground">All datasets as CSV + a full restorable backup (with images and templates) in one ZIP.</p>
            </div>
            <Button variant="outline" disabled={busy} onClick={() => zipAll(false)}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save ZIP'}</Button>
            <Button variant="outline" disabled={busy} onClick={() => zipAll(true)}>Share ZIP</Button>
          </div>
          <p className="text-xs text-muted-foreground flex gap-1.5"><Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />Sharing opens WhatsApp or the share sheet with the file attached; the message is only delivered when you press Send there. If an app can't receive files, the file is saved so you can attach it manually.</p>
        </div>
      </div>
    </div>
  );
}
