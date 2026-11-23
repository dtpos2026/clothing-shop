import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { Moon, Printer, CheckCircle2, DollarSign, CreditCard, ShoppingCart, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, isToday, parseISO } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function DayClose() {
  const { sales, credits, settings, closeDayAndResetSales, lastDayCloseDate } = useStore();
  const [closed, setClosed] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const todaySales = sales.filter(s => !s.deleted && isToday(parseISO(s.createdAt)));
  const todayTotal = todaySales.reduce((sum, s) => sum + s.total, 0);
  const todayCash = todaySales.filter(s => s.paymentMethod === 'Cash').reduce((sum, s) => sum + s.total, 0);
  const todayCard = todaySales.filter(s => s.paymentMethod === 'Card').reduce((sum, s) => sum + s.total, 0);
  const todayBank = todaySales.filter(s => s.paymentMethod === 'Bank Transfer').reduce((sum, s) => sum + s.total, 0);
  const todayCredit = todaySales.filter(s => s.saleType === 'credit' || s.saleType === 'partial').reduce((sum, s) => sum + s.creditAmount, 0);
  const todayDiscount = todaySales.reduce((sum, s) => sum + s.discountAmount, 0);

  const handleClose = () => {
    closeDayAndResetSales();
    setClosed(true);
    setShowConfirm(false);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2"><Moon className="w-6 h-6" /> Day Close</h1>
          <p className="text-sm text-muted-foreground">{format(new Date(), 'EEEE, dd MMMM yyyy')}</p>
          {lastDayCloseDate && (
            <p className="text-xs text-muted-foreground mt-1">
              Last closed: {format(parseISO(lastDayCloseDate), 'dd MMM yyyy, hh:mm a')}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}><Printer className="w-4 h-4 mr-2" /> Print Summary</Button>
          {!closed && (
            <Button onClick={() => setShowConfirm(true)} className="bg-primary text-primary-foreground">
              <CheckCircle2 className="w-4 h-4 mr-2" /> Close Day
            </Button>
          )}
        </div>
      </div>

      {closed && (
        <div className="bg-success/10 border border-success/30 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-success" />
          <div>
            <p className="font-bold text-success">Day Closed Successfully</p>
            <p className="text-sm text-muted-foreground">Sales data cleared. Dashboard reset to zero. Inventory, customers & khata remain intact.</p>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-warning" /> Confirm Day Close</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p>یہ عمل مندرجہ ذیل کام کرے گا:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>تمام سیلز ڈیٹا صاف ہو جائے گا</li>
              <li>ڈیش بورڈ زیرو ہو جائے گا</li>
              <li>انوینٹری، کسٹمرز، کھاتہ وہی رہے گا</li>
            </ul>
            <p className="font-bold text-destructive">⚠️ یہ عمل واپس نہیں ہو سکتا!</p>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowConfirm(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleClose} className="flex-1 bg-destructive text-destructive-foreground">Confirm Close Day</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Summary Cards */}
      <div className="print-receipt">
        {/* Print header */}
        <div className="hidden print:block text-center mb-4 border-b border-dashed pb-3">
          <h2 className="text-lg font-bold">{settings.storeName}</h2>
          {settings.address && <p className="text-xs">{settings.address}</p>}
          <p className="text-xs font-bold mt-2">DAY CLOSING REPORT</p>
          <p className="text-xs">{format(new Date(), 'dd/MM/yyyy hh:mm a')}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard icon={ShoppingCart} title="Total Bills" value={String(todaySales.length)} color="bg-primary/10 text-primary" />
          <SummaryCard icon={DollarSign} title="Total Sales" value={`${settings.currency} ${todayTotal.toLocaleString()}`} color="bg-success/10 text-success" />
          <SummaryCard icon={CreditCard} title="Credit Given" value={`${settings.currency} ${todayCredit.toLocaleString()}`} color="bg-warning/10 text-warning" />
          <SummaryCard icon={DollarSign} title="Total Discount" value={`${settings.currency} ${todayDiscount.toLocaleString()}`} color="bg-destructive/10 text-destructive" />
        </div>

        {/* Payment Breakdown */}
        <div className="bg-card rounded-2xl border border-border p-5 mt-6">
          <h3 className="font-bold text-foreground mb-4">💵 Payment Method Breakdown</h3>
          <div className="space-y-3">
            {[
              { label: 'Cash', amount: todayCash, color: 'bg-success' },
              { label: 'Card', amount: todayCard, color: 'bg-info' },
              { label: 'Bank Transfer', amount: todayBank, color: 'bg-primary' },
              { label: 'Credit / Udhar', amount: todayCredit, color: 'bg-warning' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${item.color}`} />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                <span className="font-bold font-mono text-sm">{settings.currency} {item.amount.toLocaleString()}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t-2 border-border">
              <span className="font-bold">Grand Total</span>
              <span className="font-extrabold text-lg font-mono">{settings.currency} {todayTotal.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Today's Invoices */}
        <div className="bg-card rounded-2xl border border-border p-5 mt-6">
          <h3 className="font-bold text-foreground mb-4">🧾 Today's Invoices</h3>
          {todaySales.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No sales recorded today</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3 font-medium">Invoice</th>
                    <th className="text-left p-3 font-medium">Customer</th>
                    <th className="text-left p-3 font-medium">Payment</th>
                    <th className="text-right p-3 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {todaySales.map(s => (
                    <tr key={s.id} className="border-t border-border">
                      <td className="p-3 font-mono text-xs">{s.invoiceNumber}</td>
                      <td className="p-3">{s.customerName || 'Walk-in'}</td>
                      <td className="p-3 text-xs">{s.paymentMethod} {s.saleType !== 'cash' && `(${s.saleType})`}</td>
                      <td className="p-3 text-right font-bold font-mono">{settings.currency} {s.total.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, title, value, color }: { icon: any; title: string; value: string; color: string }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{title}</span>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="text-xl font-extrabold text-foreground">{value}</p>
    </div>
  );
}
