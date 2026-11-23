import { useState, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { Search, Plus, BookOpen, CheckCircle, ArrowUpRight, ArrowDownLeft, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { format, parseISO } from 'date-fns';
import type { PaymentMethod } from '@/types';

export default function Udhar() {
  const { credits, customers, khataEntries, addCreditPayment, addKhataEntry, deleteKhataEntry, getCustomerKhataBalance, settings } = useStore();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [showPayment, setShowPayment] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('Cash');
  const [payNote, setPayNote] = useState('');

  // Manual Khata entry state
  const [showKhataForm, setShowKhataForm] = useState(false);
  const [khataCustomerId, setKhataCustomerId] = useState('');
  const [khataType, setKhataType] = useState<'give' | 'take'>('give');
  const [khataAmount, setKhataAmount] = useState('');
  const [khataDesc, setKhataDesc] = useState('');
  const [khataDate, setKhataDate] = useState(new Date().toISOString().split('T')[0]);
  const [khataSearch, setKhataSearch] = useState('');

  const filtered = useMemo(() => {
    return credits.filter(c => {
      const q = search.toLowerCase();
      const matchSearch = !q || c.customerName.toLowerCase().includes(q) || c.customerPhone.includes(q) || c.invoiceNumber.toLowerCase().includes(q);
      const matchFilter = filter === 'all' || (filter === 'pending' && !c.fullyPaid) || (filter === 'paid' && c.fullyPaid);
      return matchSearch && matchFilter;
    });
  }, [credits, search, filter]);

  const filteredKhata = useMemo(() => {
    const q = khataSearch.toLowerCase();
    return khataEntries.filter(e => !q || e.customerName.toLowerCase().includes(q) || e.customerPhone.includes(q));
  }, [khataEntries, khataSearch]);

  const totalDue = credits.filter(c => !c.fullyPaid).reduce((s, c) => s + c.remainingAmount, 0);
  const manualGiveTotal = khataEntries.filter(e => e.type === 'give').reduce((s, e) => s + e.amount, 0);
  const manualTakeTotal = khataEntries.filter(e => e.type === 'take').reduce((s, e) => s + e.amount, 0);

  const handlePayment = () => {
    if (!showPayment || !payAmount) return;
    addCreditPayment(showPayment, { amount: parseFloat(payAmount), method: payMethod, note: payNote || undefined });
    setShowPayment(null); setPayAmount(''); setPayNote('');
  };

  const handleAddKhata = () => {
    const customer = customers.find(c => c.id === khataCustomerId);
    if (!customer || !khataAmount) return;
    addKhataEntry({
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      type: khataType,
      amount: parseFloat(khataAmount),
      description: khataDesc,
      date: khataDate,
    });
    setShowKhataForm(false);
    setKhataAmount('');
    setKhataDesc('');
    setKhataCustomerId('');
  };

  // Get unique customers with balances
  const customerBalances = useMemo(() => {
    const map = new Map<string, { name: string; phone: string; balance: number }>();
    credits.forEach(c => {
      if (!map.has(c.customerId)) map.set(c.customerId, { name: c.customerName, phone: c.customerPhone, balance: 0 });
    });
    khataEntries.forEach(e => {
      if (!map.has(e.customerId)) map.set(e.customerId, { name: e.customerName, phone: e.customerPhone, balance: 0 });
    });
    map.forEach((val, key) => {
      val.balance = getCustomerKhataBalance(key);
    });
    return Array.from(map.entries()).filter(([, v]) => v.balance !== 0).sort((a, b) => b[1].balance - a[1].balance);
  }, [credits, khataEntries]);

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><BookOpen className="w-6 h-6" /> Udhar / Khata</h1>
          <p className="text-sm text-muted-foreground">
            Bill Credit: <span className="font-semibold text-warning">{settings.currency} {totalDue.toLocaleString()}</span>
            {' · '}Manual Give: <span className="font-semibold text-destructive">{settings.currency} {manualGiveTotal.toLocaleString()}</span>
            {' · '}Manual Take: <span className="font-semibold text-success">{settings.currency} {manualTakeTotal.toLocaleString()}</span>
          </p>
        </div>
        <Button onClick={() => setShowKhataForm(true)}>
          <Plus className="w-4 h-4 mr-2" /> Manual Entry
        </Button>
      </div>

      <Tabs defaultValue="bills">
        <TabsList>
          <TabsTrigger value="bills">Bill Credits</TabsTrigger>
          <TabsTrigger value="manual">Manual Khata ({khataEntries.length})</TabsTrigger>
          <TabsTrigger value="balances">Customer Balances ({customerBalances.length})</TabsTrigger>
        </TabsList>

        {/* Bill Credits Tab */}
        <TabsContent value="bills" className="mt-4 space-y-3">
          <div className="flex gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search customer or invoice..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filtered.map(c => (
            <div key={c.id} className={`bg-card rounded-xl border p-4 ${c.fullyPaid ? 'border-success/30' : 'border-warning/30'}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold">{c.customerName}</p>
                  <p className="text-xs text-muted-foreground">{c.customerPhone} · {c.invoiceNumber}</p>
                  <p className="text-xs text-muted-foreground">{format(parseISO(c.createdAt), 'dd MMM yyyy')}</p>
                </div>
                <div className="text-right">
                  {c.fullyPaid ? (
                    <span className="inline-flex items-center gap-1 text-success text-sm font-medium"><CheckCircle className="w-4 h-4" /> Paid</span>
                  ) : (
                    <div>
                      <p className="text-sm font-semibold text-warning">{settings.currency} {c.remainingAmount.toLocaleString()} due</p>
                      <Button size="sm" className="mt-1" onClick={() => setShowPayment(c.id)}>
                        <Plus className="w-3 h-3 mr-1" /> Payment
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-4 text-xs">
                <span>Total: {settings.currency} {c.totalAmount.toLocaleString()}</span>
                <span className="text-success">Paid: {settings.currency} {c.paidAmount.toLocaleString()}</span>
                <span className="text-warning">Remaining: {settings.currency} {c.remainingAmount.toLocaleString()}</span>
              </div>
              {c.payments.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border">
                  <p className="text-xs font-medium mb-1">Payment History</p>
                  {c.payments.map(p => (
                    <div key={p.id} className="flex justify-between text-xs text-muted-foreground">
                      <span>{format(parseISO(p.date), 'dd MMM yyyy')} · {p.method}</span>
                      <span className="text-success">{settings.currency} {p.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">No credit entries</p>}
        </TabsContent>

        {/* Manual Khata Tab */}
        <TabsContent value="manual" className="mt-4 space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search manual entries..." value={khataSearch} onChange={e => setKhataSearch(e.target.value)} className="pl-9" />
          </div>

          {filteredKhata.map(entry => (
            <div key={entry.id} className={`bg-card rounded-xl border p-4 ${entry.type === 'give' ? 'border-destructive/30' : 'border-success/30'}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${entry.type === 'give' ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}>
                    {entry.type === 'give' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="font-semibold">{entry.customerName}</p>
                    <p className="text-xs text-muted-foreground">{entry.customerPhone}</p>
                    <p className="text-xs text-muted-foreground mt-1">{entry.description || 'No description'}</p>
                    <p className="text-xs text-muted-foreground">{format(parseISO(entry.date), 'dd MMM yyyy')}</p>
                  </div>
                </div>
                <div className="text-right flex items-start gap-2">
                  <div>
                    <p className={`text-sm font-bold ${entry.type === 'give' ? 'text-destructive' : 'text-success'}`}>
                      {entry.type === 'give' ? 'Dena (Give)' : 'Lena (Take)'}
                    </p>
                    <p className="text-lg font-bold">{settings.currency} {entry.amount.toLocaleString()}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => deleteKhataEntry(entry.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {filteredKhata.length === 0 && <p className="text-center text-muted-foreground py-8">No manual entries yet</p>}
        </TabsContent>

        {/* Customer Balances Tab */}
        <TabsContent value="balances" className="mt-4 space-y-3">
          {customerBalances.map(([customerId, data]) => (
            <div key={customerId} className="bg-card rounded-xl border border-border p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold">{data.name}</p>
                <p className="text-xs text-muted-foreground">{data.phone}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Net Balance</p>
                <p className={`text-lg font-bold ${data.balance > 0 ? 'text-warning' : 'text-success'}`}>
                  {settings.currency} {Math.abs(data.balance).toLocaleString()}
                  <span className="text-xs ml-1">{data.balance > 0 ? '(Due)' : '(Advance)'}</span>
                </p>
              </div>
            </div>
          ))}
          {customerBalances.length === 0 && <p className="text-center text-muted-foreground py-8">No outstanding balances</p>}
        </TabsContent>
      </Tabs>

      {/* Payment Dialog */}
      <Dialog open={!!showPayment} onOpenChange={() => setShowPayment(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Payment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Amount</Label><Input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} /></div>
            <div>
              <Label>Method</Label>
              <Select value={payMethod} onValueChange={(v: any) => setPayMethod(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  <SelectItem value="Card">Card</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Note (optional)</Label><Input value={payNote} onChange={e => setPayNote(e.target.value)} /></div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowPayment(null)}>Cancel</Button>
            <Button onClick={handlePayment} disabled={!payAmount}>Add Payment</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual Khata Entry Dialog */}
      <Dialog open={showKhataForm} onOpenChange={setShowKhataForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Manual Khata Entry (Laina / Dena)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Customer</Label>
              <Select value={khataCustomerId} onValueChange={setKhataCustomerId}>
                <SelectTrigger><SelectValue placeholder="Select Customer" /></SelectTrigger>
                <SelectContent>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name} — {c.phone}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Type</Label>
              <div className="flex gap-2 mt-1">
                <Button
                  variant={khataType === 'give' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setKhataType('give')}
                  className={khataType === 'give' ? 'bg-destructive text-destructive-foreground' : ''}
                >
                  <ArrowUpRight className="w-4 h-4 mr-1" /> Dena (Give)
                </Button>
                <Button
                  variant={khataType === 'take' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setKhataType('take')}
                  className={khataType === 'take' ? 'bg-success text-success-foreground' : ''}
                >
                  <ArrowDownLeft className="w-4 h-4 mr-1" /> Lena (Take)
                </Button>
              </div>
            </div>
            <div><Label>Amount ({settings.currency})</Label><Input type="number" value={khataAmount} onChange={e => setKhataAmount(e.target.value)} /></div>
            <div><Label>Date</Label><Input type="date" value={khataDate} onChange={e => setKhataDate(e.target.value)} /></div>
            <div><Label>Description</Label><Textarea value={khataDesc} onChange={e => setKhataDesc(e.target.value)} placeholder="e.g. Cash advance, Goods returned, etc." /></div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowKhataForm(false)}>Cancel</Button>
            <Button onClick={handleAddKhata} disabled={!khataCustomerId || !khataAmount}>Add Entry</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
