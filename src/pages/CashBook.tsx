import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { format, parseISO, startOfMonth } from 'date-fns';
import { BookText, ArrowDownCircle, ArrowUpCircle, Trash2, TrendingUp } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExportButtons } from '@/components/share/ExportButtons';
import { buildDataset } from '@/lib/datasets';
import { cashBook, cashTotals, profitAndLoss, CASH_METHODS } from '@/core/accounting';
import { PAYMENT_METHODS } from '@/core/defaults';
import type { PaymentMethod } from '@/types';
import { cn } from '@/lib/utils';

const today = () => new Date().toISOString().slice(0, 10);

export default function CashBook() {
  const state = useStore();
  const { settings, addCashEntry, deleteCashEntry, cashEntries } = state;
  const cur = settings.currency;
  const [from, setFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [to, setTo] = useState(today());
  const [cashOnly, setCashOnly] = useState(false);
  const range = { from: from || undefined, to: to || undefined };
  const book = useMemo(() => cashBook(state, range), [state.sales, state.credits, state.expenses, state.purchases, state.supplierPayments, state.cashEntries, from, to]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = cashOnly ? book.filter(e => CASH_METHODS.includes(e.method)) : book;
  const totals = cashTotals(book, cashOnly ? CASH_METHODS : undefined);
  const pl = useMemo(() => profitAndLoss(state, range), [state.sales, state.expenses, state.stockAdjustments, from, to]); // eslint-disable-line react-hooks/exhaustive-deps
  const [entry, setEntry] = useState({ type: 'in' as 'in' | 'out', amount: 0, category: 'Opening balance', description: '', method: 'Cash' as PaymentMethod, date: today() });

  return (
    <div className="p-4 md:p-6 space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><BookText className="w-6 h-6" /> Cash Book & Profit / Loss</h1>
          <p className="text-sm text-muted-foreground">Built from actual sales, returns, receipts, purchases, supplier payments, expenses and cash entries.</p>
        </div>
        <div className="flex gap-2">
          <div><Label className="text-xs">From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-9" /></div>
          <div><Label className="text-xs">To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-9" /></div>
        </div>
      </div>

      <Tabs defaultValue="book">
        <TabsList><TabsTrigger value="book">Cash book</TabsTrigger><TabsTrigger value="pl">Profit & Loss</TabsTrigger><TabsTrigger value="entry">Cash in / out</TabsTrigger></TabsList>

        <TabsContent value="book" className="mt-3 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Card label="Cash in" value={`${cur} ${totals.cashIn.toLocaleString()}`} cls="text-success" />
            <Card label="Cash out" value={`${cur} ${totals.cashOut.toLocaleString()}`} cls="text-destructive" />
            <Card label="Net" value={`${cur} ${totals.net.toLocaleString()}`} cls={totals.net >= 0 ? 'text-success' : 'text-destructive'} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cashOnly} onChange={e => setCashOnly(e.target.checked)} /> Cash drawer only (exclude bank / digital)</label>
            <ExportButtons spec={() => buildDataset('cashbook', useStore.getState().getBusinessData(), range)} />
          </div>
          <div className="bg-card rounded-xl border border-border overflow-auto max-h-[60vh]">
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0"><tr><th className="p-2 text-start">Date</th><th className="p-2 text-start">Description</th><th className="p-2 text-start">Method</th><th className="p-2 text-end">In</th><th className="p-2 text-end">Out</th></tr></thead>
              <tbody>
                {shown.map(e => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="p-2 text-xs whitespace-nowrap">{format(parseISO(e.date), 'dd MMM, HH:mm')}</td>
                    <td className="p-2">{e.description}</td><td className="p-2 text-xs">{e.method}</td>
                    <td className="p-2 text-end font-mono text-success">{e.direction === 'in' ? e.amount.toLocaleString() : ''}</td>
                    <td className="p-2 text-end font-mono text-destructive">{e.direction === 'out' ? e.amount.toLocaleString() : ''}</td>
                  </tr>
                ))}
                {shown.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No transactions in this period</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="pl" className="mt-3 space-y-3">
          <div className="flex justify-end"><ExportButtons spec={() => buildDataset('profitloss', useStore.getState().getBusinessData(), range)} /></div>
          <div className="bg-card rounded-xl border border-border p-5 max-w-xl space-y-1 text-sm">
            {([
              ['Gross sales', pl.grossSales], ['Less: discounts', -pl.discounts], ['Less: returns', -pl.returns], ['Net sales', pl.netSales, true],
              ['Cost of goods sold', -pl.cogs], ['Gross profit', pl.grossProfit, true], ['Shop expenses', -pl.shopExpenses], ['Damaged / lost stock', -pl.stockLosses],
            ] as [string, number, boolean?][]).map(([l, v, bold]) => (
              <div key={l} className={cn('flex justify-between py-1', bold && 'font-bold border-t border-border')}><span>{l}</span><span className="font-mono">{cur} {v.toLocaleString()}</span></div>
            ))}
            <div className={cn('flex justify-between py-2 text-lg font-extrabold border-t-2 border-border', pl.netProfit >= 0 ? 'text-success' : 'text-destructive')}>
              <span className="flex items-center gap-2"><TrendingUp className="w-5 h-5" />Net profit</span><span className="font-mono">{cur} {pl.netProfit.toLocaleString()}</span>
            </div>
            <p className="text-xs text-muted-foreground">Gross margin {pl.marginPct}% · Home expenses (owner drawings, not in profit): {cur} {pl.homeExpenses.toLocaleString()}. Cost of goods uses the actual thaan / purchase cost captured at the time of each sale.</p>
          </div>
        </TabsContent>

        <TabsContent value="entry" className="mt-3 space-y-3">
          <div className="bg-card rounded-xl border border-border p-4 grid sm:grid-cols-3 gap-3 max-w-3xl">
            <div className="flex gap-2 sm:col-span-3">
              {(['in', 'out'] as const).map(t => (
                <button key={t} onClick={() => setEntry({ ...entry, type: t })} className={cn('flex-1 rounded-lg border p-2 flex items-center justify-center gap-2 text-sm', entry.type === t ? (t === 'in' ? 'border-success bg-success/10' : 'border-destructive bg-destructive/10') : 'border-border')}>
                  {t === 'in' ? <ArrowDownCircle className="w-4 h-4" /> : <ArrowUpCircle className="w-4 h-4" />}{t === 'in' ? 'Cash in' : 'Cash out'}
                </button>
              ))}
            </div>
            <div><Label>Amount</Label><Input type="number" value={entry.amount || ''} onChange={e => setEntry({ ...entry, amount: parseFloat(e.target.value) || 0 })} /></div>
            <div><Label>Category</Label><Input list="cash-cats" value={entry.category} onChange={e => setEntry({ ...entry, category: e.target.value })} />
              <datalist id="cash-cats">{['Opening balance', 'Owner investment', 'Owner withdrawal', 'Bank deposit', 'Bank withdrawal', 'Loan', 'Other'].map(c => <option key={c} value={c} />)}</datalist></div>
            <div><Label>Method</Label><Select value={entry.method} onValueChange={(v: PaymentMethod) => setEntry({ ...entry, method: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Date</Label><Input type="date" value={entry.date} onChange={e => setEntry({ ...entry, date: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Description</Label><Input value={entry.description} onChange={e => setEntry({ ...entry, description: e.target.value })} /></div>
            <Button className="sm:col-span-3" disabled={entry.amount <= 0} onClick={() => { addCashEntry(entry); toast.success('Saved'); setEntry({ ...entry, amount: 0, description: '' }); }}>Save entry</Button>
          </div>
          <div className="bg-card rounded-xl border border-border overflow-auto">
            <table className="w-full text-sm">
              <tbody>{[...cashEntries].reverse().map(c => (
                <tr key={c.id} className="border-t border-border">
                  <td className="p-2 text-xs">{c.date}</td><td className="p-2">{c.category}{c.description ? ` – ${c.description}` : ''}</td><td className="p-2 text-xs">{c.method}</td>
                  <td className={cn('p-2 text-end font-mono', c.type === 'in' ? 'text-success' : 'text-destructive')}>{c.type === 'in' ? '+' : '−'}{c.amount.toLocaleString()}</td>
                  <td className="p-2 text-end"><Button size="sm" variant="ghost" onClick={() => { if (confirm('Delete this entry?')) deleteCashEntry(c.id); }}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Card({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return <div className="bg-card rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className={cn('text-lg font-extrabold font-mono', cls)}>{value}</p></div>;
}
