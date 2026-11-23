import { useMemo, useRef, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';
import { Barcode, Printer, ImageDown, Search, Minus, Plus, Share2, Save, ScanLine } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CodeImage, codeToPng, dataUrlToBytes } from '@/components/barcode/CodeImage';
import { getLabelSettings } from '@/core/defaults';
import { labelCode, findProductByCode } from '@/core/barcode';
import { unitPriceFor, isMeterProduct } from '@/core/inventory';
import { printHtml } from '@/platform/print';
import { saveFile, shareFile, shareToWhatsApp } from '@/platform/files';
import { useScanner } from '@/components/scan/ScanProvider';
import type { BarcodeFormat, LabelSettings, LabelSize, Product } from '@/types';

export const LABEL_SIZES: Record<LabelSize, { name: string; w: number; h: number; sheet?: { cols: number; rows: number; pageW: number; pageH: number; marginX: number; marginY: number } }> = {
  '38x25': { name: '38 × 25 mm (roll)', w: 38, h: 25 },
  '50x25': { name: '50 × 25 mm (roll)', w: 50, h: 25 },
  '50x30': { name: '50 × 30 mm (roll)', w: 50, h: 30 },
  '58mm': { name: '58 mm thermal (58 × 40)', w: 58, h: 40 },
  '80mm': { name: '80 mm thermal (80 × 50)', w: 80, h: 50 },
  'A4-3x8': { name: 'A4 sheet – 24 labels (70 × 37)', w: 70, h: 37, sheet: { cols: 3, rows: 8, pageW: 210, pageH: 297, marginX: 0, marginY: 0.5 } },
  'A4-4x10': { name: 'A4 sheet – 40 labels (52.5 × 29.7)', w: 52.5, h: 29.7, sheet: { cols: 4, rows: 10, pageW: 210, pageH: 297, marginX: 0, marginY: 0 } },
};

const MM = 3.7795; // px per mm at 96dpi

function LabelView({ p, cfg, store, currency }: { p: Product; cfg: LabelSettings; store: string; currency: string }) {
  const size = LABEL_SIZES[cfg.size];
  const code = labelCode(p, cfg.codeType);
  const small = size.h < 30;
  const price = isMeterProduct(p) ? `${currency} ${unitPriceFor(p, 'meter').toLocaleString()}/m` : `${currency} ${p.salePrice.toLocaleString()}`;
  const isQR = cfg.codeType === 'QR';
  return (
    <div className="dt-label" style={{
      width: `${size.w}mm`, height: `${size.h}mm`, padding: '1.2mm', boxSizing: 'border-box', background: '#fff', color: '#000',
      fontFamily: 'Arial, sans-serif', overflow: 'hidden', display: 'flex', flexDirection: isQR ? 'row' : 'column',
      alignItems: 'center', justifyContent: 'center', gap: '1mm', textAlign: 'center', border: '0.2mm dashed #bbb',
    }}>
      {isQR && <CodeImage value={code} format="QR" qrSize={Math.round((size.h - 4) * MM)} showText={false} />}
      <div style={{ minWidth: 0, flex: isQR ? 1 : undefined, width: isQR ? undefined : '100%', lineHeight: 1.1 }}>
        {cfg.showStore && <div style={{ fontSize: small ? 6.5 : 8, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{store}</div>}
        {cfg.showName && <div style={{ fontSize: small ? 7 : 9, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.brand} {p.article}{p.design ? ` · ${p.design}` : ''}</div>}
        {!isQR && <CodeImage value={code} format={cfg.codeType} height={Math.max(14, Math.round((size.h - (small ? 13 : 17)) * MM))} width={size.w < 45 ? 1.1 : 1.4} showText={cfg.showCodeText} fontSize={small ? 8 : 10} />}
        {isQR && cfg.showCodeText && <div style={{ fontSize: 7, fontFamily: 'monospace' }}>{code}</div>}
        {cfg.showSku && code !== p.sku && <div style={{ fontSize: 7, fontFamily: 'monospace' }}>{p.sku}</div>}
        {cfg.showPrice && <div style={{ fontSize: small ? 9 : 11, fontWeight: 900 }}>{price}</div>}
      </div>
    </div>
  );
}

export default function Labels() {
  const { products, settings, updateSettings } = useStore();
  const [params] = useSearchParams();
  const [cfg, setCfg] = useState<LabelSettings>(getLabelSettings(settings));
  const [search, setSearch] = useState('');
  const [copies, setCopies] = useState<Record<string, number>>(() => {
    const ids = (params.get('ids') || '').split(',').filter(Boolean);
    return Object.fromEntries(ids.map(id => [id, 1]));
  });
  const sheetRef = useRef<HTMLDivElement>(null);
  const { scan, setPageHandler } = useScanner();

  const addByCode = (code: string) => {
    const p = findProductByCode(products, code);
    if (!p) { toast.error(`No product for ${code}`); return; }
    setCopies(c => ({ ...c, [p.id]: (c[p.id] || 0) + 1 }));
    toast.success(`${p.brand} ${p.article} added`);
  };
  useEffect(() => { setPageHandler(addByCode); return () => setPageHandler(null); });

  const list = useMemo(() => products.filter(p => {
    const q = search.toLowerCase();
    return p.active && (!q || `${p.brand} ${p.article} ${p.sku} ${p.barcode || ''}`.toLowerCase().includes(q));
  }), [products, search]);

  const selected = products.filter(p => copies[p.id] > 0);
  const labels = selected.flatMap(p => Array.from({ length: copies[p.id] }, () => p));
  const size = LABEL_SIZES[cfg.size];

  const printLabels = async () => {
    if (!sheetRef.current || labels.length === 0) return;
    const body = sheetRef.current.innerHTML;
    const css = size.sheet
      ? `@page { size: ${size.sheet.pageW}mm ${size.sheet.pageH}mm; margin: ${size.sheet.marginY}mm ${size.sheet.marginX}mm; }
         .dt-sheet { display: grid; grid-template-columns: repeat(${size.sheet.cols}, ${size.w}mm); grid-auto-rows: ${size.h}mm; justify-content: center; }
         .dt-label { border: none !important; page-break-inside: avoid; }`
      : `@page { size: ${size.w}mm ${size.h}mm; margin: 0; }
         .dt-sheet { display: block; } .dt-label { border: none !important; page-break-after: always; break-after: page; }`;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>* { box-sizing: border-box; margin: 0; } body { background: #fff; } ${css}</style></head><body>${body}</body></html>`;
    const r = await printHtml(html, { paper: size.sheet ? 'A4' : '80mm', jobName: 'Labels' });
    if (!r.ok && r.error) toast.error(`Print failed: ${r.error}`);
  };

  const exportPng = async () => {
    if (!sheetRef.current || labels.length === 0) return;
    const canvas = await html2canvas(sheetRef.current, { backgroundColor: '#fff', scale: 3 });
    canvas.toBlob(async b => { if (b) { const r = await saveFile(b, `labels-${Date.now()}.png`, 'image/png'); if (r.ok) toast.success(`Saved: ${r.location}`); } }, 'image/png');
  };

  const shareCode = async (p: Product, how: 'share' | 'whatsapp' | 'save', fmt: BarcodeFormat) => {
    const png = dataUrlToBytes(await codeToPng(labelCode(p, fmt), fmt, `${p.brand} ${p.article} – ${settings.currency} ${p.salePrice.toLocaleString()}`));
    const name = `${p.sku}-${fmt === 'QR' ? 'qr' : 'barcode'}.png`;
    const r = how === 'save' ? await saveFile(png, name, 'image/png') : how === 'whatsapp' ? await shareToWhatsApp(png, name, 'image/png', { text: `${p.brand} ${p.article}` }) : await shareFile(png, name, 'image/png');
    toast.message('message' in r ? r.message : r.ok ? `Saved: ${r.location}` : 'Not saved');
  };

  return (
    <div className="p-4 md:p-6 space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Barcode className="w-6 h-6" /> Barcode & QR Labels</h1>
          <p className="text-sm text-muted-foreground">{labels.length} labels · {LABEL_SIZES[cfg.size].name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => { updateSettings({ labelDefaults: cfg }); toast.success('Saved as default'); }}><Save className="w-4 h-4 me-2" />Save default</Button>
          <Button variant="outline" onClick={exportPng} disabled={!labels.length}><ImageDown className="w-4 h-4 me-2" />PNG</Button>
          <Button onClick={printLabels} disabled={!labels.length}><Printer className="w-4 h-4 me-2" />Print {labels.length}</Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[360px_1fr] gap-4">
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border p-4 space-y-3">
            <h3 className="font-semibold text-sm">Label settings</h3>
            <div>
              <Label>Label size</Label>
              <Select value={cfg.size} onValueChange={v => setCfg({ ...cfg, size: v as LabelSize })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(LABEL_SIZES).map(([k, v]) => <SelectItem key={k} value={k}>{v.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Code type</Label>
              <Select value={cfg.codeType} onValueChange={v => setCfg({ ...cfg, codeType: v as BarcodeFormat })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CODE128">Barcode – Code 128 (SKU)</SelectItem>
                  <SelectItem value="EAN13">Barcode – EAN-13</SelectItem>
                  <SelectItem value="EAN8">Barcode – EAN-8</SelectItem>
                  <SelectItem value="QR">QR Code</SelectItem>
                </SelectContent>
              </Select>
              {(cfg.codeType === 'EAN13' || cfg.codeType === 'EAN8') && <p className="text-[11px] text-muted-foreground mt-1">Products without a valid EAN fall back to Code 128 of their SKU. Generate EAN codes from the product form.</p>}
            </div>
            {([['showStore', 'Shop name'], ['showName', 'Product name'], ['showPrice', 'Price'], ['showSku', 'SKU'], ['showCodeText', 'Code digits']] as const).map(([k, l]) => (
              <div key={k} className="flex items-center justify-between"><Label>{l}</Label><Switch checked={cfg[k]} onCheckedChange={v => setCfg({ ...cfg, [k]: v })} /></div>
            ))}
          </div>

          <div className="bg-card rounded-xl border border-border p-4 space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input className="ps-9" placeholder="Find products…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Button variant="outline" size="icon" onClick={() => scan(addByCode)} title="Scan"><ScanLine className="w-4 h-4" /></Button>
            </div>
            <div className="max-h-[420px] overflow-auto divide-y divide-border">
              {list.map(p => (
                <div key={p.id} className="flex items-center gap-2 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.brand} {p.article}</p>
                    <p className="text-[11px] font-mono text-muted-foreground truncate">{p.sku}{p.barcode ? ` · ${p.barcode}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-1 dense-touch">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setCopies(c => ({ ...c, [p.id]: Math.max(0, (c[p.id] || 0) - 1) }))}><Minus className="w-3 h-3" /></Button>
                    <Input className="h-7 w-12 text-center px-1" type="number" min={0} value={copies[p.id] || 0} onChange={e => setCopies(c => ({ ...c, [p.id]: Math.max(0, Math.min(500, parseInt(e.target.value) || 0)) }))} />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setCopies(c => ({ ...c, [p.id]: (c[p.id] || 0) + 1 }))}><Plus className="w-3 h-3" /></Button>
                  </div>
                </div>
              ))}
              {list.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">No products</p>}
            </div>
          </div>
        </div>

        <div className="space-y-4 min-w-0">
          <div className="bg-muted/40 rounded-xl border border-border p-4 overflow-auto">
            {labels.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-16">Choose products and copies to preview labels. Scanning a product adds one label.</p>
            ) : (
              <div ref={sheetRef}>
                <div className="dt-sheet" style={{ display: 'grid', gridTemplateColumns: `repeat(${size.sheet ? size.sheet.cols : Math.max(1, Math.floor(600 / (size.w * MM)))}, ${size.w}mm)`, gap: size.sheet ? 0 : '2mm' }}>
                  {labels.map((p, i) => <LabelView key={`${p.id}-${i}`} p={p} cfg={cfg} store={settings.storeName} currency={settings.currency} />)}
                </div>
              </div>
            )}
          </div>
          {selected.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-4">
              <h3 className="font-semibold text-sm mb-2">Share a product code as image</h3>
              <div className="divide-y divide-border">
                {selected.map(p => (
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="text-sm">{p.brand} {p.article}</span>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => shareCode(p, 'save', cfg.codeType)}><ImageDown className="w-3.5 h-3.5 me-1" />PNG</Button>
                      <Button size="sm" variant="outline" onClick={() => shareCode(p, 'share', cfg.codeType)}><Share2 className="w-3.5 h-3.5 me-1" />Share</Button>
                      <Button size="sm" variant="outline" className="text-green-700" onClick={() => shareCode(p, 'whatsapp', cfg.codeType)}>WhatsApp</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
