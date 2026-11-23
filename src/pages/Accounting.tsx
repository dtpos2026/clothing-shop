import { useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { TrendingUp, TrendingDown, DollarSign, Wallet, Lightbulb, Target, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportAccountingPDF } from '@/lib/pdfExport';

export default function Accounting() {
  const { sales, expenses, accounts, accountTransactions, savingsTargets, settings, credits, khataEntries, products } = useStore();
  const currency = settings.currency;

  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const monthSales = sales.filter(s => !s.deleted && s.createdAt.startsWith(thisMonth));
    const monthExpenses = expenses.filter(e => e.date.startsWith(thisMonth));
    const monthTxns = accountTransactions.filter(t => t.date.startsWith(thisMonth));

    const totalRevenue = monthSales.reduce((s, sale) => s + sale.total, 0);
    const totalCost = monthSales.reduce((s, sale) => s + sale.items.reduce((c, i) => c + (i.product.costPrice * i.quantity), 0), 0);
    const grossProfit = totalRevenue - totalCost;

    const homeExp = monthExpenses.filter(e => e.category === 'home').reduce((s, e) => s + e.amount, 0);
    const shopExp = monthExpenses.filter(e => e.category === 'shop').reduce((s, e) => s + e.amount, 0);
    const totalExp = homeExp + shopExp;
    const netProfit = grossProfit - totalExp;

    const totalAccountBalance = accounts.reduce((s, a) => s + a.balance, 0);
    const totalReceivable = credits.filter(c => !c.fullyPaid).reduce((s, c) => s + c.remainingAmount, 0);
    const khataNet = khataEntries.reduce((s, k) => s + (k.type === 'give' ? k.amount : -k.amount), 0);

    const inventoryValue = products.reduce((s, p) => s + (p.costPrice * p.stockQty), 0);

    // Category-wise expenses
    const expByCategory: Record<string, number> = {};
    monthTxns.forEach(t => {
      if (t.type === 'debit') {
        expByCategory[t.category] = (expByCategory[t.category] || 0) + t.amount;
      }
    });

    return { totalRevenue, grossProfit, homeExp, shopExp, totalExp, netProfit, totalAccountBalance, totalReceivable, khataNet, totalCost, inventoryValue, monthTxns, expByCategory };
  }, [sales, expenses, accounts, accountTransactions, credits, khataEntries, products]);

  // AI Budget Suggestions
  const suggestions = useMemo(() => {
    const tips: string[] = [];
    const { totalRevenue, totalExp, homeExp, shopExp, netProfit, totalReceivable } = stats;

    if (totalRevenue === 0) {
      tips.push('💡 ابھی اس مہینے کی کوئی سیل نہیں ہوئی۔ سیل شروع کریں!');
      return tips;
    }

    const expRatio = totalExp / totalRevenue;
    if (expRatio > 0.7) tips.push(`⚠️ خرچے ${(expRatio * 100).toFixed(0)}% سیل کے ہیں — خرچے کم کریں`);
    else if (expRatio < 0.3) tips.push(`✅ خرچے صرف ${(expRatio * 100).toFixed(0)}% ہیں — بہترین کنٹرول!`);

    if (settings.monthlyHomeExpenseBudget > 0 && homeExp > settings.monthlyHomeExpenseBudget) {
      tips.push(`🏠 گھر کا خرچہ بجٹ (${currency} ${settings.monthlyHomeExpenseBudget.toLocaleString()}) سے ${currency} ${(homeExp - settings.monthlyHomeExpenseBudget).toLocaleString()} زیادہ ہے`);
    }
    if (settings.monthlyShopExpenseBudget > 0 && shopExp > settings.monthlyShopExpenseBudget) {
      tips.push(`🏪 دکان کا خرچہ بجٹ (${currency} ${settings.monthlyShopExpenseBudget.toLocaleString()}) سے ${currency} ${(shopExp - settings.monthlyShopExpenseBudget).toLocaleString()} زیادہ ہے`);
    }

    if (totalReceivable > 0) {
      tips.push(`📋 ادھار وصولی بقایا: ${currency} ${totalReceivable.toLocaleString()} — فالو اپ کریں`);
    }

    if (netProfit > 0) {
      const dailyProfit = netProfit / new Date().getDate();
      tips.push(`📈 روزانہ اوسط منافع: ${currency} ${dailyProfit.toFixed(0)} — ماہانہ ~${currency} ${(dailyProfit * 30).toFixed(0)}`);
    }

    savingsTargets.forEach(t => {
      const remaining = t.targetAmount - t.savedAmount;
      if (remaining > 0 && netProfit > 0) {
        const months = Math.ceil(remaining / (netProfit * 0.2));
        tips.push(`🎯 "${t.title}" کے لیے ${currency} ${remaining.toLocaleString()} باقی — ~${months} مہینے (منافع کا 20% بچائیں)`);
      }
    });

    return tips;
  }, [stats, settings, savingsTargets, currency]);

  const cards = [
    { label: 'Monthly Revenue', value: stats.totalRevenue, icon: DollarSign, color: 'text-emerald-600' },
    { label: 'Gross Profit', value: stats.grossProfit, icon: TrendingUp, color: 'text-blue-600' },
    { label: 'Total Expenses', value: stats.totalExp, icon: TrendingDown, color: 'text-destructive' },
    { label: 'Net Profit', value: stats.netProfit, icon: Wallet, color: stats.netProfit >= 0 ? 'text-emerald-600' : 'text-destructive' },
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Accounting & Budget</h1>
          <p className="text-sm text-muted-foreground">مکمل حساب کتاب — AI سے بجٹ مشورے</p>
        </div>
        <Button variant="outline" onClick={() => exportAccountingPDF(stats, settings, suggestions)}>
          <FileText className="w-4 h-4 mr-2" /> PDF Report
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <div key={c.label} className="bg-card rounded-2xl border border-border p-5">
            <div className="flex items-center gap-2 mb-2">
              <c.icon className={`w-5 h-5 ${c.color}`} />
              <span className="text-xs text-muted-foreground">{c.label}</span>
            </div>
            <p className={`text-xl font-bold ${c.color}`}>{currency} {c.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Budget vs Actual + Assets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><Target className="w-5 h-5 text-primary" /> Budget vs Actual</h2>
          <div className="space-y-3">
            <BudgetBar label="Home Expenses" actual={stats.homeExp} budget={settings.monthlyHomeExpenseBudget} currency={currency} />
            <BudgetBar label="Shop Expenses" actual={stats.shopExp} budget={settings.monthlyShopExpenseBudget} currency={currency} />
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><Wallet className="w-5 h-5 text-primary" /> Assets Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Account Balances</span><span className="font-semibold">{currency} {stats.totalAccountBalance.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Receivable (Udhar)</span><span className="font-semibold text-amber-600">{currency} {stats.totalReceivable.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Khata Net</span><span className={`font-semibold ${stats.khataNet >= 0 ? 'text-destructive' : 'text-emerald-600'}`}>{currency} {Math.abs(stats.khataNet).toLocaleString()} {stats.khataNet >= 0 ? '(دینا)' : '(لینا)'}</span></div>
            <hr className="border-border" />
            <div className="flex justify-between"><span className="font-semibold">Inventory Value</span><span className="font-bold">{currency} {stats.inventoryValue.toLocaleString()}</span></div>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      {stats.monthTxns.length > 0 && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold">Recent Transactions (This Month)</h2>
          </div>
          <div className="overflow-auto max-h-[300px]">
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="text-left p-3 font-medium">Date</th>
                  <th className="text-left p-3 font-medium">Account</th>
                  <th className="text-left p-3 font-medium">Category</th>
                  <th className="text-left p-3 font-medium">Description</th>
                  <th className="text-right p-3 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {stats.monthTxns.slice().reverse().slice(0, 20).map(t => (
                  <tr key={t.id} className="border-t border-border hover:bg-muted/30">
                    <td className="p-3 text-xs">{t.date}</td>
                    <td className="p-3 text-xs font-medium">{t.accountName}</td>
                    <td className="p-3"><span className="text-xs px-2 py-0.5 rounded-full bg-muted">{t.category}</span></td>
                    <td className="p-3 text-xs">{t.description}</td>
                    <td className={`p-3 text-right font-mono font-semibold ${t.type === 'credit' ? 'text-emerald-600' : 'text-destructive'}`}>
                      {t.type === 'credit' ? '+' : '-'}{currency} {t.amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AI Suggestions */}
      <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
        <h2 className="font-semibold flex items-center gap-2"><Lightbulb className="w-5 h-5 text-amber-500" /> AI Budget Advisor</h2>
        <div className="space-y-2">
          {suggestions.map((tip, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-muted/50 text-sm" style={{ fontFamily: tip.includes('ا') ? `'Jameel Noori Nastaleeq', serif` : 'inherit' }}>
              {tip}
            </div>
          ))}
        </div>
      </div>

      {/* Savings Targets */}
      {savingsTargets.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
          <h2 className="font-semibold flex items-center gap-2"><Target className="w-5 h-5 text-primary" /> Savings Goals</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {savingsTargets.map(t => {
              const pct = t.targetAmount > 0 ? (t.savedAmount / t.targetAmount) * 100 : 0;
              return (
                <div key={t.id} className="p-4 rounded-xl bg-muted/30 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{t.title}</span>
                    <span>{currency} {t.savedAmount.toLocaleString()} / {t.targetAmount.toLocaleString()}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground">{pct.toFixed(1)}% complete</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function BudgetBar({ label, actual, budget, currency }: { label: string; actual: number; budget: number; currency: string }) {
  const pct = budget > 0 ? (actual / budget) * 100 : 0;
  const over = actual > budget && budget > 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className={over ? 'text-destructive font-semibold' : ''}>
          {currency} {actual.toLocaleString()} / {budget > 0 ? `${currency} ${budget.toLocaleString()}` : 'No budget set'}
        </span>
      </div>
      {budget > 0 && (
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${over ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
      )}
    </div>
  );
}
