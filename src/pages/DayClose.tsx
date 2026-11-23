import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Moon, Printer, CheckCircle2, DollarSign, CreditCard, ShoppingCart, Undo2, Wallet, History } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cashBook, cashTotals, CASH_METHODS, dayOf, isReturn, salePayments, todayKey } from '@/core/accounting';
import { round2 } from '@/core/inventory';
import { PAYMENT_METHODS } from '@/core/defaults';
import type { DayClosing } from '@/types';

/**
 * Day close (v2): counts the cash drawer against expected cash and stores a closing record.
 * Unlike v1 it never deletes sales – the dashboard shows "today" by date, so it resets naturally.
 */
export default function DayClose() {
  const state = useStore();
  const { sales, settings, closeDay, dayClosings } = state;
  const cur = settings.currency;
  const day = todayKey();
  const [counted, setCounted] = useState('');
  const [opening, setOpening] = useState('');
  const [notes, setNotes] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [view, setView] = useState<DayClosing | null>(null);

  const todaySales = sales.filter(s => !s.deleted && dayOf(s.createdAt) === day);
  const bills = todaySales.filter(s => !isReturn(s));
  const returns = todaySales.filter(isReturn);
  const todayTotal = round2(bills.reduce((a, s) => a + s.total, 0));
  const returnsTotal = round2(-returns.reduce((a, s) => a + s.total, 0));
  const credit = round2(bills.reduce((a, s) => a + s.creditAmount, 0));
  const discount = round2(bills.reduce((a, s) => a + s.discountAmount, 0));
  const byMethod = useMemo(() => {
    const m = new Map<string, number>();
    todaySales.forEach(s => salePayments(s).forEach(p => m.set(p.method, round2((m.get(p.method) || 0) + p.amount))));
    return m;
  }, [todaySales]);
  const book = cashBook(state, { from: day, to: day });
  const cash = cashTotals(book, CASH_METHODS);
  const prev = [...dayClosings].filter(d => d.date < day).sort((a, b) => b.date.localeCompare(a.date))[0];
  const defaultOpening = prev ? (Number.isFinite(prev.countedCash) ? prev.countedCash : prev.expectedCash) : 0;
  const openingVal = opening === '' ? defaultOpening : parseFloat(opening) || 0;
  const expected = round2(openingVal + cash.cashIn - cash.cashOut);
  const countedVal = counted === '' ? NaN : parseFloat(counted);
  const diff = Number.isFinite(countedVal) ? round2(countedVal - expected) : 0;
  const closedToday = dayClosings.find(d => d.date === day);

  const handleClose = () => {
    const c = closeDay({ countedCash: Number.isFinite(countedVal) ? countedVal : expected, openingCash: openingVal, notes: notes || undefined });
    setShowConfirm(false);
    toast.success(`Day closed. ${c.difference === 0 ? 'Cash matches.' : `Difference: ${cur} ${c.difference.toLocaleString()}`}`);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2"><Moon className="w-6 h-6" /> Day Close</h1>
          <p className="text-sm text-muted-foreground">{format(new Date(), 'EEEE, dd MMMM yyyy')}{closedToday ? ` · closed at ${format(parseISO(closedToday.createdAt), 'hh:mm a')} by ${closedToday.closedBy}` : ''}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 me-2" /> Print Summary</Button>
          <Button onClick={() => setShowConfirm(true)}><CheckCircle2 className="w-4 h-4 me-2" /> {closedToday ? 'Close again' : 'Close Day'}</Button>
        </div>
      </div>

      <div className="print-receipt space-y-6">
        <div className="hidden print:block text-center mb-4 border-b border-dashed pb-3">
          <h2 className="text-lg font-bold">{settings.storeName}</h2>
          <p className="text-xs font-bold mt-2">DAY CLOSING REPORT – {format(new Date(), 'dd/MM/yyyy hh:mm a')}</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard icon={ShoppingCart} title="Bills" value={String(bills.length)} color="bg-primary/10 text-primary" />
          <SummaryCard icon={DollarSign} title="Sales" value={`${cur} ${todayTotal.toLocaleString()}`} color="bg-success/10 text-success" />
          <SummaryCard icon={Undo2} title="Returns" value={`${cur} ${returnsTotal.toLocaleString()}`} color="bg-destructive/10 text-destructive" />
          <SummaryCard icon={CreditCard} title="Udhar given" value={`${cur} ${credit.toLocaleString()}`} color="bg-warning/10 text-warning" />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-card rounded-2xl border border-border p-5">
            <h3 className="font-bold mb-3">💵 Payments received today</h3>
            {[...PAYMENT_METHODS, 'Exchange'].filter(m => byMethod.has(m)).map(m => (
              <div key={m} className="flex justify-between py-1.5 border-b border-border last:border-0 text-sm"><span>{m}</span><span className="font-mono font-bold">{cur} {(byMethod.get(m) || 0).toLocaleString()}</span></div>
            ))}
            {byMethod.size === 0 && <p className="text-sm text-muted-foreground">No payments today</p>}
            <div className="flex justify-between pt-2 mt-2 border-t-2 border-border text-sm"><span>Discount given</span><span className="font-mono">{cur} {discount.toLocaleString()}</span></div>
          </div>

          <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
            <h3 className="font-bold flex items-center gap-2"><Wallet className="w-4 h-4" />Cash drawer</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><Label className="text-xs">Opening cash</Label><Input type="number" placeholder={String(defaultOpening)} value={opening} onChange={e => setOpening(e.target.value)} /></div>
              <div><Label className="text-xs">Counted cash now</Label><Input type="number" placeholder="Count the drawer" value={counted} onChange={e => setCounted(e.target.value)} /></div>
            </div>
            <div className="text-sm space-y-1">
              <Line l="Opening" v={openingVal} cur={cur} />
              <Line l="+ Cash in (sales, receipts, cash entries)" v={cash.cashIn} cur={cur} />
              <Line l="− Cash out (refunds, expenses, suppliers)" v={-cash.cashOut} cur={cur} />
              <Line l="Expected in drawer" v={expected} cur={cur} bold />
              {Number.isFinite(countedVal) && <Line l={diff === 0 ? 'Matches ✓' : diff > 0 ? 'Excess' : 'Short'} v={diff} cur={cur} bold cls={diff === 0 ? 'text-success' : 'text-destructive'} />}
            </div>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-5">
          <h3 className="font-bold mb-3">🧾 Today's invoices</h3>
          {todaySales.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">No sales recorded today</p> : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted"><tr><th className="text-start p-2">Invoice</th><th className="text-start p-2">Customer</th><th className="text-start p-2">Payment</th><th className="text-end p-2">Amount</th></tr></thead>
                <tbody>{todaySales.map(s => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="p-2 font-mono text-xs">{s.invoiceNumber}</td><td className="p-2">{s.customerName || 'Walk-in'}</td>
                    <td className="p-2 text-xs">{salePayments(s).map(p => p.method).join(' + ') || s.saleType}</td>
                    <td className={`p-2 text-end font-bold font-mono ${s.total < 0 ? 'text-destructive' : ''}`}>{cur} {s.total.toLocaleString()}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border p-5 no-print">
        <h3 className="font-bold mb-3 flex items-center gap-2"><History className="w-4 h-4" />Closing history</h3>
        {dayClosings.length === 0 ? <p className="text-sm text-muted-foreground">No closings yet</p> : (
          <table className="w-full text-sm">
            <thead className="text-muted-foreground"><tr><th className="text-start p-2">Date</th><th className="text-end p-2">Sales</th><th className="text-end p-2">Expected</th><th className="text-end p-2">Counted</th><th className="text-end p-2">Diff</th><th className="p-2" /></tr></thead>
            <tbody>{[...dayClosings].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 60).map(d => (
              <tr key={d.id} className="border-t border-border">
                <td className="p-2">{d.date}</td><td className="p-2 text-end font-mono">{d.totalSales.toLocaleString()}</td>
                <td className="p-2 text-end font-mono">{d.expectedCash.toLocaleString()}</td><td className="p-2 text-end font-mono">{d.countedCash.toLocaleString()}</td>
                <td className={`p-2 text-end font-mono ${d.difference ? 'text-destructive' : 'text-success'}`}>{d.difference.toLocaleString()}</td>
                <td className="p-2 text-end"><Button size="sm" variant="ghost" onClick={() => setView(d)}>View</Button></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Confirm day close</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p>A closing record is saved with today's totals and cash count. <b>Sales history is kept</b> – reports, ledgers and profit remain complete.</p>
            <p className="text-muted-foreground" dir="rtl">دن کا اختتام محفوظ ہو جائے گا۔ سیلز کا ریکارڈ حذف نہیں ہوگا۔</p>
            <div><Label>Notes</Label><Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" /></div>
            {!Number.isFinite(countedVal) && <p className="text-xs text-warning">No counted cash entered – expected cash ({cur} {expected.toLocaleString()}) will be used.</p>}
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowConfirm(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleClose} className="flex-1">Close day</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!view} onOpenChange={v => !v && setView(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Closing {view?.date}</DialogTitle></DialogHeader>
          {view && <div className="text-sm space-y-1">
            <Line l="Bills" v={view.billCount} cur="" /><Line l="Sales" v={view.totalSales} cur={cur} /><Line l="Returns" v={view.totalReturns} cur={cur} />
            <Line l="Udhar given" v={view.creditGiven} cur={cur} /><Line l="Discounts" v={view.discountGiven} cur={cur} /><Line l="Expenses" v={view.expenses} cur={cur} />
            <Line l="Opening cash" v={view.openingCash} cur={cur} /><Line l="Cash in" v={view.cashIn} cur={cur} /><Line l="Cash out" v={view.cashOut} cur={cur} />
            <Line l="Expected" v={view.expectedCash} cur={cur} bold /><Line l="Counted" v={view.countedCash} cur={cur} bold /><Line l="Difference" v={view.difference} cur={cur} bold />
            <p className="text-xs text-muted-foreground pt-2">Closed by {view.closedBy}{view.notes ? ` · ${view.notes}` : ''}</p>
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Line({ l, v, cur, bold, cls }: { l: string; v: number; cur: string; bold?: boolean; cls?: string }) {
  return <div className={`flex justify-between ${bold ? 'font-bold' : ''} ${cls || ''}`}><span>{l}</span><span className="font-mono">{cur} {v.toLocaleString()}</span></div>;
}

function SummaryCard({ icon: Icon, title, value, color }: { icon: typeof Moon; title: string; value: string; color: string }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{title}</span>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}><Icon className="w-4 h-4" /></div>
      </div>
      <p className="text-lg font-extrabold text-foreground">{value}</p>
    </div>
  );
}
