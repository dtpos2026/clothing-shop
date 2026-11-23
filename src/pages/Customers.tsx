import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import type { Customer, PaymentMethod } from '@/types';
import { ExportButtons } from '@/components/share/ExportButtons';
import { customerStatement } from '@/lib/datasets';
import { PAYMENT_METHODS } from '@/core/defaults';
import { useStore } from '@/store/useStore';
import { Search, Plus, Edit2, Users as UsersIcon, FileText, FileDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { format, parseISO } from 'date-fns';
import { exportCustomerReportPDF, exportCustomerCSV } from '@/lib/pdfExport';

export default function Customers() {
  const { customers, sales, addCustomer, updateCustomer, settings } = useStore();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const [opening, setOpening] = useState('');
  const [stmtId, setStmtId] = useState<string | null>(null);
  const [payAmt, setPayAmt] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('Cash');
  const { receiveCustomerPayment, getCustomerKhataBalance } = useStore();
  const stmtCustomer = customers.find(c => c.id === stmtId);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return customers.filter(c => !q || c.name.toLowerCase().includes(q) || c.phone.includes(q));
  }, [customers, search]);

  const openAdd = () => { setName(''); setPhone(''); setAddress(''); setNotes(''); setOpening(''); setEditId(null); setShowForm(true); };
  const openEdit = (c: Customer) => { setName(c.name); setPhone(c.phone); setAddress(c.address || ''); setNotes(c.notes || ''); setOpening(c.openingBalance ? String(c.openingBalance) : ''); setEditId(c.id); setShowForm(true); };

  const handleSave = () => {
    if (editId) {
      updateCustomer(editId, { name, phone, address, notes, openingBalance: parseFloat(opening) || 0 });
    } else {
      addCustomer({ name, phone, address, notes, openingBalance: parseFloat(opening) || 0 });
    }
    setShowForm(false);
  };

  const customerSales = showHistory ? sales.filter(s => !s.deleted && s.customerId === showHistory) : [];

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><UsersIcon className="w-6 h-6" /> Customers</h1>
          <p className="text-sm text-muted-foreground">{customers.length} customers</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportCustomerCSV(customers)}>
            <FileDown className="w-4 h-4 mr-2" /> CSV (WhatsApp)
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportCustomerReportPDF(customers, sales, settings)}>
            <FileText className="w-4 h-4 mr-2" /> PDF Report
          </Button>
          <Button onClick={openAdd}><Plus className="w-4 h-4 mr-2" /> Add Customer</Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search by name or phone..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted"><tr>
            <th className="text-left p-3 font-medium">Name</th>
            <th className="text-left p-3 font-medium">Phone</th>
            <th className="text-left p-3 font-medium">Address</th>
            <th className="text-left p-3 font-medium">Since</th>
            <th className="text-right p-3 font-medium">Balance</th>
            <th className="text-center p-3 font-medium">Actions</th>
          </tr></thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} className="border-t border-border hover:bg-muted/30">
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3">{c.phone}</td>
                <td className="p-3 text-muted-foreground text-xs">{c.address || '-'}</td>
                <td className="p-3 text-xs">{format(parseISO(c.createdAt), 'dd MMM yyyy')}</td>
                <td className={`p-3 text-right font-mono ${getCustomerKhataBalance(c.id) > 0 ? 'text-destructive font-semibold' : ''}`}>{getCustomerKhataBalance(c.id).toLocaleString()}</td>
                <td className="p-3 text-center">
                  <Button variant="ghost" size="sm" onClick={() => setShowHistory(c.id)}>History</Button>
                  <Button variant="ghost" size="sm" onClick={() => { setStmtId(c.id); setPayAmt(''); }}>Statement</Button>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(c)}><Edit2 className="w-3.5 h-3.5" /></Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No customers</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Form */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? 'Edit' : 'Add'} Customer</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            <div><Label>Phone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} /></div>
            <div><Label>Address</Label><Input value={address} onChange={e => setAddress(e.target.value)} /></div>
            <div><Label>Notes</Label><Input value={notes} onChange={e => setNotes(e.target.value)} /></div>
            <div><Label>Opening balance (amount customer already owes)</Label><Input type="number" value={opening} onChange={e => setOpening(e.target.value)} /></div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!name}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Purchase History */}
      <Dialog open={!!showHistory} onOpenChange={() => setShowHistory(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Purchase History</DialogTitle></DialogHeader>
          {customerSales.length === 0 ? (
            <p className="text-sm text-muted-foreground">No purchases yet</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-auto">
              {customerSales.map(s => (
                <div key={s.id} className="p-3 rounded-lg border border-border">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">{s.invoiceNumber}</span>
                    <span className="text-sm font-semibold">{settings.currency} {s.total.toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{format(parseISO(s.createdAt), 'dd MMM yyyy, hh:mm a')} · {s.paymentMethod}</p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Statement / ledger */}
      <Dialog open={!!stmtCustomer} onOpenChange={v => !v && setStmtId(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[92dvh] overflow-auto">
          <DialogHeader><DialogTitle>Statement – {stmtCustomer?.name}</DialogTitle></DialogHeader>
          {stmtCustomer && (() => {
            const spec = customerStatement(stmtCustomer, useStore.getState().getBusinessData());
            const bal = getCustomerKhataBalance(stmtCustomer.id);
            return (
              <div className="space-y-3">
                <ExportButtons spec={() => customerStatement(stmtCustomer, useStore.getState().getBusinessData())} phone={stmtCustomer.phone} />
                <div className="flex flex-wrap items-end gap-2 rounded-lg bg-muted p-3">
                  <div className="me-auto text-sm">Balance due: <b className={bal > 0 ? 'text-destructive' : 'text-success'}>{settings.currency} {bal.toLocaleString()}</b></div>
                  <Input type="number" placeholder="Amount received" className="w-36 h-9" value={payAmt} onChange={e => setPayAmt(e.target.value)} />
                  <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={payMethod} onChange={e => setPayMethod(e.target.value as PaymentMethod)}>
                    {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                  </select>
                  <Button size="sm" disabled={!(parseFloat(payAmt) > 0)} onClick={() => { receiveCustomerPayment(stmtCustomer.id, parseFloat(payAmt), payMethod); toast.success('Payment received'); setPayAmt(''); }}>Receive</Button>
                </div>
                <table className="w-full text-xs">
                  <thead className="bg-muted"><tr>{spec.columns.map(c => <th key={c.header} className={`p-2 ${c.numeric ? 'text-right' : 'text-left'}`}>{c.header}</th>)}</tr></thead>
                  <tbody>{spec.rows.map((r, i) => <tr key={i} className="border-t border-border">{spec.columns.map(c => <td key={c.header} className={`p-2 ${c.numeric ? 'text-right font-mono' : ''}`}>{String(c.value(r) ?? '')}</td>)}</tr>)}</tbody>
                </table>
                {spec.rows.length === 0 && <p className="text-sm text-muted-foreground text-center">No transactions yet</p>}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
