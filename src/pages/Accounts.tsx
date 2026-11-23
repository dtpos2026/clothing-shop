import { useState, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { Plus, Trash2, ArrowUpCircle, ArrowDownCircle, Wallet, Building2, Smartphone, CreditCard, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { exportAccountsReportPDF } from '@/lib/pdfExport';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Account } from '@/types';

const typeIcons = {
  bank: Building2,
  cash: Wallet,
  wallet: Smartphone,
  other: CreditCard,
};

export default function Accounts() {
  const { accounts, accountTransactions, addAccount, deleteAccount, addAccountTransaction, settings } = useStore();
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showAddTxn, setShowAddTxn] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [accForm, setAccForm] = useState({ name: '', type: 'bank' as Account['type'], accountNumber: '', bankName: '', notes: '' });
  const [txnForm, setTxnForm] = useState({ accountId: '', type: 'credit' as 'credit' | 'debit', amount: 0, category: '', description: '' });

  const totalBalance = useMemo(() => accounts.reduce((s, a) => s + a.balance, 0), [accounts]);

  const filteredTxns = useMemo(() => {
    if (!selectedAccount || selectedAccount === 'all') return accountTransactions;
    return accountTransactions.filter(t => t.accountId === selectedAccount);
  }, [accountTransactions, selectedAccount]);

  const handleAddAccount = () => {
    if (!accForm.name.trim()) return;
    addAccount({ ...accForm, balance: 0, active: true });
    setAccForm({ name: '', type: 'bank', accountNumber: '', bankName: '', notes: '' });
    setShowAddAccount(false);
  };

  const handleAddTxn = () => {
    if (!txnForm.accountId || !txnForm.amount || !txnForm.category) return;
    const acc = accounts.find(a => a.id === txnForm.accountId);
    addAccountTransaction({
      ...txnForm,
      accountName: acc?.name || '',
      date: new Date().toISOString().split('T')[0],
    });
    setTxnForm({ accountId: '', type: 'credit', amount: 0, category: '', description: '' });
    setShowAddTxn(false);
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Accounts</h1>
          <p className="text-sm text-muted-foreground">{accounts.length} accounts · Total: {settings.currency} {totalBalance.toLocaleString()}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportAccountsReportPDF(accounts, accountTransactions, settings)}>
            <FileText className="w-4 h-4 mr-2" /> PDF Report
          </Button>
          <Button variant="outline" onClick={() => setShowAddTxn(true)}><Plus className="w-4 h-4 mr-2" /> Transaction</Button>
          <Button onClick={() => setShowAddAccount(true)}><Plus className="w-4 h-4 mr-2" /> Add Account</Button>
        </div>
      </div>

      {/* Account Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {accounts.map(acc => {
          const Icon = typeIcons[acc.type] || Wallet;
          return (
            <div key={acc.id} className="bg-card rounded-2xl border border-border p-5 space-y-3 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{acc.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{acc.type}{acc.accountNumber ? ` · ${acc.accountNumber}` : ''}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { if (confirm('Delete account?')) deleteAccount(acc.id); }}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
              <p className="text-2xl font-bold">{settings.currency} {acc.balance.toLocaleString()}</p>
            </div>
          );
        })}
        {accounts.length === 0 && (
          <div className="col-span-4 text-center py-12 text-muted-foreground">No accounts yet. Add your first account.</div>
        )}
      </div>

      {/* Transaction History */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold">Transaction History</h2>
          <Select value={selectedAccount || 'all'} onValueChange={setSelectedAccount}>
            <SelectTrigger className="w-48"><SelectValue placeholder="All Accounts" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Accounts</SelectItem>
              {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-auto max-h-[400px]">
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
              {filteredTxns.slice().reverse().map(t => (
                <tr key={t.id} className="border-t border-border hover:bg-muted/30">
                  <td className="p-3 text-xs">{t.date}</td>
                  <td className="p-3 text-xs font-medium">{t.accountName}</td>
                  <td className="p-3"><span className="text-xs px-2 py-0.5 rounded-full bg-muted">{t.category}</span></td>
                  <td className="p-3 text-xs">{t.description}</td>
                  <td className={`p-3 text-right font-mono font-semibold ${t.type === 'credit' ? 'text-emerald-600' : 'text-destructive'}`}>
                    {t.type === 'credit' ? '+' : '-'}{settings.currency} {t.amount.toLocaleString()}
                  </td>
                </tr>
              ))}
              {filteredTxns.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No transactions yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Account Dialog */}
      <Dialog open={showAddAccount} onOpenChange={setShowAddAccount}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Account</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Account Name</Label><Input placeholder="e.g. Meezan Bank" value={accForm.name} onChange={e => setAccForm({ ...accForm, name: e.target.value })} /></div>
            <div>
              <Label>Type</Label>
              <Select value={accForm.type} onValueChange={v => setAccForm({ ...accForm, type: v as Account['type'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">Bank Account</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="wallet">Mobile Wallet (JazzCash/Easypaisa)</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Account Number (optional)</Label><Input value={accForm.accountNumber} onChange={e => setAccForm({ ...accForm, accountNumber: e.target.value })} /></div>
            <div><Label>Notes</Label><Textarea value={accForm.notes} onChange={e => setAccForm({ ...accForm, notes: e.target.value })} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddAccount(false)}>Cancel</Button>
              <Button onClick={handleAddAccount} disabled={!accForm.name.trim()}>Add Account</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Transaction Dialog */}
      <Dialog open={showAddTxn} onOpenChange={setShowAddTxn}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Transaction</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Account</Label>
              <Select value={txnForm.accountId} onValueChange={v => setTxnForm({ ...txnForm, accountId: v })}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Type</Label>
              <div className="flex gap-2 mt-1">
                <Button variant={txnForm.type === 'credit' ? 'default' : 'outline'} size="sm" onClick={() => setTxnForm({ ...txnForm, type: 'credit' })} className="flex-1">
                  <ArrowDownCircle className="w-4 h-4 mr-1" /> Money In
                </Button>
                <Button variant={txnForm.type === 'debit' ? 'default' : 'outline'} size="sm" onClick={() => setTxnForm({ ...txnForm, type: 'debit' })} className="flex-1">
                  <ArrowUpCircle className="w-4 h-4 mr-1" /> Money Out
                </Button>
              </div>
            </div>
            <div><Label>Amount</Label><Input type="number" value={txnForm.amount || ''} onChange={e => setTxnForm({ ...txnForm, amount: parseFloat(e.target.value) || 0 })} /></div>
            <div>
              <Label>Category</Label>
              <Select value={txnForm.category} onValueChange={v => setTxnForm({ ...txnForm, category: v })}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {['Sale', 'Expense', 'Transfer', 'Salary', 'Rent', 'Personal', 'Udhar Recovery', 'Loan', 'Meal & Dinner', 'Guest', 'Shopping', 'Utility Bills', 'Other'].map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Description</Label><Input value={txnForm.description} onChange={e => setTxnForm({ ...txnForm, description: e.target.value })} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddTxn(false)}>Cancel</Button>
              <Button onClick={handleAddTxn} disabled={!txnForm.accountId || !txnForm.amount || !txnForm.category}>Add Transaction</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
