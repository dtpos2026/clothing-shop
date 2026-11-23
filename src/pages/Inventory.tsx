import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Search, Plus, Edit2, Trash2, Eye, FileText, QrCode, Camera, ImagePlus, Wand2, ScanLine, Layers, X, Barcode as BarcodeIcon } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { StickerPrint } from '@/components/inventory/StickerPrint';
import { exportInventoryPDF } from '@/lib/pdfExport';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { CodeImage } from '@/components/barcode/CodeImage';
import { ExportButtons } from '@/components/share/ExportButtons';
import { buildDataset } from '@/lib/datasets';
import { useScanner } from '@/components/scan/ScanProvider';
import { captureImage } from '@/platform/images';
import { generateCode, validateCode, findProductByCode } from '@/core/barcode';
import { categoriesOf, fabricsOf, productTypesOf, DEFAULT_SEASONS } from '@/core/defaults';
import { activeRolls, costPerBaseUnit, inventoryValuation, isMeterProduct, isColorProduct, stockStatus, unitPriceFor, round2 } from '@/core/inventory';
import type { Product, StockMode, ColorStock, BarcodeFormat } from '@/types';
import { cn } from '@/lib/utils';

const defaultProduct: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> = {
  brand: '', article: '', sku: '', category: 'Gents', productType: 'Fabric Suit',
  season: 'Summer', fabricCategory: 'Wash & Wear', salePrice: 0, costPrice: 0,
  active: true, stockMode: 'piece', stockQty: 0, colorStocks: [],
  suitCutMeters: 4, lowStockThreshold: 10, description: '',
};

export default function Inventory() {
  const { products, addProduct, updateProduct, deleteProduct, settings, updateRoll, addStockAdjustment } = useStore();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { scan } = useScanner();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultProduct);
  const [colorInput, setColorInput] = useState('');
  const [colorQtyInput, setColorQtyInput] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [stickerProduct, setStickerProduct] = useState<Product | null>(null);
  const showDetail = products.find(p => p.id === detailId) || null;
  const cats = categoriesOf(settings);
  const valuation = useMemo(() => inventoryValuation(products), [products]);

  // deep link from scanner: /inventory?product=<id>
  useEffect(() => {
    const id = params.get('product');
    if (id) { setDetailId(id); params.delete('product'); setParams(params, { replace: true }); }
  }, [params, setParams]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter(p => {
      const match = !q || `${p.article} ${p.brand} ${p.sku} ${p.barcode || ''} ${p.design || ''}`.toLowerCase().includes(q);
      const matchCat = catFilter === 'all' || p.category === catFilter;
      const st = stockStatus(p);
      const matchStock = stockFilter === 'all' || (stockFilter === 'out' ? st === 'out' : st !== 'ok');
      return match && matchCat && matchStock;
    });
  }, [products, search, catFilter, stockFilter]);

  const openAdd = () => {
    const fmt = settings.defaultBarcodeFormat || 'CODE128';
    setForm({ ...defaultProduct, barcodeFormat: fmt });
    setEditId(null); setShowForm(true);
  };
  const openEdit = (p: Product) => { setForm({ ...p }); setEditId(p.id); setShowForm(true); };

  const codeFormat: BarcodeFormat = form.barcodeFormat || 'CODE128';
  const codeCheck = form.barcode ? validateCode(form.barcode, codeFormat === 'QR' ? 'CODE128' : codeFormat, products, editId || undefined) : { ok: true };
  const skuDup = form.sku && products.some(p => p.id !== editId && (p.sku.toUpperCase() === form.sku.toUpperCase() || (p.barcode || '').toUpperCase() === form.sku.toUpperCase()));

  const handleSave = () => {
    let sku = form.sku.trim();
    if (!sku) sku = generateCode(products, 'CODE128', form.brand, form.article);
    if (skuDup) { toast.error('SKU already used by another product'); return; }
    if (form.barcode && !codeCheck.ok) { toast.error(codeCheck.error); return; }
    const data = { ...form, sku };
    if (editId) updateProduct(editId, data);
    else addProduct(data);
    toast.success(`${data.brand} ${data.article} saved`);
    setShowForm(false);
  };

  const addColor = () => {
    if (!colorInput.trim()) return;
    if (form.colorStocks.some(c => c.color.toLowerCase() === colorInput.trim().toLowerCase())) { toast.error('Colour already added'); return; }
    const qty = parseFloat(colorQtyInput) || 0;
    const cs: ColorStock = { color: colorInput.trim(), quantity: qty };
    const newColors = [...form.colorStocks, cs];
    setForm({ ...form, colorStocks: newColors, stockQty: newColors.reduce((s, c) => s + c.quantity, 0) });
    setColorInput(''); setColorQtyInput('');
  };
  const removeColor = (color: string) => {
    const newColors = form.colorStocks.filter(c => c.color !== color);
    setForm({ ...form, colorStocks: newColors, stockQty: newColors.reduce((s, c) => s + c.quantity, 0) });
  };

  const takePhoto = async (src: 'camera' | 'gallery') => {
    try {
      const img = await captureImage(src);
      if (img) setForm(f => ({ ...f, imageUrl: img }));
    } catch (e) { toast.error(`Camera: ${e instanceof Error ? e.message : String(e)}`); }
  };

  const hasRolls = !!(editId && form.rolls && form.rolls.length > 0);
  const meter = isMeterProduct(form);

  return (
    <div className="p-4 md:p-6 space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-sm text-muted-foreground">{products.length} products · {valuation.units.meters} m + {valuation.units.pieces} pcs · value {settings.currency} {valuation.costValue.toLocaleString()} (cost) / {valuation.retailValue.toLocaleString()} (retail)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => exportInventoryPDF(products, settings)}><FileText className="w-4 h-4 me-2" /> PDF</Button>
          <Button variant="outline" onClick={() => navigate(`/labels?ids=${filtered.map(p => p.id).slice(0, 200).join(',')}`)}><BarcodeIcon className="w-4 h-4 me-2" />Labels</Button>
          <Button onClick={openAdd}><Plus className="w-4 h-4 me-2" /> Add Product</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search name, SKU, barcode, design…" value={search} onChange={e => setSearch(e.target.value)} className="ps-9" />
        </div>
        <Button variant="outline" size="icon" title="Scan to find" onClick={() => scan(code => { const p = findProductByCode(products, code); if (p) setDetailId(p.id); else toast.error(`No product for ${code}`); })}><ScanLine className="w-4 h-4" /></Button>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All categories</SelectItem>{cats.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={stockFilter} onValueChange={v => setStockFilter(v as typeof stockFilter)}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All stock</SelectItem><SelectItem value="low">Low + out</SelectItem><SelectItem value="out">Out of stock</SelectItem></SelectContent>
        </Select>
      </div>
      <ExportButtons spec={() => buildDataset('inventory', useStore.getState().getBusinessData())} />

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-auto max-h-[calc(100dvh-280px)]">
          <table className="w-full text-sm">
            <thead className="bg-muted sticky top-0 z-10">
              <tr>
                <th className="text-start p-3 font-medium">Product</th>
                <th className="text-start p-3 font-medium hidden md:table-cell">SKU / Barcode</th>
                <th className="text-start p-3 font-medium hidden lg:table-cell">Category</th>
                <th className="text-start p-3 font-medium hidden lg:table-cell">Fabric</th>
                <th className="text-end p-3 font-medium">Stock</th>
                <th className="text-end p-3 font-medium">Price</th>
                <th className="text-center p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const st = stockStatus(p);
                const rolls = activeRolls(p).length;
                return (
                  <tr key={p.id} className={cn('border-t border-border hover:bg-muted/30', !p.active && 'opacity-50')}>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-9 h-9 rounded object-cover flex-shrink-0" /> : <div className="w-9 h-9 rounded bg-muted flex-shrink-0" />}
                        <div className="min-w-0"><p className="font-medium truncate">{p.brand}</p><p className="text-xs text-muted-foreground truncate">{p.article}{p.design ? ` · ${p.design}` : ''}</p></div>
                      </div>
                    </td>
                    <td className="p-3 font-mono text-xs hidden md:table-cell">{p.sku}{p.barcode && <div className="text-muted-foreground">{p.barcode}</div>}</td>
                    <td className="p-3 hidden lg:table-cell"><span className={`text-xs px-2 py-0.5 rounded-full ${p.category === 'Ladies' ? 'bg-pink-100 text-pink-700' : p.category === 'Gents' ? 'bg-blue-100 text-blue-700' : 'bg-muted'}`}>{p.category}</span></td>
                    <td className="p-3 text-xs hidden lg:table-cell">{p.fabricCategory}<div className="text-muted-foreground">{p.productType}</div></td>
                    <td className={cn('p-3 text-end font-mono', st === 'out' ? 'text-destructive font-bold' : st === 'low' ? 'text-warning font-semibold' : '')}>
                      {p.stockQty}{isMeterProduct(p) ? 'm' : 'pc'}{rolls > 0 && <div className="text-[10px] text-muted-foreground font-sans">{rolls} thaan</div>}
                    </td>
                    <td className="p-3 text-end">{settings.currency} {p.salePrice.toLocaleString()}{isMeterProduct(p) && <div className="text-[10px] text-muted-foreground">{unitPriceFor(p, 'meter').toLocaleString()}/m</div>}</td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <Button variant="ghost" size="sm" onClick={() => setDetailId(p.id)} aria-label="View"><Eye className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(p)} aria-label="Edit"><Edit2 className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => setStickerProduct(p)} aria-label="Sticker"><QrCode className="w-3.5 h-3.5 text-primary" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => { if (confirm('Delete this product? Sales history keeps its own copy.')) deleteProduct(p.id); }} aria-label="Delete"><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No products</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Form */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-3xl max-h-[94dvh] overflow-auto">
          <DialogHeader><DialogTitle>{editId ? 'Edit Product' : 'Add Product'}</DialogTitle></DialogHeader>
          <div className="grid sm:grid-cols-[140px_1fr] gap-4">
            <div className="space-y-2">
              <div className="w-full aspect-square rounded-xl bg-muted overflow-hidden flex items-center justify-center relative">
                {form.imageUrl ? <><img src={form.imageUrl} alt="" className="w-full h-full object-cover" /><button className="absolute top-1 end-1 bg-black/60 text-white rounded-full p-1" onClick={() => setForm({ ...form, imageUrl: undefined })}><X className="w-3 h-3" /></button></> : <ImagePlus className="w-8 h-8 text-muted-foreground" />}
              </div>
              <div className="grid grid-cols-2 gap-1">
                <Button type="button" size="sm" variant="outline" onClick={() => takePhoto('camera')}><Camera className="w-3.5 h-3.5" /></Button>
                <Button type="button" size="sm" variant="outline" onClick={() => takePhoto('gallery')}><ImagePlus className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Brand</Label><Input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} /></div>
              <div><Label>Article</Label><Input value={form.article} onChange={e => setForm({ ...form, article: e.target.value })} /></div>
              <div><Label>Design / print no.</Label><Input value={form.design || ''} onChange={e => setForm({ ...form, design: e.target.value })} /></div>
              <div><Label>SKU {skuDup && <span className="text-destructive text-xs">duplicate</span>}</Label>
                <div className="flex gap-1"><Input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value.toUpperCase() })} placeholder="auto" className="font-mono" />
                  <Button type="button" size="icon" variant="outline" title="Generate" onClick={() => setForm({ ...form, sku: generateCode(products.filter(p => p.id !== editId), 'CODE128', form.brand, form.article) })}><Wand2 className="w-4 h-4" /></Button></div></div>
              <div><Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{cats.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Product type</Label>
                <Select value={form.productType} onValueChange={v => setForm({ ...form, productType: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{productTypesOf(settings).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Fabric</Label>
                <Select value={form.fabricCategory} onValueChange={v => setForm({ ...form, fabricCategory: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{fabricsOf(settings).map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Season</Label>
                <Select value={form.season} onValueChange={v => setForm({ ...form, season: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DEFAULT_SEASONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
            <div className="col-span-2"><Label>Stock mode</Label>
              <Select value={form.stockMode} onValueChange={v => setForm({ ...form, stockMode: v as StockMode })} disabled={hasRolls}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="piece">Piece-based (ready-made / suit boxes)</SelectItem>
                  <SelectItem value="meter">Meter-based (fabric / thaan)</SelectItem>
                  <SelectItem value="color_piece">Colour-wise pieces</SelectItem>
                  <SelectItem value="color_meter">Colour-wise meters</SelectItem>
                </SelectContent></Select></div>
            {meter && <div><Label>Suit cut (m / suit)</Label><Input type="number" step="0.25" value={form.suitCutMeters || ''} onChange={e => setForm({ ...form, suitCutMeters: parseFloat(e.target.value) || 0 })} /></div>}
            <div><Label>Low stock alert at</Label><Input type="number" value={form.lowStockThreshold || ''} onChange={e => setForm({ ...form, lowStockThreshold: parseFloat(e.target.value) || 0 })} /></div>
            <div><Label>Retail price {meter ? '/ suit' : ''}</Label><Input type="number" value={form.salePrice || ''} onChange={e => setForm({ ...form, salePrice: parseFloat(e.target.value) || 0 })} /></div>
            <div><Label>Wholesale price {meter ? '/ suit' : ''}</Label><Input type="number" value={form.wholesalePrice || ''} onChange={e => setForm({ ...form, wholesalePrice: parseFloat(e.target.value) || undefined })} /></div>
            {meter && <div><Label>Retail / meter</Label><Input type="number" placeholder={form.suitCutMeters ? String(round2(form.salePrice / form.suitCutMeters)) : ''} value={form.pricePerMeter || ''} onChange={e => setForm({ ...form, pricePerMeter: parseFloat(e.target.value) || undefined })} /></div>}
            {meter && <div><Label>Wholesale / meter</Label><Input type="number" value={form.wholesalePricePerMeter || ''} onChange={e => setForm({ ...form, wholesalePricePerMeter: parseFloat(e.target.value) || undefined })} /></div>}
            <div><Label>Cost price {meter ? '/ suit' : ''}</Label><Input type="number" value={form.costPrice || ''} onChange={e => setForm({ ...form, costPrice: parseFloat(e.target.value) || 0 })} /></div>
            {(form.stockMode === 'piece' || form.stockMode === 'meter') && !hasRolls && (
              <div><Label>Stock ({meter ? 'meters' : 'pieces'})</Label><Input type="number" value={form.stockQty || ''} onChange={e => setForm({ ...form, stockQty: parseFloat(e.target.value) || 0 })} /></div>
            )}
          </div>

          {isColorProduct(form) && !hasRolls && (
            <div className="mt-2">
              <Label className="mb-1 block">Colour stocks ({meter ? 'meters' : 'pieces'})</Label>
              <div className="flex gap-2 mb-2">
                <Input placeholder="Colour name" value={colorInput} onChange={e => setColorInput(e.target.value)} className="flex-1" onKeyDown={e => e.key === 'Enter' && addColor()} />
                <Input type="number" placeholder="Qty" value={colorQtyInput} onChange={e => setColorQtyInput(e.target.value)} className="w-24" onKeyDown={e => e.key === 'Enter' && addColor()} />
                <Button size="sm" onClick={addColor}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {form.colorStocks.map(cs => (
                  <span key={cs.color} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-muted text-xs">{cs.color}: {cs.quantity} <button onClick={() => removeColor(cs.color)}><Trash2 className="w-3 h-3 text-destructive" /></button></span>
                ))}
              </div>
            </div>
          )}
          {hasRolls && <p className="text-xs text-muted-foreground mt-1"><Layers className="w-3.5 h-3.5 inline me-1" />Stock is tracked per thaan – use Goods Receiving / Purchases to add thaans and Stock Adjustments for corrections.</p>}

          <div className="rounded-xl border border-border p-3 mt-2 grid sm:grid-cols-[1fr_auto] gap-3 items-center">
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Code type</Label>
                <Select value={codeFormat} onValueChange={v => setForm({ ...form, barcodeFormat: v as BarcodeFormat })}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="CODE128">Code 128</SelectItem><SelectItem value="EAN13">EAN-13</SelectItem><SelectItem value="EAN8">EAN-8</SelectItem><SelectItem value="QR">QR code</SelectItem></SelectContent></Select></div>
              <div><Label>Barcode {form.barcode && !codeCheck.ok && <span className="text-destructive text-xs">{codeCheck.error}</span>}</Label>
                <div className="flex gap-1">
                  <Input value={form.barcode || ''} onChange={e => setForm({ ...form, barcode: e.target.value.trim() || undefined })} placeholder="scan, type or generate" className="font-mono" />
                  <Button type="button" size="icon" variant="outline" title="Scan existing barcode" onClick={() => scan(code => setForm(f => ({ ...f, barcode: code })))}><ScanLine className="w-4 h-4" /></Button>
                  <Button type="button" size="icon" variant="outline" title="Generate unique" onClick={() => setForm({ ...form, barcode: generateCode(products.filter(p => p.id !== editId), codeFormat === 'QR' ? 'EAN13' : codeFormat, form.brand, form.article) })}><Wand2 className="w-4 h-4" /></Button>
                </div></div>
            </div>
            <div className="bg-white rounded p-1 flex justify-center min-w-[140px]">{(form.barcode || form.sku) && <CodeImage value={form.barcode || form.sku} format={codeFormat} height={36} qrSize={64} />}</div>
          </div>
          <div className="mt-2"><Label>Description</Label><Input value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <label className="flex items-center gap-2 text-sm mt-2"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> Active (shown in POS)</label>

          <div className="flex justify-end gap-2 mt-3">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.brand || !form.article}>{editId ? 'Update' : 'Add'} Product</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail */}
      <Dialog open={!!showDetail} onOpenChange={() => setDetailId(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[92dvh] overflow-auto">
          <DialogHeader><DialogTitle>{showDetail?.brand} — {showDetail?.article}</DialogTitle></DialogHeader>
          {showDetail && (
            <div className="space-y-3 text-sm">
              <div className="grid sm:grid-cols-[1fr_auto] gap-4">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <span className="text-muted-foreground">SKU</span><span className="font-mono">{showDetail.sku}</span>
                  {showDetail.barcode && <><span className="text-muted-foreground">Barcode</span><span className="font-mono">{showDetail.barcode}</span></>}
                  <span className="text-muted-foreground">Category</span><span>{showDetail.category} · {showDetail.productType}</span>
                  <span className="text-muted-foreground">Fabric / season</span><span>{showDetail.fabricCategory} · {showDetail.season}</span>
                  <span className="text-muted-foreground">Stock</span><span className="font-bold">{showDetail.stockQty} {isMeterProduct(showDetail) ? 'meters' : 'pieces'}</span>
                  {showDetail.suitCutMeters > 0 && isMeterProduct(showDetail) && <><span className="text-muted-foreground">Suit cut</span><span>{showDetail.suitCutMeters} m · ≈ {Math.floor(showDetail.stockQty / showDetail.suitCutMeters)} suits</span></>}
                  <span className="text-muted-foreground">Retail</span><span>{settings.currency} {showDetail.salePrice.toLocaleString()}{isMeterProduct(showDetail) ? ` / suit · ${unitPriceFor(showDetail, 'meter').toLocaleString()} / m` : ''}</span>
                  {showDetail.wholesalePrice && <><span className="text-muted-foreground">Wholesale</span><span>{settings.currency} {showDetail.wholesalePrice.toLocaleString()}</span></>}
                  <span className="text-muted-foreground">Cost / {isMeterProduct(showDetail) ? 'm' : 'pc'}</span><span>{settings.currency} {costPerBaseUnit(showDetail).toLocaleString()}</span>
                </div>
                <div className="space-y-2">
                  {showDetail.imageUrl && <img src={showDetail.imageUrl} alt="" className="w-36 h-36 object-cover rounded-lg" />}
                  <div className="bg-white rounded p-1"><CodeImage value={showDetail.barcode || showDetail.sku} format={showDetail.barcodeFormat || 'CODE128'} height={34} qrSize={70} /></div>
                </div>
              </div>
              {showDetail.colorStocks.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {showDetail.colorStocks.map(cs => <span key={cs.color} className="px-2 py-1 bg-muted rounded text-xs">{cs.color}: {cs.quantity}{isMeterProduct(showDetail) ? 'm' : 'pc'}</span>)}
                </div>
              )}
              {showDetail.rolls && showDetail.rolls.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-1 flex items-center gap-1"><Layers className="w-4 h-4" />Thaans / rolls</h4>
                  <div className="overflow-auto border rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="bg-muted"><tr><th className="p-2 text-start">Roll</th><th className="p-2 text-start">Colour</th><th className="p-2 text-end">Initial</th><th className="p-2 text-end">Left</th><th className="p-2 text-end">Cost/m</th><th className="p-2 text-start">Received</th><th className="p-2 text-start">Status</th><th className="p-2" /></tr></thead>
                      <tbody>{showDetail.rolls.map(r => (
                        <tr key={r.id} className={cn('border-t', r.status !== 'active' && 'opacity-60')}>
                          <td className="p-2 font-mono">{r.rollNo}</td><td className="p-2">{r.color || '-'}</td>
                          <td className="p-2 text-end">{r.initialMeters}</td><td className="p-2 text-end font-bold">{r.remainingMeters}</td>
                          <td className="p-2 text-end">{r.costPerMeter}</td><td className="p-2">{new Date(r.receivedAt).toLocaleDateString()}{r.supplierName ? ` · ${r.supplierName}` : ''}</td>
                          <td className="p-2 capitalize">{r.status}</td>
                          <td className="p-2 whitespace-nowrap">
                            {r.status === 'active' && r.remainingMeters > 0 && <button className="text-destructive underline" onClick={() => {
                              const reason = prompt(`Mark remaining ${r.remainingMeters} m of ${r.rollNo} as damaged? Enter reason:`);
                              if (reason) { addStockAdjustment({ productId: showDetail.id, rollId: r.id, color: r.color, type: 'damaged', quantity: r.remainingMeters, reason }); updateRoll(showDetail.id, r.id, { status: 'damaged' }); }
                            }}>damaged</button>}
                            {r.status === 'active' && <button className="ms-2 underline" onClick={() => { const n = prompt('Roll number', r.rollNo); if (n) updateRoll(showDetail.id, r.id, { rollNo: n }); }}>rename</button>}
                          </td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button size="sm" onClick={() => { useStore.getState().addToCart(showDetail); navigate('/pos'); }} disabled={isColorProduct(showDetail) || isMeterProduct(showDetail)}>Add to cart</Button>
                <Button size="sm" variant="outline" onClick={() => navigate(`/pos?add=${showDetail.id}`)}>Sell…</Button>
                <Button size="sm" variant="outline" onClick={() => navigate(`/goods-receiving?product=${showDetail.id}`)}>Receive stock</Button>
                <Button size="sm" variant="outline" onClick={() => navigate(`/labels?ids=${showDetail.id}`)}>Print labels</Button>
                <Button size="sm" variant="outline" onClick={() => { const p = showDetail; setDetailId(null); openEdit(p); }}>Edit</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {stickerProduct && <StickerPrint product={stickerProduct} settings={settings} open={!!stickerProduct} onClose={() => setStickerProduct(null)} />}
    </div>
  );
}
