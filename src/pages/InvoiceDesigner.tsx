import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { FileText, Check, RotateCcw, Upload } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TEMPLATES, TEMPLATE_META } from '@/components/invoice/templates';
import { InvoiceActions } from '@/components/invoice/InvoiceActions';
import { DEFAULT_INVOICE_DESIGN, getInvoiceDesign } from '@/core/defaults';
import { captureImage } from '@/platform/images';
import type { InvoiceDesign, InvoiceTemplateId, PaperSize, Sale, InvoiceFieldVisibility, InvoiceColumnWidths } from '@/types';

/** Realistic sample used for previews when the shop has no sales yet. */
function sampleSale(currencyName: string): Sale {
  void currencyName;
  const mk = (brand: string, article: string, sku: string, qty: number, price: number, unit: 'meter' | 'suit' | 'piece', color?: string, discount = 0) => ({
    productId: sku, quantity: qty, color, unitPrice: price, discount, lineTotal: qty * price - discount, sellUnit: unit,
    product: { id: sku, brand, article, sku, category: 'Ladies', productType: 'Fabric Suit', season: 'Summer', fabricCategory: 'Lawn', salePrice: price, costPrice: 0, active: true, stockMode: 'meter' as const, stockQty: 0, colorStocks: [], suitCutMeters: 4, lowStockThreshold: 0, createdAt: '', updatedAt: '' },
  });
  const items = [
    mk('Gul Ahmed', 'Summer Lawn 3pc', 'GA-LWN-014', 2, 4500, 'suit', 'Maroon'),
    mk('Grace', 'Wash & Wear', 'GRA-WW-002', 4.5, 700, 'meter', 'Navy Blue', 150),
    mk('Khaddi', 'Khaddar Plain', 'KHD-KHA-007', 3, 650, 'meter'),
    mk('Junaid Jamshed', 'Cotton Kurta', 'JJ-KUR-021', 1, 3800, 'piece', 'White'),
  ];
  const subtotal = items.reduce((a, i) => a + i.lineTotal, 0);
  return {
    id: 'sample', invoiceNumber: 'INV-01042', customerName: 'Ayesha Siddiqui', customerPhone: '0312-7778899', items,
    subtotal, discountAmount: 250, discountPercent: 0, total: subtotal - 250, paymentMethod: 'Cash', saleType: 'partial',
    amountPaid: 15000, creditAmount: subtotal - 250 - 15000, createdAt: new Date().toISOString(), deleted: false, kind: 'sale',
    payments: [{ method: 'Cash', amount: 10000 }, { method: 'JazzCash', amount: 5000 }], cashierName: 'Admin', notes: 'Stitching delivery on Friday',
  };
}

const FIELD_LABELS: Record<keyof InvoiceFieldVisibility, string> = {
  logo: 'Logo', address: 'Address', phone: 'Phone', customer: 'Customer info', sku: 'SKU', unit: 'Unit column',
  discount: 'Discount', tax: 'Tax', paid: 'Paid / payments', balance: 'Remaining balance', terms: 'Terms & conditions',
  notes: 'Custom notes', qr: 'QR codes', footer: 'Footer', cashier: 'Cashier name',
};

export default function InvoiceDesigner() {
  const { settings, updateSettings, sales } = useStore();
  const [design, setDesign] = useState<InvoiceDesign>(getInvoiceDesign(settings));
  const [selected, setSelected] = useState<InvoiceTemplateId>(
    (Object.keys(TEMPLATES) as InvoiceTemplateId[]).includes(settings.receiptTemplate as InvoiceTemplateId) ? settings.receiptTemplate as InvoiceTemplateId : 'classic-retail');
  const lastSale = useMemo(() => [...sales].reverse().find(s => !s.deleted && s.kind !== 'return'), [sales]);
  const [useReal, setUseReal] = useState(false);
  const sale = useReal && lastSale ? lastSale : sampleSale(settings.currency);
  const Tpl = TEMPLATES[selected];
  const dirty = JSON.stringify(design) !== JSON.stringify(getInvoiceDesign(settings)) || selected !== settings.receiptTemplate;

  const save = () => {
    updateSettings({ invoiceDesign: design, receiptTemplate: selected, printerType: design.paperSize === '58mm' ? '58mm' : '80mm' });
    toast.success(`${TEMPLATE_META[selected].name} set as default invoice`);
  };
  const setField = (k: keyof InvoiceFieldVisibility, v: boolean) => setDesign(d => ({ ...d, fields: { ...d.fields, [k]: v } }));
  const setCol = (k: keyof InvoiceColumnWidths, v: number) => setDesign(d => ({ ...d, columns: { ...d.columns, [k]: v } }));
  const scale = design.paperSize === 'A4' ? 0.62 : design.paperSize === 'A5' ? 0.8 : 1;

  return (
    <div className="p-4 md:p-6 space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="w-6 h-6" /> Invoice Template Designer</h1>
          <p className="text-sm text-muted-foreground">Current default: <b>{TEMPLATE_META[settings.receiptTemplate as InvoiceTemplateId]?.name || `Legacy ${settings.receiptTemplate}`}</b></p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setDesign({ ...DEFAULT_INVOICE_DESIGN, paperSize: design.paperSize })}><RotateCcw className="w-4 h-4 me-2" />Reset style</Button>
          <Button onClick={save} disabled={!dirty}><Check className="w-4 h-4 me-2" />Save as default</Button>
        </div>
      </div>

      {/* Template gallery */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {(Object.keys(TEMPLATES) as InvoiceTemplateId[]).map(id => {
          const T = TEMPLATES[id];
          const thumbDesign = { ...design, paperSize: TEMPLATE_META[id].best[0] };
          const w = thumbDesign.paperSize === 'A4' ? 794 : thumbDesign.paperSize === 'A5' ? 559 : thumbDesign.paperSize === '80mm' ? 302 : 219;
          return (
            <button key={id} onClick={() => { setSelected(id); setDesign(d => ({ ...d, paperSize: TEMPLATE_META[id].best.includes(d.paperSize) ? d.paperSize : TEMPLATE_META[id].best[0] })); }}
              className={`text-start rounded-xl border-2 bg-card overflow-hidden transition-all ${selected === id ? 'border-primary shadow-lg' : 'border-border hover:border-primary/40'}`}>
              <div className="h-40 overflow-hidden bg-white flex justify-center pointer-events-none">
                <div style={{ zoom: 170 / w }}><T sale={sale} settings={settings} design={thumbDesign} /></div>
              </div>
              <div className="p-2 border-t border-border">
                <p className="text-xs font-bold flex items-center gap-1">{selected === id && <Check className="w-3 h-3 text-primary" />}{TEMPLATE_META[id].name}</p>
                <p className="text-[10px] text-muted-foreground line-clamp-2">{TEMPLATE_META[id].description}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-[380px_1fr] gap-4">
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border p-4 space-y-3">
            <h3 className="font-semibold text-sm">Layout & colours</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Paper size</Label>
                <Select value={design.paperSize} onValueChange={v => setDesign({ ...design, paperSize: v as PaperSize })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(['58mm', '80mm', 'A5', 'A4'] as PaperSize[]).map(p => <SelectItem key={p} value={p}>{p}{TEMPLATE_META[selected].best.includes(p) ? ' ★' : ''}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Title</Label><Input value={design.title} onChange={e => setDesign({ ...design, title: e.target.value })} /></div>
              <div><Label>Accent colour</Label><Input type="color" className="h-10 p-1" value={design.accentColor} onChange={e => setDesign({ ...design, accentColor: e.target.value })} /></div>
              <div><Label>Secondary colour</Label><Input type="color" className="h-10 p-1" value={design.secondaryColor} onChange={e => setDesign({ ...design, secondaryColor: e.target.value })} /></div>
            </div>
            <div><Label>Text size ({Math.round(design.fontScale * 100)}%)</Label><Slider min={0.8} max={1.3} step={0.05} value={[design.fontScale]} onValueChange={([v]) => setDesign({ ...design, fontScale: v })} /></div>
            <div className="flex items-center gap-3">
              {settings.logoUrl ? <img src={settings.logoUrl} className="h-10 w-auto rounded border bg-white" alt="" /> : <span className="text-xs text-muted-foreground">No logo</span>}
              <Button size="sm" variant="outline" onClick={async () => { const img = await captureImage('gallery', { maxSize: 400, keepPng: true }); if (img) updateSettings({ logoUrl: img }); }}><Upload className="w-3.5 h-3.5 me-1" />Upload logo</Button>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-4">
            <h3 className="font-semibold text-sm mb-2">Show / hide fields</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {(Object.keys(FIELD_LABELS) as (keyof InvoiceFieldVisibility)[]).map(k => (
                <label key={k} className="flex items-center justify-between text-sm gap-2"><span>{FIELD_LABELS[k]}</span><Switch checked={design.fields[k]} onCheckedChange={v => setField(k, v)} /></label>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-4 space-y-2">
            <h3 className="font-semibold text-sm">Column widths (relative)</h3>
            {(Object.keys(design.columns) as (keyof InvoiceColumnWidths)[]).map(k => (
              <div key={k} className="grid grid-cols-[70px_1fr_32px] items-center gap-2 text-sm">
                <span className="capitalize">{k}</span>
                <Slider min={4} max={60} step={1} value={[design.columns[k]]} onValueChange={([v]) => setCol(k, v)} />
                <span className="text-xs text-muted-foreground text-end">{design.columns[k]}</span>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground">Applies to Classic, Premium and Professional table layouts.</p>
          </div>

          <div className="bg-card rounded-xl border border-border p-4 space-y-3">
            <h3 className="font-semibold text-sm">Tax, terms & footer</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tax label</Label><Input value={design.taxLabel} onChange={e => setDesign({ ...design, taxLabel: e.target.value })} /></div>
              <div><Label>Tax % (prices inclusive)</Label><Input type="number" min={0} max={50} value={design.taxRate} onChange={e => setDesign({ ...design, taxRate: Math.max(0, parseFloat(e.target.value) || 0) })} /></div>
            </div>
            <div><Label>Terms & conditions</Label><Textarea rows={3} value={design.terms} onChange={e => setDesign({ ...design, terms: e.target.value })} /></div>
            <div><Label>Footer message</Label><Input value={settings.footerMessage} onChange={e => updateSettings({ footerMessage: e.target.value })} /></div>
            <div><Label>Footer note</Label><Input value={settings.footerNote} onChange={e => updateSettings({ footerNote: e.target.value })} /></div>
          </div>
        </div>

        <div className="space-y-3 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Live preview – {TEMPLATE_META[selected].name} · {design.paperSize}</h3>
            {lastSale && <label className="flex items-center gap-2 text-sm"><Switch checked={useReal} onCheckedChange={setUseReal} />Use last real sale</label>}
          </div>
          <div className="bg-muted/50 rounded-xl border border-border p-4 overflow-auto flex justify-center">
            <div className="shadow-xl" style={{ zoom: scale }}><Tpl sale={sale} settings={settings} design={design} /></div>
          </div>
          {useReal && lastSale && !dirty && <div className="bg-card rounded-xl border border-border p-4"><h3 className="font-semibold text-sm mb-2">Test print / export</h3><InvoiceActions sale={lastSale} compact /></div>}
          {dirty && <p className="text-xs text-muted-foreground">Save as default to test-print with these settings.</p>}
        </div>
      </div>
    </div>
  );
}
