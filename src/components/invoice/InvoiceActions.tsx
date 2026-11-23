import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Printer, FileDown, ImageDown, Share2, MessageCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InvoiceReceipt } from '@/components/pos/InvoiceReceipt';
import { useStore } from '@/store/useStore';
import { getInvoiceDesign } from '@/core/defaults';
import { elementToPdfBytes, elementToPngBytes, printInvoiceElement } from '@/lib/invoiceOutput';
import { saveFile, shareFile, shareToWhatsApp } from '@/platform/files';
import { TEMPLATE_META, isNewTemplate } from './templates';
import type { PaperSize, ReceiptTemplate, Sale } from '@/types';

type Busy = null | 'print' | 'pdf' | 'png' | 'share' | 'wa';

/** Invoice preview with print / PDF / PNG / share / WhatsApp actions. */
export function InvoiceActions({ sale, compact = false }: { sale: Sale; compact?: boolean }) {
  const settings = useStore(s => s.settings);
  const design = getInvoiceDesign(settings);
  const [template, setTemplate] = useState<ReceiptTemplate>(settings.receiptTemplate);
  const [paper, setPaper] = useState<PaperSize>(isNewTemplate(settings.receiptTemplate) ? design.paperSize : settings.printerType);
  const [busy, setBusy] = useState<Busy>(null);
  const ref = useRef<HTMLDivElement>(null);
  const el = () => ref.current?.firstElementChild?.firstElementChild as HTMLElement || ref.current!;
  const effPaper: PaperSize = isNewTemplate(template) ? paper : settings.printerType;
  const base = `${sale.invoiceNumber}`;

  const run = async (b: Busy, fn: () => Promise<void>) => {
    setBusy(b);
    try { await fn(); } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); } finally { setBusy(null); }
  };
  const caption = `${settings.storeName} – ${sale.kind === 'return' ? 'Return' : 'Invoice'} ${sale.invoiceNumber}, Total ${settings.currency} ${sale.total.toLocaleString()}`;

  return (
    <div className="space-y-3">
      {!compact && (
        <div className="flex gap-2 no-print">
          <Select value={template} onValueChange={v => setTemplate(v as ReceiptTemplate)}>
            <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(TEMPLATE_META).map(([k, m]) => <SelectItem key={k} value={k}>{m.name}</SelectItem>)}
              <SelectItem value="classic">Legacy – Classic</SelectItem>
              <SelectItem value="bordered">Legacy – Bordered</SelectItem>
              <SelectItem value="modern">Legacy – Modern</SelectItem>
              <SelectItem value="compact">Legacy – Compact</SelectItem>
            </SelectContent>
          </Select>
          {isNewTemplate(template) && (
            <Select value={paper} onValueChange={v => setPaper(v as PaperSize)}>
              <SelectTrigger className="h-8 text-xs w-24"><SelectValue /></SelectTrigger>
              <SelectContent>{(['58mm', '80mm', 'A5', 'A4'] as PaperSize[]).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>
      )}
      <div className="overflow-auto max-h-[55vh] bg-muted/40 rounded-lg p-2 flex justify-center">
        <div ref={ref} className="shadow-sm origin-top" style={{ zoom: effPaper === 'A4' ? 0.6 : effPaper === 'A5' ? 0.8 : 1 }}>
          <InvoiceReceipt sale={sale} template={template} paperSize={effPaper} />
        </div>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 no-print">
        <Button size="sm" onClick={() => run('print', async () => {
          const r = await printInvoiceElement(el(), effPaper, { silent: settings.autoPrint && !settings.printPreview, printerName: settings.printerName });
          if (!r.ok && r.error && !/cancel/i.test(r.error)) toast.error(`Print failed: ${r.error}`);
        })} disabled={!!busy}>{busy === 'print' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}<span className="ms-1">Print</span></Button>
        <Button size="sm" variant="outline" disabled={!!busy} onClick={() => run('pdf', async () => {
          const r = await saveFile(await elementToPdfBytes(el(), effPaper), `${base}.pdf`, 'application/pdf');
          if (r.ok) toast.success(`PDF saved: ${r.location}`);
        })}>{busy === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}<span className="ms-1">PDF</span></Button>
        <Button size="sm" variant="outline" disabled={!!busy} onClick={() => run('png', async () => {
          const r = await saveFile(await elementToPngBytes(el()), `${base}.png`, 'image/png');
          if (r.ok) toast.success(`PNG saved: ${r.location}`);
        })}>{busy === 'png' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageDown className="w-4 h-4" />}<span className="ms-1">PNG</span></Button>
        <Button size="sm" variant="outline" disabled={!!busy} onClick={() => run('share', async () => {
          const r = await shareFile(await elementToPdfBytes(el(), effPaper), `${base}.pdf`, 'application/pdf', { title: caption, text: caption });
          toast.message(r.message);
        })}><Share2 className="w-4 h-4" /><span className="ms-1">Share</span></Button>
        <Button size="sm" variant="outline" className="text-green-700 border-green-600/40" disabled={!!busy} onClick={() => run('wa', async () => {
          const r = await shareToWhatsApp(await elementToPdfBytes(el(), effPaper), `${base}.pdf`, 'application/pdf', { phone: sale.customerPhone, text: caption });
          toast.message(r.message, { duration: 8000 });
        })}><MessageCircle className="w-4 h-4" /><span className="ms-1">PDF→WA</span></Button>
        <Button size="sm" variant="outline" className="text-green-700 border-green-600/40" disabled={!!busy} onClick={() => run('wa', async () => {
          const r = await shareToWhatsApp(await elementToPngBytes(el()), `${base}.png`, 'image/png', { phone: sale.customerPhone, text: caption });
          toast.message(r.message, { duration: 8000 });
        })}><MessageCircle className="w-4 h-4" /><span className="ms-1">PNG→WA</span></Button>
      </div>
    </div>
  );
}
