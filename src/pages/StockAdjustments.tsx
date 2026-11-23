import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { PackageMinus } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { activeRolls, baseUnit, costPerBaseUnit, isColorProduct, round2, unitLabel } from '@/core/inventory';
import type { AdjustmentType } from '@/types';

const TYPES: { id: AdjustmentType; label: string; sign: 1 | -1 }[] = [
  { id: 'damaged', label: 'Damaged / defective', sign: -1 },
  { id: 'lost', label: 'Lost / theft', sign: -1 },
  { id: 'return_to_supplier', label: 'Returned to supplier', sign: -1 },
  { id: 'correction_remove', label: 'Count correction (−)', sign: -1 },
  { id: 'correction_add', label: 'Count correction (+)', sign: 1 },
];

export default function StockAdjustments() {
  const { products, stockAdjustments, addStockAdjustment, settings } = useStore();
  const [productId, setProductId] = useState('');
  const [type, setType] = useState<AdjustmentType>('damaged');
  const [color, setColor] = useState('');
  const [rollId, setRollId] = useState('');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const p = products.find(x => x.id === productId);
  const rolls = p ? activeRolls(p, color || undefined) : [];
  const list = useMemo(() => [...stockAdjustments].reverse(), [stockAdjustments]);
  const lossTotal = round2(stockAdjustments.filter(a => a.type !== 'correction_add').reduce((s, a) => s + a.costValue, 0));

  const submit = () => {
    const q = parseFloat(qty) || 0;
    if (!p || q <= 0 || !reason.trim()) { toast.error('Choose product, quantity and reason'); return; }
    const r = addStockAdjustment({ productId: p.id, type, quantity: q, reason: reason.trim(), color: color || undefined, rollId: rollId || undefined });
    if (r) { toast.success(`Adjusted ${r.productName}: ${type === 'correction_add' ? '+' : '−'}${q} ${unitLabel(baseUnit(p))}`); setQty(''); setReason(''); }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><PackageMinus className="w-6 h-6" /> Stock Adjustments & Damaged Stock</h1>
        <p className="text-sm text-muted-foreground">Every adjustment is logged with its cost value; damage and losses appear in Profit & Loss. Total losses: <b>{settings.currency} {lossTotal.toLocaleString()}</b></p>
      </div>
      <div className="bg-card rounded-xl border border-border p-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-4xl">
        <div className="sm:col-span-2 lg:col-span-1"><Label>Product</Label>
          <Select value={productId} onValueChange={v => { setProductId(v); setColor(''); setRollId(''); }}><SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
            <SelectContent>{products.map(x => <SelectItem key={x.id} value={x.id}>{x.brand} — {x.article} ({x.stockQty}{unitLabel(baseUnit(x))})</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Type</Label>
          <Select value={type} onValueChange={v => setType(v as AdjustmentType)}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TYPES.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent></Select></div>
        {p && isColorProduct(p) && <div><Label>Colour</Label>
          <Select value={color} onValueChange={setColor}><SelectTrigger><SelectValue placeholder="Colour" /></SelectTrigger>
            <SelectContent>{p.colorStocks.map(c => <SelectItem key={c.color} value={c.color}>{c.color} ({c.quantity})</SelectItem>)}</SelectContent></Select></div>}
        {rolls.length > 0 && <div><Label>Thaan</Label>
          <select className="w-full h-10 rounded-md border border-input bg-background px-2 text-sm" value={rollId} onChange={e => setRollId(e.target.value)}>
            <option value="">Oldest first</option>{rolls.map(r => <option key={r.id} value={r.id}>{r.rollNo} – {r.remainingMeters} m</option>)}</select></div>}
        <div><Label>Quantity ({p ? unitLabel(baseUnit(p)) : 'units'})</Label><Input type="number" inputMode="decimal" value={qty} onChange={e => setQty(e.target.value)} /></div>
        <div className="sm:col-span-2"><Label>Reason</Label><Input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. water damage, stain, miscount" /></div>
        <div className="flex items-end"><Button className="w-full" onClick={submit}>Save adjustment</Button></div>
        {p && parseFloat(qty) > 0 && <p className="sm:col-span-3 text-xs text-muted-foreground">Estimated cost value: {settings.currency} {round2((parseFloat(qty) || 0) * costPerBaseUnit(p, color || undefined)).toLocaleString()}</p>}
      </div>
      <div className="bg-card rounded-xl border border-border overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted"><tr><th className="p-3 text-start">Date</th><th className="p-3 text-start">Product</th><th className="p-3 text-start">Type</th><th className="p-3 text-end">Qty</th><th className="p-3 text-end">Cost value</th><th className="p-3 text-start">Reason</th><th className="p-3 text-start">By</th></tr></thead>
          <tbody>
            {list.map(a => (
              <tr key={a.id} className="border-t border-border">
                <td className="p-3 text-xs">{format(parseISO(a.createdAt), 'dd MMM yyyy HH:mm')}</td>
                <td className="p-3">{a.productName}{a.color ? ` (${a.color})` : ''}</td>
                <td className="p-3 text-xs">{TYPES.find(t => t.id === a.type)?.label}</td>
                <td className={`p-3 text-end font-mono ${a.type === 'correction_add' ? 'text-success' : 'text-destructive'}`}>{a.type === 'correction_add' ? '+' : '−'}{a.quantity}</td>
                <td className="p-3 text-end font-mono">{a.costValue.toLocaleString()}</td>
                <td className="p-3 text-xs">{a.reason}</td><td className="p-3 text-xs">{a.userName}</td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No adjustments yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
