import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { Factory, Plus, Trash2, Wallet, FileText, Edit2 } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExportButtons } from '@/components/share/ExportButtons';
import { supplierStatement } from '@/lib/datasets';
import { supplierLedger } from '@/core/accounting';
import { isMeterProduct, isColorProduct, round2 } from '@/core/inventory';
import { PAYMENT_METHODS } from '@/core/defaults';
import type { PaymentMethod, PurchaseItem, Supplier } from '@/types';

type Line = PurchaseItem & { key: number };

export default function Purchases() {
  const { suppliers, purchases, products, settings, addSupplier, updateSupplier, deleteSupplier, addPurchase, addSupplierPayment } = useStore();
  const data = useStore.getState().getBusinessData();
  const cur = settings.currency;

  const payable = (s: Supplier) => { const l = supplierLedger(s, data); return l.length ? l[l.length - 1].balance : 0; };

  // ---- supplier form
  const [supForm, setSupForm] = useState<Partial<Supplier> | null>(null);
  // ---- purchase form
  const [showPurchase, setShowPurchase] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paid, setPaid] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>('Cash');
  const [notes, setNotes] = useState('');
  // ---- payment / statement
  const [paySup, setPaySup] = useState<Supplier | null>(null);
  const [payAmt, setPayAmt] = useState(0);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('Cash');
  const [payNote, setPayNote] = useState('');
  const [stmt, setStmt] = useState<Supplier | null>(null);

  const subtotal = round2(lines.reduce((a, l) => a + l.quantity * l.costPrice, 0));
  const total = round2(subtotal - discount);

  const addLine = (productId: string) => {
    const p = products.find(x => x.id === productId);
    if (!p) return;
    const meter = isMeterProduct(p);
    setLines(ls => [...ls, {
      key: Date.now() + Math.random(), productId, productName: `${p.brand} ${p.article}`, quantity: meter ? 50 : 1, unit: meter ? 'meter' : 'piece',
      costPrice: meter && p.suitCutMeters ? round2(p.costPrice / p.suitCutMeters) : p.costPrice, lineTotal: 0, color: isColorProduct(p) ? p.colorStocks[0]?.color : undefined,
    }]);
  };

  const savePurchase = () => {
    const sup = suppliers.find(s => s.id === supplierId);
    if (!sup) { toast.error('Choose a supplier'); return; }
    if (!lines.length || lines.some(l => l.quantity <= 0)) { toast.error('Add items with quantity'); return; }
    const p = addPurchase({ supplierId: sup.id, supplierName: sup.name, items: lines.map(({ key: _k, ...l }) => l), discount, paid, paymentMethod: method, notes });
    toast.success(`${p.purchaseNumber} saved – stock updated${p.due > 0 ? `, ${cur} ${p.due.toLocaleString()} payable` : ''}`);
    setShowPurchase(false); setLines([]); setDiscount(0); setPaid(0); setNotes('');
  };

  const sortedPurchases = useMemo(() => [...purchases].reverse(), [purchases]);

  return (
    <div className="p-4 md:p-6 space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Factory className="w-6 h-6" /> Purchases & Suppliers</h1>
          <p className="text-sm text-muted-foreground">Each meter line becomes its own Thaan with its own cost.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setSupForm({ name: '', phone: '', openingBalance: 0 })}><Plus className="w-4 h-4 me-2" />Supplier</Button>
          <Button onClick={() => { if (!suppliers.length) { toast.error('Add a supplier first'); return; } setSupplierId(suppliers[0].id); setShowPurchase(true); }}><Plus className="w-4 h-4 me-2" />New purchase</Button>
        </div>
      </div>

      <Tabs defaultValue="suppliers">
        <TabsList><TabsTrigger value="suppliers">Suppliers ({suppliers.length})</TabsTrigger><TabsTrigger value="purchases">Purchases ({purchases.length})</TabsTrigger></TabsList>
        <TabsContent value="suppliers" className="mt-3">
          <div className="bg-card rounded-xl border border-border overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted"><tr><th className="p-3 text-start">Supplier</th><th className="p-3 text-start">Phone</th><th className="p-3 text-end">Payable</th><th className="p-3 text-center">Actions</th></tr></thead>
              <tbody>
                {suppliers.map(s => {
                  const due = payable(s);
                  return (
                    <tr key={s.id} className="border-t border-border">
                      <td className="p-3"><p className="font-medium">{s.name}</p>{s.company && <p className="text-xs text-muted-foreground">{s.company}</p>}</td>
                      <td className="p-3">{s.phone}</td>
                      <td className={`p-3 text-end font-mono ${due > 0 ? 'text-destructive font-semibold' : ''}`}>{cur} {due.toLocaleString()}</td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <Button size="sm" variant="ghost" onClick={() => { setPaySup(s); setPayAmt(Math.max(0, due)); }}><Wallet className="w-3.5 h-3.5 me-1" />Pay</Button>
                        <Button size="sm" variant="ghost" onClick={() => setStmt(s)}><FileText className="w-3.5 h-3.5 me-1" />Statement</Button>
                        <Button size="sm" variant="ghost" onClick={() => setSupForm(s)}><Edit2 className="w-3.5 h-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => { if (confirm('Delete supplier?') && !deleteSupplier(s.id)) toast.error('Supplier has purchases/payments – kept for history'); }}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                      </td>
                    </tr>
                  );
                })}
                {suppliers.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No suppliers yet</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="purchases" className="mt-3">
          <div className="bg-card rounded-xl border border-border overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted"><tr><th className="p-3 text-start">No.</th><th className="p-3 text-start">Date</th><th className="p-3 text-start">Supplier</th><th className="p-3 text-start">Items</th><th className="p-3 text-end">Total</th><th className="p-3 text-end">Due</th></tr></thead>
              <tbody>
                {sortedPurchases.map(p => (
                  <tr key={p.id} className="border-t border-border align-top">
                    <td className="p-3 font-mono text-xs">{p.purchaseNumber}</td>
                    <td className="p-3 text-xs">{format(parseISO(p.createdAt), 'dd MMM yyyy')}</td>
                    <td className="p-3">{p.supplierName}</td>
                    <td className="p-3 text-xs">{p.items.map((i, k) => <div key={k}>{i.productName}{i.color ? ` (${i.color})` : ''} · {i.quantity}{i.unit === 'meter' ? 'm' : 'pc'} @ {i.costPrice}{i.rollNo ? ` · ${i.rollNo}` : ''}</div>)}</td>
                    <td className="p-3 text-end font-mono">{p.total.toLocaleString()}</td>
                    <td className={`p-3 text-end font-mono ${p.due > 0 ? 'text-destructive' : ''}`}>{p.due.toLocaleString()}</td>
                  </tr>
                ))}
                {purchases.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No purchases yet</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Supplier form */}
      <Dialog open={!!supForm} onOpenChange={v => !v && setSupForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{supForm?.id ? 'Edit' : 'Add'} supplier</DialogTitle></DialogHeader>
          {supForm && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Name</Label><Input value={supForm.name || ''} onChange={e => setSupForm({ ...supForm, name: e.target.value })} /></div>
              <div><Label>Company / mill</Label><Input value={supForm.company || ''} onChange={e => setSupForm({ ...supForm, company: e.target.value })} /></div>
              <div><Label>Phone</Label><Input inputMode="tel" value={supForm.phone || ''} onChange={e => setSupForm({ ...supForm, phone: e.target.value })} /></div>
              <div className="col-span-2"><Label>Address</Label><Input value={supForm.address || ''} onChange={e => setSupForm({ ...supForm, address: e.target.value })} /></div>
              <div><Label>Opening balance (we owe)</Label><Input type="number" value={supForm.openingBalance || ''} onChange={e => setSupForm({ ...supForm, openingBalance: parseFloat(e.target.value) || 0 })} /></div>
              <div><Label>Notes</Label><Input value={supForm.notes || ''} onChange={e => setSupForm({ ...supForm, notes: e.target.value })} /></div>
              <Button className="col-span-2" disabled={!supForm.name} onClick={() => {
                if (supForm.id) updateSupplier(supForm.id, supForm);
                else addSupplier({ name: supForm.name!, phone: supForm.phone || '', company: supForm.company, address: supForm.address, openingBalance: supForm.openingBalance || 0, notes: supForm.notes });
                setSupForm(null);
              }}>Save</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Purchase form */}
      <Dialog open={showPurchase} onOpenChange={setShowPurchase}>
        <DialogContent className="sm:max-w-3xl max-h-[92dvh] overflow-auto">
          <DialogHeader><DialogTitle>New purchase</DialogTitle></DialogHeader>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><Label>Supplier</Label>
              <Select value={supplierId} onValueChange={setSupplierId}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Add product</Label>
              <Select value="" onValueChange={addLine}><SelectTrigger><SelectValue placeholder="Choose product…" /></SelectTrigger>
                <SelectContent>{products.filter(p => p.active).map(p => <SelectItem key={p.id} value={p.id}>{p.brand} — {p.article} ({p.sku})</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="space-y-2 mt-2">
            {lines.map(l => {
              const p = products.find(x => x.id === l.productId)!;
              const upd = (patch: Partial<Line>) => setLines(ls => ls.map(x => x.key === l.key ? { ...x, ...patch } : x));
              return (
                <div key={l.key} className="grid grid-cols-2 sm:grid-cols-[1.6fr_1fr_0.8fr_0.9fr_0.9fr_auto] gap-2 items-end rounded-lg border border-border p-2">
                  <div className="col-span-2 sm:col-span-1 text-sm font-medium">{l.productName}<p className="text-[11px] text-muted-foreground">{l.unit === 'meter' ? 'Meters (one Thaan)' : 'Pieces'}</p></div>
                  {isColorProduct(p) ? (
                    <div><Label className="text-xs">Colour</Label><Input list={`c-${l.key}`} value={l.color || ''} onChange={e => upd({ color: e.target.value })} className="h-8" />
                      <datalist id={`c-${l.key}`}>{p.colorStocks.map(c => <option key={c.color} value={c.color} />)}</datalist></div>
                  ) : <div />}
                  <div><Label className="text-xs">{l.unit === 'meter' ? 'Meters' : 'Qty'}</Label><Input type="number" inputMode="decimal" value={l.quantity || ''} onChange={e => upd({ quantity: parseFloat(e.target.value) || 0 })} className="h-8" /></div>
                  <div><Label className="text-xs">Cost / {l.unit === 'meter' ? 'm' : 'pc'}</Label><Input type="number" inputMode="decimal" value={l.costPrice || ''} onChange={e => upd({ costPrice: parseFloat(e.target.value) || 0 })} className="h-8" /></div>
                  {l.unit === 'meter' ? <div><Label className="text-xs">Thaan no.</Label><Input placeholder="auto" value={l.rollNo || ''} onChange={e => upd({ rollNo: e.target.value })} className="h-8" /></div> : <div />}
                  <Button size="icon" variant="ghost" onClick={() => setLines(ls => ls.filter(x => x.key !== l.key))}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              );
            })}
            {lines.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Add products above. For several thaans of one design, add the product once per thaan.</p>}
          </div>
          <div className="grid sm:grid-cols-4 gap-3 mt-2">
            <div><Label>Discount</Label><Input type="number" value={discount || ''} onChange={e => setDiscount(parseFloat(e.target.value) || 0)} /></div>
            <div><Label>Paid now</Label><Input type="number" value={paid || ''} onChange={e => setPaid(parseFloat(e.target.value) || 0)} /></div>
            <div><Label>Method</Label><Select value={method} onValueChange={(v: PaymentMethod) => setMethod(v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Notes</Label><Input value={notes} onChange={e => setNotes(e.target.value)} /></div>
          </div>
          <div className="flex flex-wrap justify-between items-center gap-2 mt-2 rounded-lg bg-muted p-3 text-sm">
            <span>Subtotal {cur} {subtotal.toLocaleString()} · Total <b>{cur} {total.toLocaleString()}</b> · Payable <b className="text-destructive">{cur} {Math.max(0, total - paid).toLocaleString()}</b></span>
            <Button onClick={savePurchase}>Save purchase & add stock</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment */}
      <Dialog open={!!paySup} onOpenChange={v => !v && setPaySup(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Pay {paySup?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Amount</Label><Input type="number" value={payAmt || ''} onChange={e => setPayAmt(parseFloat(e.target.value) || 0)} /></div>
            <div><Label>Method</Label><Select value={payMethod} onValueChange={(v: PaymentMethod) => setPayMethod(v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Note</Label><Input value={payNote} onChange={e => setPayNote(e.target.value)} /></div>
            <Button className="w-full" disabled={payAmt <= 0} onClick={() => {
              addSupplierPayment({ supplierId: paySup!.id, supplierName: paySup!.name, amount: payAmt, method: payMethod, note: payNote || undefined });
              toast.success('Payment recorded'); setPaySup(null); setPayNote('');
            }}>Record payment</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Statement */}
      <Dialog open={!!stmt} onOpenChange={v => !v && setStmt(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[92dvh] overflow-auto">
          <DialogHeader><DialogTitle>Statement – {stmt?.name}</DialogTitle></DialogHeader>
          {stmt && (() => {
            const spec = supplierStatement(stmt, useStore.getState().getBusinessData());
            return (
              <div className="space-y-3">
                <ExportButtons spec={() => supplierStatement(stmt, useStore.getState().getBusinessData())} phone={stmt.phone} />
                <table className="w-full text-xs">
                  <thead className="bg-muted"><tr>{spec.columns.map(c => <th key={c.header} className={`p-2 ${c.numeric ? 'text-end' : 'text-start'}`}>{c.header}</th>)}</tr></thead>
                  <tbody>{spec.rows.map((r, i) => <tr key={i} className="border-t border-border">{spec.columns.map(c => <td key={c.header} className={`p-2 ${c.numeric ? 'text-end font-mono' : ''}`}>{String(c.value(r) ?? '')}</td>)}</tr>)}</tbody>
                </table>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
