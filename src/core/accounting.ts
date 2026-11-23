/**
 * Accounting derived from actual transactions (pure, unit tested).
 * Nothing here is stored – cash book, ledgers and P&L are always recomputed
 * from sales, returns, payments, purchases, expenses and manual cash entries,
 * so they can never drift from the underlying records.
 */
import type {
  CashEntry, CreditEntry, Customer, Expense, KhataEntry, PaymentMethod, Product, Purchase, Sale,
  SalePayment, StockAdjustment, Supplier, SupplierPayment,
} from '@/types';
import { costPerBaseUnit, itemBaseQty, round2 } from './inventory';

export const CASH_METHODS: PaymentMethod[] = ['Cash'];
/** Payment methods that don't move money (exchange credit). */
export const NON_MONEY_METHODS: PaymentMethod[] = ['Exchange'];

export const isLive = (s: Sale) => !s.deleted;
export const isReturn = (s: Sale) => s.kind === 'return';

/** Payments actually received for a sale (split-payment aware, legacy compatible). */
export function salePayments(s: Sale): SalePayment[] {
  if (s.payments && s.payments.length > 0) return s.payments;
  if (!s.amountPaid) return [];
  return [{ method: s.paymentMethod, amount: s.amountPaid }];
}

/** Cost of goods for a sale line: captured at sale time, else estimated from current product cost. */
export function lineCost(item: Sale['items'][number], products?: Product[]): number {
  if (typeof item.costTotal === 'number') return item.costTotal;
  const p = products?.find(pr => pr.id === item.productId) || item.product;
  return round2(Math.abs(itemBaseQty(item)) * costPerBaseUnit(p, item.color)) * Math.sign(item.quantity || 1);
}

export interface DateRange { from?: string; to?: string } // inclusive yyyy-MM-dd
export const inRange = (iso: string, r: DateRange = {}) => {
  const d = iso.slice(0, 10);
  return (!r.from || d >= r.from) && (!r.to || d <= r.to);
};
const localDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const todayKey = () => localDay(new Date().toISOString());
export const dayOf = localDay;

export interface CashBookEntry {
  id: string;
  date: string;
  direction: 'in' | 'out';
  amount: number;
  method: PaymentMethod;
  source: 'sale' | 'return' | 'receipt' | 'expense' | 'supplier' | 'purchase' | 'manual';
  description: string;
  refId?: string;
}

export interface BookInput {
  sales: Sale[];
  credits: CreditEntry[];
  expenses: Expense[];
  purchases?: Purchase[];
  supplierPayments?: SupplierPayment[];
  cashEntries?: CashEntry[];
}

/** Every money movement, newest last. */
export function cashBook(input: BookInput, range: DateRange = {}): CashBookEntry[] {
  const out: CashBookEntry[] = [];
  for (const s of input.sales.filter(isLive)) {
    for (const [i, p] of salePayments(s).entries()) {
      if (NON_MONEY_METHODS.includes(p.method) || !p.amount) continue;
      out.push({
        id: `${s.id}:${i}`, date: s.createdAt, amount: Math.abs(p.amount), method: p.method,
        direction: p.amount >= 0 ? 'in' : 'out', source: isReturn(s) ? 'return' : 'sale',
        description: `${isReturn(s) ? 'Refund' : 'Sale'} ${s.invoiceNumber}${s.customerName ? ` – ${s.customerName}` : ''}`,
        refId: s.id,
      });
    }
  }
  for (const c of input.credits) {
    for (const p of c.payments) {
      if (NON_MONEY_METHODS.includes(p.method)) continue;
      out.push({
        id: p.id, date: p.date, amount: p.amount, method: p.method, direction: 'in', source: 'receipt',
        description: `Udhar received – ${c.customerName} (${c.invoiceNumber})`, refId: c.id,
      });
    }
  }
  for (const e of input.expenses) {
    out.push({
      id: e.id, date: e.date.length === 10 ? `${e.date}T12:00:00` : e.date, amount: e.amount, method: 'Cash',
      direction: 'out', source: 'expense', description: `${e.category === 'home' ? 'Home' : 'Shop'} expense – ${e.label}`,
    });
  }
  for (const p of input.purchases || []) {
    if (p.paid > 0) out.push({
      id: p.id, date: p.createdAt, amount: p.paid, method: p.paymentMethod, direction: 'out', source: 'purchase',
      description: `Purchase ${p.purchaseNumber} – ${p.supplierName}`, refId: p.id,
    });
  }
  for (const sp of input.supplierPayments || []) {
    out.push({
      id: sp.id, date: sp.date, amount: sp.amount, method: sp.method, direction: 'out', source: 'supplier',
      description: `Supplier payment – ${sp.supplierName}${sp.note ? ` (${sp.note})` : ''}`, refId: sp.supplierId,
    });
  }
  for (const c of input.cashEntries || []) {
    out.push({
      id: c.id, date: c.date.length === 10 ? `${c.date}T12:00:00` : c.date, amount: c.amount, method: c.method,
      direction: c.type, source: 'manual', description: `${c.category}${c.description ? ` – ${c.description}` : ''}`,
    });
  }
  return out.filter(e => inRange(localDay(e.date), range)).sort((a, b) => a.date.localeCompare(b.date));
}

export function cashTotals(entries: CashBookEntry[], methods?: PaymentMethod[]) {
  const sel = methods ? entries.filter(e => methods.includes(e.method)) : entries;
  const cashIn = round2(sel.filter(e => e.direction === 'in').reduce((s, e) => s + e.amount, 0));
  const cashOut = round2(sel.filter(e => e.direction === 'out').reduce((s, e) => s + e.amount, 0));
  return { cashIn, cashOut, net: round2(cashIn - cashOut) };
}

export interface ProfitLoss {
  grossSales: number;
  returns: number;
  discounts: number;
  netSales: number;
  cogs: number;
  grossProfit: number;
  shopExpenses: number;
  stockLosses: number;
  netProfit: number;
  homeExpenses: number;
  marginPct: number;
}

export function profitAndLoss(
  input: { sales: Sale[]; expenses: Expense[]; stockAdjustments?: StockAdjustment[]; products?: Product[] },
  range: DateRange = {},
): ProfitLoss {
  const sales = input.sales.filter(s => isLive(s) && inRange(localDay(s.createdAt), range));
  const grossSales = round2(sales.filter(s => !isReturn(s)).reduce((a, s) => a + s.subtotal, 0));
  const discounts = round2(sales.filter(s => !isReturn(s)).reduce((a, s) => a + s.discountAmount, 0));
  const returns = round2(-sales.filter(isReturn).reduce((a, s) => a + s.total, 0));
  const netSales = round2(grossSales - discounts - returns);
  const cogs = round2(sales.reduce((a, s) => a + s.items.reduce((b, it) => b + lineCost(it, input.products), 0), 0));
  const exp = input.expenses.filter(e => inRange(e.date.slice(0, 10), range));
  const shopExpenses = round2(exp.filter(e => e.category === 'shop').reduce((a, e) => a + e.amount, 0));
  const homeExpenses = round2(exp.filter(e => e.category === 'home').reduce((a, e) => a + e.amount, 0));
  const stockLosses = round2((input.stockAdjustments || [])
    .filter(a => inRange(localDay(a.createdAt), range) && ['damaged', 'lost', 'correction_remove'].includes(a.type))
    .reduce((s, a) => s + a.costValue, 0));
  const grossProfit = round2(netSales - cogs);
  const netProfit = round2(grossProfit - shopExpenses - stockLosses);
  return {
    grossSales, returns, discounts, netSales, cogs, grossProfit, shopExpenses, stockLosses, netProfit, homeExpenses,
    marginPct: netSales ? round2((grossProfit / netSales) * 100) : 0,
  };
}

export interface LedgerLine { id: string; date: string; description: string; debit: number; credit: number; balance: number }

/** Customer ledger: debit = customer owes us more, credit = customer paid. */
export function customerLedger(
  customer: Customer,
  data: { sales: Sale[]; credits: CreditEntry[]; khataEntries: KhataEntry[] },
): LedgerLine[] {
  const rows: Omit<LedgerLine, 'balance'>[] = [];
  if (customer.openingBalance) rows.push({ id: `open-${customer.id}`, date: customer.createdAt, description: 'Opening balance', debit: Math.max(0, customer.openingBalance), credit: Math.max(0, -customer.openingBalance) });
  for (const s of data.sales.filter(x => isLive(x) && x.customerId === customer.id)) {
    if (isReturn(s)) {
      rows.push({ id: s.id, date: s.createdAt, description: `Return ${s.invoiceNumber}`, debit: 0, credit: Math.abs(s.total) });
      const refunded = salePayments(s).reduce((a, p) => a + Math.abs(p.amount), 0);
      if (refunded) rows.push({ id: `${s.id}-r`, date: s.createdAt, description: `Refund ${s.invoiceNumber}`, debit: refunded, credit: 0 });
    } else {
      rows.push({ id: s.id, date: s.createdAt, description: `Invoice ${s.invoiceNumber}`, debit: s.total, credit: 0 });
      const paid = salePayments(s).reduce((a, p) => a + p.amount, 0);
      if (paid) rows.push({ id: `${s.id}-p`, date: s.createdAt, description: `Paid at sale ${s.invoiceNumber}`, debit: 0, credit: paid });
    }
  }
  for (const c of data.credits.filter(x => x.customerId === customer.id)) {
    // 'Exchange' payments are return adjustments already represented by the return row
    for (const p of c.payments.filter(x => x.method !== 'Exchange')) rows.push({ id: p.id, date: p.date, description: `Payment received (${c.invoiceNumber}) ${p.method}${p.note ? ` – ${p.note}` : ''}`, debit: 0, credit: p.amount });
  }
  for (const k of data.khataEntries.filter(x => x.customerId === customer.id)) {
    rows.push({ id: k.id, date: k.date || k.createdAt, description: `Khata: ${k.description}`, debit: k.type === 'give' ? k.amount : 0, credit: k.type === 'take' ? k.amount : 0 });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  let bal = 0;
  return rows.map(r => { bal = round2(bal + r.debit - r.credit); return { ...r, balance: bal }; });
}

/** Supplier ledger: credit = we owe supplier more, debit = we paid. Balance = payable. */
export function supplierLedger(
  supplier: Supplier,
  data: { purchases: Purchase[]; supplierPayments: SupplierPayment[] },
): LedgerLine[] {
  const rows: Omit<LedgerLine, 'balance'>[] = [];
  if (supplier.openingBalance) rows.push({ id: `open-${supplier.id}`, date: supplier.createdAt, description: 'Opening balance', debit: 0, credit: supplier.openingBalance });
  for (const p of data.purchases.filter(x => x.supplierId === supplier.id)) {
    rows.push({ id: p.id, date: p.createdAt, description: `Purchase ${p.purchaseNumber}`, debit: 0, credit: p.total });
    if (p.paid) rows.push({ id: `${p.id}-p`, date: p.createdAt, description: `Paid with purchase ${p.purchaseNumber}`, debit: p.paid, credit: 0 });
  }
  for (const sp of data.supplierPayments.filter(x => x.supplierId === supplier.id)) {
    rows.push({ id: sp.id, date: sp.date, description: `Payment ${sp.method}${sp.note ? ` – ${sp.note}` : ''}`, debit: sp.amount, credit: 0 });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  let bal = 0;
  return rows.map(r => { bal = round2(bal + r.credit - r.debit); return { ...r, balance: bal }; });
}

/** Number → English words (Pakistani system: thousand, lakh, crore). */
export function amountInWords(n: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (x: number) => (x < 20 ? ones[x] : `${tens[Math.floor(x / 10)]}${x % 10 ? ` ${ones[x % 10]}` : ''}`);
  const three = (x: number) => (x >= 100 ? `${ones[Math.floor(x / 100)]} Hundred${x % 100 ? ` ${two(x % 100)}` : ''}` : two(x));
  let v = Math.floor(Math.abs(n));
  if (v === 0) return 'Zero Only';
  const parts: string[] = [];
  const crore = Math.floor(v / 10000000); v %= 10000000;
  const lakh = Math.floor(v / 100000); v %= 100000;
  const thousand = Math.floor(v / 1000); v %= 1000;
  if (crore) parts.push(`${three(crore)} Crore`);
  if (lakh) parts.push(`${two(lakh)} Lakh`);
  if (thousand) parts.push(`${two(thousand)} Thousand`);
  if (v) parts.push(three(v));
  return `${n < 0 ? 'Minus ' : ''}${parts.join(' ')} Only`;
}
