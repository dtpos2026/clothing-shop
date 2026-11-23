import { useState } from 'react';
import { toast } from 'sonner';
import { FileDown, FileSpreadsheet, FileText, ImageDown, Share2, MessageCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStore } from '@/store/useStore';
import { exportTable, type ExportFormat, type TableSpec } from '@/lib/exporters';
import { saveFile, shareFile, shareToWhatsApp } from '@/platform/files';

const ICON: Record<ExportFormat, typeof FileDown> = { pdf: FileText, png: ImageDown, csv: FileDown, xlsx: FileSpreadsheet };

/** Save / share / WhatsApp any table in PDF, PNG, CSV or Excel. */
export function ExportButtons<T>({ spec, phone, formats = ['pdf', 'xlsx', 'csv', 'png'], size = 'sm' }: {
  spec: () => TableSpec<T>; phone?: string; formats?: ExportFormat[]; size?: 'sm' | 'default';
}) {
  const settings = useStore(s => s.settings);
  const [busy, setBusy] = useState<string | null>(null);
  const [fmt, setFmt] = useState<ExportFormat>(formats[0]);

  const go = async (action: 'save' | 'share' | 'wa', f: ExportFormat = fmt) => {
    setBusy(action + f);
    try {
      const s = spec();
      const out = await exportTable(s, f, settings);
      const caption = `${settings.storeName} – ${s.title}`;
      if (action === 'save') {
        const r = await saveFile(out.bytes, out.fileName, out.mime);
        if (r.ok) toast.success(`Saved: ${r.location}`); else if (r.error) toast.error(r.error);
      } else if (action === 'share') {
        toast.message((await shareFile(out.bytes, out.fileName, out.mime, { title: caption, text: caption })).message);
      } else {
        toast.message((await shareToWhatsApp(out.bytes, out.fileName, out.mime, { phone, text: caption })).message, { duration: 8000 });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div className="flex rounded-md border border-border overflow-hidden dense-touch">
        {formats.map(f => {
          const I = ICON[f];
          return (
            <button key={f} onClick={() => setFmt(f)} className={`px-2 py-1 text-xs flex items-center gap-1 ${fmt === f ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}>
              <I className="w-3.5 h-3.5" />{f.toUpperCase()}
            </button>
          );
        })}
      </div>
      <Button size={size} variant="outline" onClick={() => go('save')} disabled={!!busy}>{busy?.startsWith('save') ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}<span className="ms-1">Save</span></Button>
      <Button size={size} variant="outline" onClick={() => go('share')} disabled={!!busy}><Share2 className="w-4 h-4" /><span className="ms-1">Share</span></Button>
      <Button size={size} variant="outline" className="text-green-700 border-green-600/40" onClick={() => go('wa')} disabled={!!busy}><MessageCircle className="w-4 h-4" /><span className="ms-1">WhatsApp</span></Button>
    </div>
  );
}
