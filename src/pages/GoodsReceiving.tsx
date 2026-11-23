import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { isMeterProduct } from '@/core/inventory';
import { useStore } from '@/store/useStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Truck, Plus, FileText } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { exportReceivingReportPDF } from '@/lib/pdfExport';

export default function GoodsReceiving() {
  const { products, goodsReceivings, receiveGoods, settings } = useStore();
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [color, setColor] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [params] = useSearchParams();
  useEffect(() => { const id = params.get('product'); if (id) setProductId(id); }, [params]);

  const selectedProduct = products.find(p => p.id === productId);

  const handleReceive = () => {
    if (!productId || !quantity) return;
    receiveGoods({
      productId,
      productName: selectedProduct?.article || '',
      brand: selectedProduct?.brand || '',
      quantityAdded: parseFloat(quantity),
      stockMode: selectedProduct?.stockMode || 'piece',
      colorAdded: color || undefined,
      costPrice: parseFloat(costPrice) || undefined,
      supplier: supplier || undefined,
      notes: notes || undefined,
      rollNo: selectedProduct && isMeterProduct(selectedProduct) && rollNo.trim() ? rollNo.trim() : undefined,
    });
    toast.success(`Received ${quantity}${selectedProduct && isMeterProduct(selectedProduct) ? ' m' : ' pcs'}${rollNo ? ` as thaan ${rollNo}` : ''}`);
    setRollNo('');
    setQuantity(''); setColor(''); setCostPrice(''); setSupplier(''); setNotes('');
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Truck className="w-6 h-6" /> Goods Receiving</h1>
          <p className="text-sm text-muted-foreground">Add stock to existing products</p>
        </div>
        <Button variant="outline" onClick={() => exportReceivingReportPDF(goodsReceivings, settings)}>
          <FileText className="w-4 h-4 mr-2" /> PDF Report
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-border p-5 max-w-2xl">
        <h3 className="font-semibold mb-4">Receive Stock</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Product</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
              <SelectContent>
                {products.filter(p => p.active).map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.brand} — {p.article} ({p.sku})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Quantity ({selectedProduct?.stockMode.includes('meter') ? 'meters' : 'pieces'})</Label>
            <Input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} />
          </div>
          {selectedProduct && isMeterProduct(selectedProduct) && (
            <div>
              <Label>Thaan / roll no. (optional)</Label>
              <Input value={rollNo} onChange={e => setRollNo(e.target.value)} placeholder="e.g. TH-0042 – tracked as its own roll" />
            </div>
          )}
          {selectedProduct && (selectedProduct.stockMode === 'color_piece' || selectedProduct.stockMode === 'color_meter') && (
            <div>
              <Label>Color</Label>
              <Select value={color} onValueChange={setColor}>
                <SelectTrigger><SelectValue placeholder="Select or type" /></SelectTrigger>
                <SelectContent>
                  {selectedProduct.colorStocks.map(cs => (
                    <SelectItem key={cs.color} value={cs.color}>{cs.color} (current: {cs.quantity})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div><Label>{selectedProduct && isMeterProduct(selectedProduct) ? 'Cost per meter' : 'Cost price'} (optional)</Label><Input type="number" value={costPrice} onChange={e => setCostPrice(e.target.value)} /></div>
          <div><Label>Supplier (optional)</Label><Input value={supplier} onChange={e => setSupplier(e.target.value)} /></div>
          <div className="col-span-2"><Label>Notes (optional)</Label><Input value={notes} onChange={e => setNotes(e.target.value)} /></div>
        </div>
        <Button onClick={handleReceive} disabled={!productId || !quantity} className="mt-4">
          <Plus className="w-4 h-4 mr-2" /> Receive Stock
        </Button>
      </div>

      {/* History */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border"><h3 className="font-semibold">Receiving History</h3></div>
        <div className="overflow-auto max-h-96">
          <table className="w-full text-sm">
            <thead className="bg-muted"><tr>
              <th className="text-left p-3 font-medium">Date</th>
              <th className="text-left p-3 font-medium">Product</th>
              <th className="text-left p-3 font-medium">Color</th>
              <th className="text-right p-3 font-medium">Qty Added</th>
              <th className="text-left p-3 font-medium">Supplier</th>
            </tr></thead>
            <tbody>
              {goodsReceivings.slice().reverse().map(gr => (
                <tr key={gr.id} className="border-t border-border">
                  <td className="p-3 text-xs">{format(parseISO(gr.createdAt), 'dd MMM yyyy, hh:mm a')}</td>
                  <td className="p-3">{gr.brand} — {gr.productName}</td>
                  <td className="p-3">{gr.colorAdded || '-'}</td>
                  <td className="p-3 text-right font-mono">{gr.quantityAdded}{gr.stockMode.includes('meter') ? 'm' : 'pc'}</td>
                  <td className="p-3">{gr.supplier || '-'}</td>
                </tr>
              ))}
              {goodsReceivings.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No receiving entries yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
