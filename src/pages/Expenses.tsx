import { useState, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { Plus, Wallet, Home, Store, Target, TrendingUp, Lightbulb, Trash2, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { format, parseISO, isThisMonth, isThisWeek, isToday } from 'date-fns';
import { exportExpensesPDF } from '@/lib/pdfExport';
import type { ExpenseCategory } from '@/types';

const EXPENSE_LABELS: Record<ExpenseCategory, string[]> = {
  home: ['Rent', 'Electricity', 'Gas', 'Water', 'Groceries', 'School Fee', 'Medical', 'Transport', 'Internet', 'Other'],
  shop: ['Shop Rent', 'Electricity', 'Staff Salary', 'Tea/Snacks', 'Transport', 'Packaging', 'Maintenance', 'Internet', 'Other'],
};

export default function Expenses() {
  const { expenses, sales, settings, addExpense, deleteExpense, savingsTargets, addSavingsTarget, deleteSavingsTarget } = useStore();

  const [showForm, setShowForm] = useState(false);
  const [showTargetForm, setShowTargetForm] = useState(false);
  const [category, setCategory] = useState<ExpenseCategory>('shop');
  const [label, setLabel] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [targetTitle, setTargetTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');

  const activeSales = sales.filter(s => !s.deleted);
  const monthSales = activeSales.filter(s => isThisMonth(parseISO(s.createdAt)));
  const monthRevenue = monthSales.reduce((sum, s) => sum + s.total, 0);

  const monthExpenses = expenses.filter(e => isThisMonth(parseISO(e.date)));
  const todayExpenses = expenses.filter(e => isToday(parseISO(e.date)));
  const weekExpenses = expenses.filter(e => isThisWeek(parseISO(e.date)));

  const homeExpenses = monthExpenses.filter(e => e.category === 'home');
  const shopExpenses = monthExpenses.filter(e => e.category === 'shop');

  const totalHome = homeExpenses.reduce((s, e) => s + e.amount, 0);
  const totalShop = shopExpenses.reduce((s, e) => s + e.amount, 0);
  const totalMonth = totalHome + totalShop;
  const todayTotal = todayExpenses.reduce((s, e) => s + e.amount, 0);
  const weekTotal = weekExpenses.reduce((s, e) => s + e.amount, 0);
  const netProfit = monthRevenue - totalMonth;

  // AI Budget Suggestions (offline logic)
  const suggestions = useMemo(() => {
    const tips: string[] = [];
    const dailyAvg = totalMonth / Math.max(new Date().getDate(), 1);

    if (totalHome > settings.monthlyHomeExpenseBudget && settings.monthlyHomeExpenseBudget > 0) {
      tips.push(`⚠️ Home expenses (${settings.currency} ${totalHome.toLocaleString()}) exceeded your budget of ${settings.currency} ${settings.monthlyHomeExpenseBudget.toLocaleString()}`);
    }
    if (totalShop > settings.monthlyShopExpenseBudget && settings.monthlyShopExpenseBudget > 0) {
      tips.push(`⚠️ Shop expenses (${settings.currency} ${totalShop.toLocaleString()}) exceeded your budget of ${settings.currency} ${settings.monthlyShopExpenseBudget.toLocaleString()}`);
    }
    if (monthRevenue > 0 && totalMonth > monthRevenue * 0.7) {
      tips.push(`📊 Expenses are ${((totalMonth / monthRevenue) * 100).toFixed(0)}% of revenue. Try to keep under 60%.`);
    }
    if (netProfit > 0) {
      tips.push(`✅ Net profit this month: ${settings.currency} ${netProfit.toLocaleString()}`);
    } else if (monthRevenue > 0) {
      tips.push(`❌ You're in loss this month: ${settings.currency} ${Math.abs(netProfit).toLocaleString()}`);
    }
    if (dailyAvg > 0 && monthRevenue > 0) {
      const monthlySavings = monthRevenue - totalMonth;
      tips.push(`💰 Estimated monthly savings: ${settings.currency} ${Math.max(0, monthlySavings).toLocaleString()}`);
    }

    // Savings target advice
    savingsTargets.forEach(t => {
      const remaining = t.targetAmount - t.savedAmount;
      if (remaining > 0 && netProfit > 0) {
        const monthsNeeded = Math.ceil(remaining / Math.max(netProfit, 1));
        tips.push(`🎯 "${t.title}": Need ${settings.currency} ${remaining.toLocaleString()} more. At current savings rate, ~${monthsNeeded} month(s) needed.`);
      }
    });

    return tips;
  }, [expenses, sales, settings, savingsTargets, totalHome, totalShop, monthRevenue, netProfit, totalMonth]);

  const handleSave = () => {
    const finalLabel = label === 'Other' ? customLabel : label;
    if (!finalLabel || !amount) return;
    addExpense({
      category,
      label: finalLabel,
      amount: parseFloat(amount),
      description,
      date,
    });
    setShowForm(false);
    setLabel('');
    setCustomLabel('');
    setAmount('');
    setDescription('');
  };

  const handleSaveTarget = () => {
    if (!targetTitle || !targetAmount) return;
    addSavingsTarget({ title: targetTitle, targetAmount: parseFloat(targetAmount), savedAmount: 0 });
    setShowTargetForm(false);
    setTargetTitle('');
    setTargetAmount('');
  };

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Wallet className="w-6 h-6" /> Expenses & Budget</h1>
          <p className="text-sm text-muted-foreground">Track home & shop expenses, set savings targets</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportExpensesPDF(monthExpenses, settings, suggestions)}><FileText className="w-4 h-4 mr-2" /> PDF Report</Button>
          <Button variant="outline" onClick={() => setShowTargetForm(true)}><Target className="w-4 h-4 mr-2" /> Set Target</Button>
          <Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-2" /> Add Expense</Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Month Revenue</p>
          <p className="text-lg font-bold text-primary">{settings.currency} {monthRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Home className="w-3 h-3" /> Home Expenses</p>
          <p className="text-lg font-bold text-orange-600">{settings.currency} {totalHome.toLocaleString()}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Store className="w-3 h-3" /> Shop Expenses</p>
          <p className="text-lg font-bold text-red-600">{settings.currency} {totalShop.toLocaleString()}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Today</p>
          <p className="text-lg font-bold">{settings.currency} {todayTotal.toLocaleString()}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Net Profit</p>
          <p className={`text-lg font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {settings.currency} {netProfit.toLocaleString()}
          </p>
        </div>
      </div>

      {/* AI Suggestions */}
      {suggestions.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <h3 className="font-bold text-sm flex items-center gap-2 mb-2"><Lightbulb className="w-4 h-4 text-amber-600" /> AI Budget Advisor</h3>
          <div className="space-y-1">
            {suggestions.map((tip, i) => (
              <p key={i} className="text-sm">{tip}</p>
            ))}
          </div>
        </div>
      )}

      {/* Savings Targets */}
      {savingsTargets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {savingsTargets.map(t => {
            const pct = Math.min(100, (t.savedAmount / t.targetAmount) * 100);
            return (
              <div key={t.id} className="bg-card rounded-xl border border-border p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-sm flex items-center gap-1"><Target className="w-3.5 h-3.5" /> {t.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {settings.currency} {t.savedAmount.toLocaleString()} / {settings.currency} {t.targetAmount.toLocaleString()}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => deleteSavingsTarget(t.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
                <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[10px] text-right mt-1 text-muted-foreground">{pct.toFixed(1)}%</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Expense Lists */}
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All ({monthExpenses.length})</TabsTrigger>
          <TabsTrigger value="home">Home ({homeExpenses.length})</TabsTrigger>
          <TabsTrigger value="shop">Shop ({shopExpenses.length})</TabsTrigger>
        </TabsList>

        {(['all', 'home', 'shop'] as const).map(tab => (
          <TabsContent key={tab} value={tab} className="mt-4">
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3 font-medium">Date</th>
                    <th className="text-left p-3 font-medium">Type</th>
                    <th className="text-left p-3 font-medium">Label</th>
                    <th className="text-left p-3 font-medium">Description</th>
                    <th className="text-right p-3 font-medium">Amount</th>
                    <th className="text-center p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(tab === 'all' ? monthExpenses : tab === 'home' ? homeExpenses : shopExpenses)
                    .slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map(e => (
                      <tr key={e.id} className="border-t border-border hover:bg-muted/30">
                        <td className="p-3 text-xs">{format(parseISO(e.date), 'dd MMM yyyy')}</td>
                        <td className="p-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${e.category === 'home' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                            {e.category === 'home' ? '🏠 Home' : '🏪 Shop'}
                          </span>
                        </td>
                        <td className="p-3 font-medium">{e.label}</td>
                        <td className="p-3 text-xs text-muted-foreground">{e.description || '-'}</td>
                        <td className="p-3 text-right font-semibold">{settings.currency} {e.amount.toLocaleString()}</td>
                        <td className="p-3 text-center">
                          <Button variant="ghost" size="sm" onClick={() => deleteExpense(e.id)}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  {monthExpenses.length === 0 && (
                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No expenses this month</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Add Expense Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Expense</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={v => { setCategory(v as ExpenseCategory); setLabel(''); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="home">🏠 Home Expense</SelectItem>
                  <SelectItem value="shop">🏪 Shop Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Expense Type</Label>
              <Select value={label} onValueChange={setLabel}>
                <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_LABELS[category].map(l => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {label === 'Other' && (
              <div><Label>Custom Label</Label><Input value={customLabel} onChange={e => setCustomLabel(e.target.value)} placeholder="Enter custom label..." /></div>
            )}
            <div><Label>Amount ({settings.currency})</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} /></div>
            <div><Label>Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
            <div><Label>Description (optional)</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} /></div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!label || !amount}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Savings Target Dialog */}
      <Dialog open={showTargetForm} onOpenChange={setShowTargetForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Set Savings Target</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Target Title</Label><Input value={targetTitle} onChange={e => setTargetTitle(e.target.value)} placeholder="e.g. Buy Car, House Down Payment..." /></div>
            <div><Label>Target Amount ({settings.currency})</Label><Input type="number" value={targetAmount} onChange={e => setTargetAmount(e.target.value)} /></div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowTargetForm(false)}>Cancel</Button>
            <Button onClick={handleSaveTarget} disabled={!targetTitle || !targetAmount}>Save Target</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
