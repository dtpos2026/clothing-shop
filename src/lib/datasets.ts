/**
 * Every exportable dataset as a TableSpec, shared by the Export Center, statements and ZIP export.
 */
import { format, parseISO } from 'date-fns';
import type { BusinessData } from '@/store/useStore';
import type { Customer, Supplier } from '@/types';
import type { TableSpec } from './exporters';
import { cashBook, customerLedger, inRange, isReturn, profitAndLoss, salePayments, supplierLedger, type DateRange, dayOf, lineCost } from '@/core/accounting';
import { baseUnit, costPerBaseUnit, effectiveSellUnit, inventoryValuation, isMeterProduct, round2, unitLabel, unitPriceFor } from '@/core/inventory';

const d = (iso: string) => (iso ? format(parseISO(iso.length === 10 ? `${iso}T00:00:00` : iso), 'dd/MM/yyyy') : '');
const dt = (iso: string) => (iso ? format(parseISO(iso), 'dd/MM/yyyy HH:mm') : '');
const rangeText = (r: DateRange) => (r.from || r.to ? `${r.from ? d(r.from) : 'start'} – ${r.to ? d(r.to) : 'today'}` : 'All dates');

export type DatasetId =
  | 'products' | 'inventory' | 'rolls' | 'customers' | 'suppliers' | 'sales' | 'saleItems' | 'returns'
  | 'purchases' | 'expenses' | 'cashbook' | 'profitloss' | 'udhar' | 'adjustments';

export const DATASETS: { id: DatasetId; name: string; dated: boolean }[] = [
  { id: 'products', name: 'Products', dated: false },
  { id: 'inventory', name: 'Inventory & valuation', dated: false },
  { id: 'rolls', name: 'Fabric rolls (Thaan)', dated: false },
  { id: 'customers', name: 'Customers & balances', dated: false },
  { id: 'suppliers', name: 'Suppliers & payables', dated: false },
  { id: 'sales', name: 'Sales (invoices)', dated: true },
  { id: 'saleItems', name: 'Sales – item lines', dated: true },
  { id: 'returns', name: 'Returns', dated: true },
  { id: 'purchases', name: 'Purchases', dated: true },
  { id: 'expenses', name: 'Expenses', dated: true },
  { id: 'cashbook', name: 'Cash book', dated: true },
  { id: 'profitloss', name: 'Profit & Loss', dated: true },
  { id: 'udhar', name: 'Udhar / receivables', dated: false },
  { id: 'adjustments', name: 'Stock adjustments / damage', dated: true },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildDataset(id: DatasetId, data: BusinessData, range: DateRange = {}): TableSpec<any> {
  const cur = data.settings.currency;
  const live = data.sales.filter(s => !s.deleted && inRange(dayOf(s.createdAt), range));
  switch (id) {
    case 'products':
      return {
        title: 'Products', columns: [
          { header: 'SKU', value: p => p.sku }, { header: 'Barcode', value: p => p.barcode || '' },
          { header: 'Brand', value: p => p.brand }, { header: 'Article', value: p => p.article }, { header: 'Design', value: p => p.design || '' },
          { header: 'Category', value: p => p.category }, { header: 'Type', value: p => p.productType }, { header: 'Fabric', value: p => p.fabricCategory },
          { header: 'Season', value: p => p.season }, { header: 'Stock mode', value: p => p.stockMode }, { header: 'Suit cut (m)', value: p => p.suitCutMeters, numeric: true },
          { header: 'Retail price', value: p => p.salePrice, numeric: true }, { header: 'Wholesale price', value: p => p.wholesalePrice ?? '', numeric: true },
          { header: 'Price / meter', value: p => (isMeterProduct(p) ? unitPriceFor(p, 'meter') : ''), numeric: true },
          { header: 'Cost price', value: p => p.costPrice, numeric: true }, { header: 'Active', value: p => (p.active ? 'Yes' : 'No') },
        ], rows: data.products, landscape: true,
      };
    case 'inventory': {
      const v = inventoryValuation(data.products);
      return {
        title: 'Inventory & Valuation', columns: [
          { header: 'SKU', value: p => p.sku }, { header: 'Product', value: p => `${p.brand} ${p.article}` },
          { header: 'Colours', value: p => p.colorStocks.map((c: { color: string; quantity: number }) => `${c.color}: ${c.quantity}`).join(', ') },
          { header: 'Stock', value: p => p.stockQty, numeric: true }, { header: 'Unit', value: p => unitLabel(baseUnit(p)) },
          { header: 'Thaans', value: p => (p.rolls || []).filter((r: { status: string }) => r.status === 'active').length || '', numeric: true },
          { header: 'Cost / unit', value: p => costPerBaseUnit(p), numeric: true },
          { header: 'Stock value (cost)', value: p => round2(p.stockQty * costPerBaseUnit(p)), numeric: true },
          { header: 'Retail value', value: p => round2(p.stockQty * (isMeterProduct(p) ? unitPriceFor(p, 'meter') : p.salePrice)), numeric: true },
          { header: 'Status', value: p => (p.stockQty <= 0 ? 'OUT' : p.stockQty <= p.lowStockThreshold ? 'LOW' : 'OK') },
        ],
        rows: data.products.filter(p => p.active),
        totals: { Product: 'TOTAL', 'Stock value (cost)': v.costValue, 'Retail value': v.retailValue },
        summary: [{ label: 'Total meters', value: `${v.units.meters} m` }, { label: 'Total pieces', value: `${v.units.pieces}` },
          { label: 'Value at cost', value: `${cur} ${v.costValue.toLocaleString()}` }, { label: 'Value at retail', value: `${cur} ${v.retailValue.toLocaleString()}` }],
      };
    }
    case 'rolls':
      return {
        title: 'Fabric Rolls (Thaan)', columns: [
          { header: 'Roll no.', value: r => r.rollNo }, { header: 'Product', value: r => r.product }, { header: 'Colour', value: r => r.color || '' },
          { header: 'Initial (m)', value: r => r.initialMeters, numeric: true }, { header: 'Remaining (m)', value: r => r.remainingMeters, numeric: true },
          { header: 'Cost / m', value: r => r.costPerMeter, numeric: true }, { header: 'Value', value: r => round2(r.remainingMeters * r.costPerMeter), numeric: true },
          { header: 'Supplier', value: r => r.supplierName || '' }, { header: 'Received', value: r => d(r.receivedAt) }, { header: 'Status', value: r => r.status },
        ],
        rows: data.products.flatMap(p => (p.rolls || []).map(r => ({ ...r, product: `${p.brand} ${p.article}` }))),
      };
    case 'customers':
      return {
        title: 'Customers', columns: [
          { header: 'Name', value: c => c.name }, { header: 'Phone', value: c => c.phone }, { header: 'Address', value: c => c.address || '' },
          { header: 'Invoices', value: c => data.sales.filter(s => !s.deleted && s.customerId === c.id && !isReturn(s)).length, numeric: true },
          { header: 'Total purchases', value: c => round2(data.sales.filter(s => !s.deleted && s.customerId === c.id).reduce((a, s) => a + s.total, 0)), numeric: true },
          { header: 'Balance due', value: c => { const l = customerLedger(c, data); return l.length ? l[l.length - 1].balance : 0; }, numeric: true },
          { header: 'Since', value: c => d(c.createdAt) },
        ], rows: data.customers,
      };
    case 'suppliers':
      return {
        title: 'Suppliers', columns: [
          { header: 'Name', value: s => s.name }, { header: 'Company', value: s => s.company || '' }, { header: 'Phone', value: s => s.phone },
          { header: 'Purchases', value: s => round2(data.purchases.filter(p => p.supplierId === s.id).reduce((a, p) => a + p.total, 0)), numeric: true },
          { header: 'Paid', value: s => round2(data.purchases.filter(p => p.supplierId === s.id).reduce((a, p) => a + p.paid, 0) + data.supplierPayments.filter(p => p.supplierId === s.id).reduce((a, p) => a + p.amount, 0)), numeric: true },
          { header: 'Payable', value: s => { const l = supplierLedger(s, data); return l.length ? l[l.length - 1].balance : 0; }, numeric: true },
        ], rows: data.suppliers,
      };
    case 'sales': {
      const rows = live.filter(s => !isReturn(s));
      return {
        title: 'Sales', subtitle: rangeText(range), columns: [
          { header: 'Invoice', value: s => s.invoiceNumber }, { header: 'Date', value: s => dt(s.createdAt) }, { header: 'Customer', value: s => s.customerName || 'Walk-in' },
          { header: 'Items', value: s => s.items.length, numeric: true }, { header: 'Subtotal', value: s => s.subtotal, numeric: true },
          { header: 'Discount', value: s => s.discountAmount, numeric: true }, { header: 'Total', value: s => s.total, numeric: true },
          { header: 'Paid', value: s => round2(salePayments(s).reduce((a, p) => a + p.amount, 0)), numeric: true },
          { header: 'Udhar', value: s => s.creditAmount, numeric: true },
          { header: 'Payment', value: s => salePayments(s).map(p => `${p.method} ${p.amount}`).join(' + ') || s.saleType },
          { header: 'Cashier', value: s => s.cashierName || '' },
        ], rows, landscape: true,
        totals: { Invoice: 'TOTAL', Subtotal: round2(rows.reduce((a, s) => a + s.subtotal, 0)), Discount: round2(rows.reduce((a, s) => a + s.discountAmount, 0)), Total: round2(rows.reduce((a, s) => a + s.total, 0)), Udhar: round2(rows.reduce((a, s) => a + s.creditAmount, 0)) },
      };
    }
    case 'saleItems': {
      const rows = live.flatMap(s => s.items.map(it => ({ s, it })));
      return {
        title: 'Sales – Item Lines', subtitle: rangeText(range), columns: [
          { header: 'Invoice', value: r => r.s.invoiceNumber }, { header: 'Date', value: r => d(r.s.createdAt) }, { header: 'SKU', value: r => r.it.product.sku },
          { header: 'Product', value: r => `${r.it.product.brand} ${r.it.product.article}` }, { header: 'Colour', value: r => r.it.color || '' },
          { header: 'Qty', value: r => r.it.quantity, numeric: true }, { header: 'Unit', value: r => unitLabel(effectiveSellUnit(r.it)) },
          { header: 'Rate', value: r => r.it.unitPrice, numeric: true }, { header: 'Line total', value: r => r.it.lineTotal, numeric: true },
          { header: 'Cost', value: r => lineCost(r.it, data.products), numeric: true },
          { header: 'Profit', value: r => round2(r.it.lineTotal - lineCost(r.it, data.products)), numeric: true },
        ], rows, landscape: true,
      };
    }
    case 'returns': {
      const rows = live.filter(isReturn);
      return {
        title: 'Returns', subtitle: rangeText(range), columns: [
          { header: 'Return no.', value: s => s.invoiceNumber }, { header: 'Against', value: s => s.returnOfInvoice || '' }, { header: 'Date', value: s => dt(s.createdAt) },
          { header: 'Customer', value: s => s.customerName || 'Walk-in' }, { header: 'Value', value: s => Math.abs(s.total), numeric: true },
          { header: 'Refund', value: s => salePayments(s).map(p => `${p.method} ${Math.abs(p.amount)}`).join(', ') || 'Adjusted in udhar' }, { header: 'Note', value: s => s.notes || '' },
        ], rows, totals: { 'Return no.': 'TOTAL', Value: round2(rows.reduce((a, s) => a + Math.abs(s.total), 0)) },
      };
    }
    case 'purchases': {
      const rows = data.purchases.filter(p => inRange(dayOf(p.createdAt), range));
      return {
        title: 'Purchases', subtitle: rangeText(range), columns: [
          { header: 'No.', value: p => p.purchaseNumber }, { header: 'Date', value: p => d(p.createdAt) }, { header: 'Supplier', value: p => p.supplierName },
          { header: 'Items', value: p => p.items.map((i: { productName: string; quantity: number; unit: string }) => `${i.productName} ${i.quantity}${i.unit === 'meter' ? 'm' : 'pc'}`).join('; ') },
          { header: 'Total', value: p => p.total, numeric: true }, { header: 'Paid', value: p => p.paid, numeric: true }, { header: 'Due', value: p => p.due, numeric: true },
        ], rows, totals: { 'No.': 'TOTAL', Total: round2(rows.reduce((a, p) => a + p.total, 0)), Paid: round2(rows.reduce((a, p) => a + p.paid, 0)), Due: round2(rows.reduce((a, p) => a + p.due, 0)) },
      };
    }
    case 'expenses': {
      const rows = data.expenses.filter(e => inRange(e.date.slice(0, 10), range));
      return {
        title: 'Expenses', subtitle: rangeText(range), columns: [
          { header: 'Date', value: e => d(e.date.slice(0, 10)) }, { header: 'Type', value: e => (e.category === 'home' ? 'Home' : 'Shop') },
          { header: 'Label', value: e => e.label }, { header: 'Description', value: e => e.description || '' }, { header: 'Amount', value: e => e.amount, numeric: true },
        ], rows, totals: { Date: 'TOTAL', Amount: round2(rows.reduce((a, e) => a + e.amount, 0)) },
      };
    }
    case 'cashbook': {
      const rows = cashBook(data, range);
      let bal = 0;
      const withBal = rows.map(r => ({ ...r, bal: (bal = round2(bal + (r.direction === 'in' ? r.amount : -r.amount))) }));
      return {
        title: 'Cash Book', subtitle: rangeText(range), columns: [
          { header: 'Date', value: r => dt(r.date) }, { header: 'Description', value: r => r.description }, { header: 'Method', value: r => r.method },
          { header: 'In', value: r => (r.direction === 'in' ? r.amount : ''), numeric: true }, { header: 'Out', value: r => (r.direction === 'out' ? r.amount : ''), numeric: true },
          { header: 'Balance', value: r => r.bal, numeric: true },
        ], rows: withBal,
        totals: { Date: 'TOTAL', In: round2(rows.filter(r => r.direction === 'in').reduce((a, r) => a + r.amount, 0)), Out: round2(rows.filter(r => r.direction === 'out').reduce((a, r) => a + r.amount, 0)) },
      };
    }
    case 'profitloss': {
      const pl = profitAndLoss(data, range);
      const rows = [
        ['Gross sales', pl.grossSales], ['Less: discounts', -pl.discounts], ['Less: returns', -pl.returns], ['Net sales', pl.netSales],
        ['Cost of goods sold', -pl.cogs], ['Gross profit', pl.grossProfit], ['Shop expenses', -pl.shopExpenses], ['Stock losses (damage/lost)', -pl.stockLosses],
        ['NET PROFIT', pl.netProfit], ['Home expenses (drawings, not in profit)', pl.homeExpenses], ['Gross margin %', pl.marginPct],
      ].map(([label, value]) => ({ label, value }));
      return { title: 'Profit & Loss', subtitle: rangeText(range), columns: [{ header: 'Item', value: r => r.label }, { header: `Amount (${cur})`, value: r => r.value, numeric: true }], rows };
    }
    case 'udhar': {
      const rows = data.customers.map(c => ({ c, l: customerLedger(c, data) })).map(x => ({ ...x, bal: x.l.length ? x.l[x.l.length - 1].balance : 0 })).filter(x => x.bal !== 0);
      return {
        title: 'Udhar / Receivables', columns: [
          { header: 'Customer', value: r => r.c.name }, { header: 'Phone', value: r => r.c.phone },
          { header: 'Last activity', value: r => d(r.l[r.l.length - 1]?.date || r.c.createdAt) }, { header: 'Balance', value: r => r.bal, numeric: true },
        ], rows, totals: { Customer: 'TOTAL', Balance: round2(rows.reduce((a, r) => a + r.bal, 0)) },
      };
    }
    case 'adjustments': {
      const rows = data.stockAdjustments.filter(a => inRange(dayOf(a.createdAt), range));
      return {
        title: 'Stock Adjustments', subtitle: rangeText(range), columns: [
          { header: 'Date', value: a => dt(a.createdAt) }, { header: 'Product', value: a => a.productName }, { header: 'Colour', value: a => a.color || '' },
          { header: 'Type', value: a => a.type.replace(/_/g, ' ') }, { header: 'Qty', value: a => a.quantity, numeric: true },
          { header: 'Cost value', value: a => a.costValue, numeric: true }, { header: 'Reason', value: a => a.reason }, { header: 'By', value: a => a.userName },
        ], rows, totals: { Date: 'TOTAL', 'Cost value': round2(rows.reduce((a, r) => a + r.costValue, 0)) },
      };
    }
  }
}

export function customerStatement(c: Customer, data: BusinessData, range: DateRange = {}): TableSpec<ReturnType<typeof customerLedger>[number]> {
  const all = customerLedger(c, data);
  const opening = all.filter(l => range.from && dayOf(l.date) < range.from).slice(-1)[0]?.balance || 0;
  const rows = all.filter(l => inRange(dayOf(l.date), range));
  const closing = rows.length ? rows[rows.length - 1].balance : opening;
  return {
    title: `Customer Statement – ${c.name}`, subtitle: `${c.phone}${range.from || range.to ? ` · ${rangeText(range)}` : ''}`,
    columns: [
      { header: 'Date', value: l => dt(l.date) }, { header: 'Description', value: l => l.description },
      { header: 'Debit', value: l => l.debit || '', numeric: true }, { header: 'Credit', value: l => l.credit || '', numeric: true }, { header: 'Balance', value: l => l.balance, numeric: true },
    ], rows,
    summary: [{ label: 'Opening balance', value: `${data.settings.currency} ${opening.toLocaleString()}` }, { label: 'Closing balance (due)', value: `${data.settings.currency} ${closing.toLocaleString()}` }],
  };
}

export function supplierStatement(s: Supplier, data: BusinessData): TableSpec<ReturnType<typeof supplierLedger>[number]> {
  const rows = supplierLedger(s, data);
  const closing = rows.length ? rows[rows.length - 1].balance : 0;
  return {
    title: `Supplier Statement – ${s.name}`, subtitle: s.phone,
    columns: [
      { header: 'Date', value: l => dt(l.date) }, { header: 'Description', value: l => l.description },
      { header: 'Paid (Dr)', value: l => l.debit || '', numeric: true }, { header: 'Purchased (Cr)', value: l => l.credit || '', numeric: true }, { header: 'Payable', value: l => l.balance, numeric: true },
    ], rows, summary: [{ label: 'Amount payable', value: `${data.settings.currency} ${closing.toLocaleString()}` }],
  };
}
