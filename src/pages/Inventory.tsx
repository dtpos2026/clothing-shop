import { useState, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { Search, Plus, Edit2, Trash2, Eye, FileText, QrCode } from 'lucide-react';
import { StickerPrint } from '@/components/inventory/StickerPrint';
import { exportInventoryPDF } from '@/lib/pdfExport';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import type { Product, Category, ProductType, Season, FabricCategory, StockMode, ColorStock } from '@/types';

const defaultProduct: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> = {
  brand: '', article: '', sku: '', category: 'Gents', productType: 'Fabric Suit',
  season: 'Summer', fabricCategory: 'Wash & Wear', salePrice: 0, costPrice: 0,
  active: true, stockMode: 'piece', stockQty: 0, colorStocks: [],
  suitCutMeters: 4, lowStockThreshold: 10, description: '',
};

export default function Inventory() {
  const { products, addProduct, updateProduct, deleteProduct, settings } = useStore();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultProduct);
  const [colorInput, setColorInput] = useState('');
  const [colorQtyInput, setColorQtyInput] = useState('');
  const [showDetail, setShowDetail] = useState<Product | null>(null);
  const [stickerProduct, setStickerProduct] = useState<Product | null>(null);

  const filtered = useMemo(() => {
    return products.filter(p => {
      const q = search.toLowerCase();
      const match = !q || p.article.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      const matchCat = catFilter === 'all' || p.category === catFilter;
      return match && matchCat;
    });
  }, [products, search, catFilter]);

  const openAdd = () => { setForm(defaultProduct); setEditId(null); setShowForm(true); };
  const openEdit = (p: Product) => {
    setForm({ ...p }); setEditId(p.id); setShowForm(true);
  };

  const handleSave = () => {
    if (editId) {
      updateProduct(editId, form);
    } else {
      addProduct(form);
    }
    setShowForm(false);
  };

  const addColor = () => {
    if (!colorInput.trim()) return;
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

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-sm text-muted-foreground">{products.length} products</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportInventoryPDF(products, settings)}><FileText className="w-4 h-4 mr-2" /> PDF Export</Button>
          <Button onClick={openAdd}><Plus className="w-4 h-4 mr-2" /> Add Product</Button>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="Ladies">Ladies</SelectItem>
            <SelectItem value="Gents">Gents</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-220px)]">
          <table className="w-full text-sm">
            <thead className="bg-muted sticky top-0">
              <tr>
                <th className="text-left p-3 font-medium">Brand / Article</th>
                <th className="text-left p-3 font-medium">SKU</th>
                <th className="text-left p-3 font-medium">Category</th>
                <th className="text-left p-3 font-medium">Fabric</th>
                <th className="text-left p-3 font-medium">Stock Mode</th>
                <th className="text-right p-3 font-medium">Stock</th>
                <th className="text-right p-3 font-medium">Sale Price</th>
                <th className="text-center p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-t border-border hover:bg-muted/30">
                  <td className="p-3">
                    <p className="font-medium">{p.brand}</p>
                    <p className="text-xs text-muted-foreground">{p.article}</p>
                  </td>
                  <td className="p-3 font-mono text-xs">{p.sku}</td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${p.category === 'Ladies' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'}`}>
                      {p.category}
                    </span>
                  </td>
                  <td className="p-3 text-xs">{p.fabricCategory}</td>
                  <td className="p-3 text-xs">{p.stockMode}</td>
                  <td className={`p-3 text-right font-mono ${p.stockQty <= p.lowStockThreshold ? 'text-destructive font-semibold' : ''}`}>
                    {p.stockQty}{p.stockMode.includes('meter') ? 'm' : 'pc'}
                  </td>
                  <td className="p-3 text-right">{settings.currency} {p.salePrice.toLocaleString()}</td>
                  <td className="p-3 text-center">
                    <div className="flex justify-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setShowDetail(p)}><Eye className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(p)}><Edit2 className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => setStickerProduct(p)}><QrCode className="w-3.5 h-3.5 text-primary" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => { if (confirm('Delete this product?')) deleteProduct(p.id); }}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-auto">
          <DialogHeader><DialogTitle>{editId ? 'Edit Product' : 'Add Product'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Brand</Label><Input value={form.brand} onChange={e => setForm({...form, brand: e.target.value})} /></div>
            <div><Label>Article</Label><Input value={form.article} onChange={e => setForm({...form, article: e.target.value})} /></div>
            <div><Label>SKU</Label><Input value={form.sku} onChange={e => setForm({...form, sku: e.target.value})} /></div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => setForm({...form, category: v as Category})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Ladies">Ladies</SelectItem><SelectItem value="Gents">Gents</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label>Product Type</Label>
              <Select value={form.productType} onValueChange={v => setForm({...form, productType: v as ProductType})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Ready Suit">Ready Suit</SelectItem><SelectItem value="Fabric Suit">Fabric Suit</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label>Season</Label>
              <Select value={form.season} onValueChange={v => setForm({...form, season: v as Season})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Summer">Summer</SelectItem><SelectItem value="Winter">Winter</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fabric Category</Label>
              <Select value={form.fabricCategory} onValueChange={v => setForm({...form, fabricCategory: v as FabricCategory})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Cotton','Wash & Wear','Lawn','Reshmi','Karandi','Boski','Other'].map(f => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Stock Mode</Label>
              <Select value={form.stockMode} onValueChange={v => setForm({...form, stockMode: v as StockMode})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="piece">Single/Bulk Piece</SelectItem>
                  <SelectItem value="meter">Meter-based</SelectItem>
                  <SelectItem value="color_piece">Color-wise Piece</SelectItem>
                  <SelectItem value="color_meter">Color-wise Meter</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Sale Price</Label><Input type="number" value={form.salePrice || ''} onChange={e => setForm({...form, salePrice: parseFloat(e.target.value) || 0})} /></div>
            <div><Label>Cost Price</Label><Input type="number" value={form.costPrice || ''} onChange={e => setForm({...form, costPrice: parseFloat(e.target.value) || 0})} /></div>
            {(form.stockMode === 'piece' || form.stockMode === 'meter') && (
              <div><Label>Stock Qty ({form.stockMode === 'meter' ? 'meters' : 'pieces'})</Label><Input type="number" value={form.stockQty || ''} onChange={e => setForm({...form, stockQty: parseFloat(e.target.value) || 0})} /></div>
            )}
            {form.stockMode.includes('meter') && (
              <div><Label>Suit Cut (meters/suit)</Label><Input type="number" step="0.5" value={form.suitCutMeters || ''} onChange={e => setForm({...form, suitCutMeters: parseFloat(e.target.value) || 0})} /></div>
            )}
            <div><Label>Low Stock Threshold</Label><Input type="number" value={form.lowStockThreshold || ''} onChange={e => setForm({...form, lowStockThreshold: parseFloat(e.target.value) || 0})} /></div>
            <div><Label>Description</Label><Input value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} /></div>
          </div>

          {/* Color stocks */}
          {(form.stockMode === 'color_piece' || form.stockMode === 'color_meter') && (
            <div className="mt-4">
              <Label className="mb-2 block">Color Stocks</Label>
              <div className="flex gap-2 mb-2">
                <Input placeholder="Color name" value={colorInput} onChange={e => setColorInput(e.target.value)} className="flex-1" />
                <Input type="number" placeholder="Qty" value={colorQtyInput} onChange={e => setColorQtyInput(e.target.value)} className="w-24" />
                <Button size="sm" onClick={addColor}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {form.colorStocks.map(cs => (
                  <span key={cs.color} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-muted text-xs">
                    {cs.color}: {cs.quantity} <button onClick={() => removeColor(cs.color)}><Trash2 className="w-3 h-3 text-destructive" /></button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.brand || !form.article}>{editId ? 'Update' : 'Add'} Product</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!showDetail} onOpenChange={() => setShowDetail(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{showDetail?.brand} — {showDetail?.article}</DialogTitle></DialogHeader>
          {showDetail && (
            <div className="space-y-2 text-sm">
              <p><strong>SKU:</strong> {showDetail.sku}</p>
              <p><strong>Category:</strong> {showDetail.category} · {showDetail.productType}</p>
              <p><strong>Season:</strong> {showDetail.season} · {showDetail.fabricCategory}</p>
              <p><strong>Stock Mode:</strong> {showDetail.stockMode}</p>
              <p><strong>Total Stock:</strong> {showDetail.stockQty}{showDetail.stockMode.includes('meter') ? ' meters' : ' pieces'}</p>
              {showDetail.suitCutMeters > 0 && <p><strong>Suit Cut:</strong> {showDetail.suitCutMeters}m per suit</p>}
              <p><strong>Sale Price:</strong> {settings.currency} {showDetail.salePrice.toLocaleString()}</p>
              <p><strong>Cost Price:</strong> {settings.currency} {showDetail.costPrice.toLocaleString()}</p>
              {showDetail.colorStocks.length > 0 && (
                <div>
                  <strong>Color-wise Stock:</strong>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {showDetail.colorStocks.map(cs => (
                      <span key={cs.color} className="px-2 py-1 bg-muted rounded text-xs">
                        {cs.color}: {cs.quantity}{showDetail.stockMode.includes('meter') ? 'm' : 'pc'}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Sticker Print */}
      {stickerProduct && (
        <StickerPrint product={stickerProduct} settings={settings} open={!!stickerProduct} onClose={() => setStickerProduct(null)} />
      )}
    </div>
  );
}
