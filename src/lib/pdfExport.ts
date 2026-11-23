import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { StoreSettings, Sale, CreditEntry, GoodsReceiving, Product, Customer, KhataEntry, Lead, Expense } from '@/types';
import { format, parseISO } from 'date-fns';

// ===== VIP Professional Header =====
function addVIPHeader(doc: jsPDF, settings: StoreSettings, reportTitle: string, dateRange?: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const bw = settings.bwReports;
  let y = 10;

  const accentColor: [number, number, number] = bw ? [40, 40, 40] : [22, 78, 58];
  const goldColor: [number, number, number] = bw ? [120, 120, 120] : [198, 164, 88];

  // Top accent bar
  doc.setFillColor(...accentColor);
  doc.rect(0, 0, pageWidth, 4, 'F');

  // Gold accent line
  doc.setFillColor(...goldColor);
  doc.rect(0, 4, pageWidth, 1.5, 'F');

  y = 12;

  // Logo
  if (settings.logoUrl && settings.logoUrl.startsWith('data:')) {
    try {
      doc.addImage(settings.logoUrl, 'PNG', 14, y, 22, 22);
    } catch { /* skip */ }
  }

  const textX = (settings.logoUrl && settings.logoUrl.startsWith('data:')) ? 40 : 14;

  // Store Name
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...accentColor);
  doc.text(settings.storeName, textX, y + 6);

  // Contact info
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  let infoY = y + 11;
  if (settings.address) { doc.text(settings.address, textX, infoY); infoY += 4; }
  if (settings.phone) { doc.text(`Ph: ${settings.phone}`, textX, infoY); infoY += 4; }

  y = Math.max(infoY, y + 24);

  // Report title bar
  doc.setFillColor(...accentColor);
  doc.roundedRect(14, y, pageWidth - 28, 10, 2, 2, 'F');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(reportTitle, pageWidth / 2, y + 7, { align: 'center' });
  y += 14;

  // Date range & generated time
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  if (dateRange) {
    doc.text(`Period: ${dateRange}`, 14, y);
  }
  doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}`, pageWidth - 14, y, { align: 'right' });
  y += 6;

  // Divider
  doc.setDrawColor(...goldColor);
  doc.setLineWidth(0.5);
  doc.line(14, y, pageWidth - 14, y);
  y += 5;

  doc.setTextColor(0, 0, 0);
  return y;
}

// ===== VIP Footer =====
function addVIPFooter(doc: jsPDF, settings: StoreSettings) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pages = doc.getNumberOfPages();
  const bw = settings.bwReports;
  const accentColor: [number, number, number] = bw ? [40, 40, 40] : [22, 78, 58];
  const goldColor: [number, number, number] = bw ? [120, 120, 120] : [198, 164, 88];

  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFillColor(...accentColor);
    doc.rect(0, pageHeight - 16, pageWidth, 16, 'F');
    doc.setFillColor(...goldColor);
    doc.rect(0, pageHeight - 16, pageWidth, 1, 'F');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(255, 255, 255);
    
    const devName = settings.developerCompany || 'Digital Target';
    doc.text(`Developed by ${devName}`, 14, pageHeight - 8);
    doc.text(`Premium POS System`, pageWidth / 2, pageHeight - 8, { align: 'center' });
    doc.text(`Page ${i} of ${pages}`, pageWidth - 14, pageHeight - 8, { align: 'right' });
  }
}

// ===== Summary Card =====
function addSummaryCards(doc: jsPDF, y: number, cards: { label: string; value: string }[], settings?: StoreSettings) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const bw = settings?.bwReports;
  const cardWidth = (pageWidth - 28 - (cards.length - 1) * 4) / cards.length;
  const accentColor: [number, number, number] = bw ? [40, 40, 40] : [22, 78, 58];
  const borderColor: [number, number, number] = bw ? [120, 120, 120] : [198, 164, 88];

  cards.forEach((card, i) => {
    const x = 14 + i * (cardWidth + 4);
    doc.setFillColor(bw ? 240 : 245, bw ? 240 : 245, bw ? 240 : 240);
    doc.roundedRect(x, y, cardWidth, 14, 2, 2, 'F');
    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, cardWidth, 14, 2, 2, 'S');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(card.label, x + 4, y + 5);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...accentColor);
    doc.text(card.value, x + 4, y + 12);
  });

  doc.setTextColor(0, 0, 0);
  return y + 20;
}


// ===== Inventory Full Report PDF =====
export function exportInventoryPDF(products: Product[], settings: StoreSettings) {
  const doc = new jsPDF();
  let y = addVIPHeader(doc, settings, 'INVENTORY REPORT');

  const active = products.filter(p => p.active);
  const totalValue = active.reduce((s, p) => s + (p.stockQty * p.salePrice), 0);
  const totalCostValue = active.reduce((s, p) => s + (p.stockQty * p.costPrice), 0);

  y = addSummaryCards(doc, y, [
    { label: 'Total Products', value: `${active.length}` },
    { label: 'Retail Value', value: `${settings.currency} ${totalValue.toLocaleString()}` },
    { label: 'Cost Value', value: `${settings.currency} ${totalCostValue.toLocaleString()}` },
    { label: 'Profit Margin', value: `${settings.currency} ${(totalValue - totalCostValue).toLocaleString()}` },
  ]);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Brand', 'Article', 'Category', 'Fabric', 'Stock', 'Cost', 'Sale Price']],
    body: active.map((p, i) => [
      i + 1, p.brand, p.article, p.category, p.fabricCategory,
      `${p.stockQty}${p.stockMode.includes('meter') ? 'm' : 'pc'}`,
      `${settings.currency} ${p.costPrice.toLocaleString()}`,
      `${settings.currency} ${p.salePrice.toLocaleString()}`,
    ]),
    styles: { fontSize: 8, cellPadding: 2.5, lineColor: [200, 200, 200], lineWidth: 0.2 },
    headStyles: { fillColor: [22, 78, 58], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 245, 240] },
    margin: { bottom: 25 },
  });

  addVIPFooter(doc, settings);
  doc.save(`Inventory-Report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportSalesReportPDF(sales: Sale[], settings: StoreSettings, dateFrom?: string, dateTo?: string) {
  const doc = new jsPDF();
  const dateRange = dateFrom && dateTo ? `${dateFrom} — ${dateTo}` : dateFrom || dateTo || 'All Time';
  let y = addVIPHeader(doc, settings, 'SALES REPORT', dateRange);

  const totalRevenue = sales.reduce((s, sl) => s + sl.total, 0);
  const totalDiscount = sales.reduce((s, sl) => s + sl.discountAmount, 0);
  const avgBill = sales.length > 0 ? totalRevenue / sales.length : 0;

  y = addSummaryCards(doc, y, [
    { label: 'Total Bills', value: `${sales.length}` },
    { label: 'Revenue', value: `${settings.currency} ${totalRevenue.toLocaleString()}` },
    { label: 'Discount Given', value: `${settings.currency} ${totalDiscount.toLocaleString()}` },
    { label: 'Avg Bill', value: `${settings.currency} ${Math.round(avgBill).toLocaleString()}` },
  ]);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Invoice', 'Date', 'Customer', 'Items', 'Total', 'Payment', 'Type']],
    body: sales.map((s, i) => [
      i + 1, s.invoiceNumber,
      format(parseISO(s.createdAt), 'dd/MM/yyyy hh:mm a'),
      s.customerName || 'Walk-in', s.items.length,
      `${settings.currency} ${s.total.toLocaleString()}`,
      s.paymentMethod, s.saleType,
    ]),
    styles: { fontSize: 8, cellPadding: 2.5, lineColor: [200, 200, 200], lineWidth: 0.2 },
    headStyles: { fillColor: [22, 78, 58], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 240] },
    margin: { bottom: 25 },
  });

  addVIPFooter(doc, settings);
  doc.save(`Sales-Report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportBrandReportPDF(brandMap: Record<string, number>, settings: StoreSettings) {
  const doc = new jsPDF();
  let y = addVIPHeader(doc, settings, 'BRAND-WISE SALES REPORT');

  const total = Object.values(brandMap).reduce((a, b) => a + b, 0);
  y = addSummaryCards(doc, y, [
    { label: 'Total Brands', value: `${Object.keys(brandMap).length}` },
    { label: 'Total Revenue', value: `${settings.currency} ${total.toLocaleString()}` },
  ]);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Brand', 'Revenue', 'Share %']],
    body: Object.entries(brandMap).sort((a, b) => b[1] - a[1]).map(([brand, rev], i) => [
      i + 1, brand, `${settings.currency} ${rev.toLocaleString()}`,
      `${total > 0 ? ((rev / total) * 100).toFixed(1) : 0}%`,
    ]),
    styles: { fontSize: 9, cellPadding: 3, lineColor: [200, 200, 200], lineWidth: 0.2 },
    headStyles: { fillColor: [22, 78, 58], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 240] },
    margin: { bottom: 25 },
  });

  addVIPFooter(doc, settings);
  doc.save(`Brand-Report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportCategoryReportPDF(catMap: Record<string, number>, settings: StoreSettings) {
  const doc = new jsPDF();
  let y = addVIPHeader(doc, settings, 'CATEGORY-WISE SALES REPORT');

  const total = Object.values(catMap).reduce((a, b) => a + b, 0);
  y = addSummaryCards(doc, y, [
    { label: 'Total Categories', value: `${Object.keys(catMap).length}` },
    { label: 'Total Revenue', value: `${settings.currency} ${total.toLocaleString()}` },
  ]);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Category', 'Revenue', 'Share %']],
    body: Object.entries(catMap).sort((a, b) => b[1] - a[1]).map(([cat, rev], i) => [
      i + 1, cat, `${settings.currency} ${rev.toLocaleString()}`,
      `${total > 0 ? ((rev / total) * 100).toFixed(1) : 0}%`,
    ]),
    styles: { fontSize: 9, cellPadding: 3, lineColor: [200, 200, 200], lineWidth: 0.2 },
    headStyles: { fillColor: [22, 78, 58], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 240] },
    margin: { bottom: 25 },
  });

  addVIPFooter(doc, settings);
  doc.save(`Category-Report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportLowStockPDF(products: Product[], settings: StoreSettings) {
  const doc = new jsPDF();
  let y = addVIPHeader(doc, settings, '⚠ LOW STOCK ALERT REPORT');

  y = addSummaryCards(doc, y, [
    { label: 'Items Below Threshold', value: `${products.length}` },
    { label: 'Urgent Restock Needed', value: products.filter(p => p.stockQty === 0).length.toString() },
  ]);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Brand', 'Article', 'Stock Mode', 'Current Stock', 'Threshold']],
    body: products.map((p, i) => [
      i + 1, p.brand, p.article, p.stockMode,
      `${p.stockQty}${p.stockMode.includes('meter') ? 'm' : 'pc'}`,
      p.lowStockThreshold,
    ]),
    styles: { fontSize: 9, cellPadding: 3, lineColor: [200, 200, 200], lineWidth: 0.2 },
    headStyles: { fillColor: [180, 40, 40], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [255, 245, 245] },
    margin: { bottom: 25 },
  });

  addVIPFooter(doc, settings);
  doc.save(`Low-Stock-Report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportCreditReportPDF(credits: CreditEntry[], settings: StoreSettings) {
  const doc = new jsPDF();
  let y = addVIPHeader(doc, settings, 'CREDIT / UDHAR REPORT');

  const totalCredit = credits.reduce((s, c) => s + c.totalAmount, 0);
  const totalPaid = credits.reduce((s, c) => s + c.paidAmount, 0);
  const totalRemaining = credits.reduce((s, c) => s + c.remainingAmount, 0);

  y = addSummaryCards(doc, y, [
    { label: 'Total Credit', value: `${settings.currency} ${totalCredit.toLocaleString()}` },
    { label: 'Recovered', value: `${settings.currency} ${totalPaid.toLocaleString()}` },
    { label: 'Outstanding', value: `${settings.currency} ${totalRemaining.toLocaleString()}` },
    { label: 'Entries', value: `${credits.length}` },
  ]);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Customer', 'Phone', 'Invoice', 'Total', 'Paid', 'Remaining', 'Status']],
    body: credits.map((c, i) => [
      i + 1, c.customerName, c.customerPhone, c.invoiceNumber,
      `${settings.currency} ${c.totalAmount.toLocaleString()}`,
      `${settings.currency} ${c.paidAmount.toLocaleString()}`,
      `${settings.currency} ${c.remainingAmount.toLocaleString()}`,
      c.fullyPaid ? '✅ Paid' : '⏳ Pending',
    ]),
    styles: { fontSize: 8, cellPadding: 2.5, lineColor: [200, 200, 200], lineWidth: 0.2 },
    headStyles: { fillColor: [22, 78, 58], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 240] },
    margin: { bottom: 25 },
  });

  addVIPFooter(doc, settings);
  doc.save(`Credit-Report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportReceivingReportPDF(receivings: GoodsReceiving[], settings: StoreSettings) {
  const doc = new jsPDF();
  let y = addVIPHeader(doc, settings, 'GOODS RECEIVING REPORT');

  y = addSummaryCards(doc, y, [
    { label: 'Total Entries', value: `${receivings.length}` },
    { label: 'Total Qty Added', value: `${receivings.reduce((s, r) => s + r.quantityAdded, 0)}` },
  ]);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Date', 'Brand', 'Product', 'Color', 'Qty', 'Cost Price', 'Supplier']],
    body: receivings.map((gr, i) => [
      i + 1,
      format(parseISO(gr.createdAt), 'dd/MM/yyyy'),
      gr.brand, gr.productName, gr.colorAdded || '-',
      gr.quantityAdded, gr.costPrice ? `${settings.currency} ${gr.costPrice}` : '-',
      gr.supplier || '-',
    ]),
    styles: { fontSize: 8, cellPadding: 2.5, lineColor: [200, 200, 200], lineWidth: 0.2 },
    headStyles: { fillColor: [22, 78, 58], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 240] },
    margin: { bottom: 25 },
  });

  addVIPFooter(doc, settings);
  doc.save(`Receiving-Report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ===== Customer Report PDF =====
export function exportCustomerReportPDF(customers: Customer[], sales: Sale[], settings: StoreSettings) {
  const doc = new jsPDF();
  let y = addVIPHeader(doc, settings, 'CUSTOMER DIRECTORY');

  y = addSummaryCards(doc, y, [
    { label: 'Total Customers', value: `${customers.length}` },
    { label: 'With Purchases', value: `${customers.filter(c => sales.some(s => !s.deleted && s.customerId === c.id)).length}` },
  ]);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Name', 'Phone', 'Address', 'Total Purchases', 'Total Spent']],
    body: customers.map((c, i) => {
      const custSales = sales.filter(s => !s.deleted && s.customerId === c.id);
      const totalSpent = custSales.reduce((sum, s) => sum + s.total, 0);
      return [
        i + 1, c.name, c.phone, c.address || '-',
        custSales.length,
        `${settings.currency} ${totalSpent.toLocaleString()}`,
      ];
    }),
    styles: { fontSize: 8, cellPadding: 2.5, lineColor: [200, 200, 200], lineWidth: 0.2 },
    headStyles: { fillColor: [22, 78, 58], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 240] },
    margin: { bottom: 25 },
  });

  addVIPFooter(doc, settings);
  doc.save(`Customer-Report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ===== Customer CSV Export (WhatsApp-ready) =====
export function exportCustomerCSV(customers: Customer[]) {
  const rows = [['Name', 'Phone (WhatsApp)', 'Address', 'Notes'].join(',')];
  customers.forEach(c => {
    // Format phone for WhatsApp: ensure +92 prefix
    let phone = c.phone.replace(/[^0-9+]/g, '');
    if (phone.startsWith('0')) phone = '+92' + phone.slice(1);
    else if (!phone.startsWith('+')) phone = '+92' + phone;
    rows.push([
      `"${c.name}"`, phone, `"${c.address || ''}"`, `"${c.notes || ''}"`,
    ].join(','));
  });
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Customers-WhatsApp-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ===== Khata/Credit Ledger PDF =====
export function exportKhataReportPDF(khataEntries: KhataEntry[], credits: CreditEntry[], settings: StoreSettings) {
  const doc = new jsPDF();
  let y = addVIPHeader(doc, settings, 'COMPLETE LEDGER / KHATA REPORT');

  const totalGive = khataEntries.filter(e => e.type === 'give').reduce((s, e) => s + e.amount, 0);
  const totalTake = khataEntries.filter(e => e.type === 'take').reduce((s, e) => s + e.amount, 0);
  const totalCreditDue = credits.filter(c => !c.fullyPaid).reduce((s, c) => s + c.remainingAmount, 0);

  y = addSummaryCards(doc, y, [
    { label: 'Dena (Give)', value: `${settings.currency} ${totalGive.toLocaleString()}` },
    { label: 'Lena (Take)', value: `${settings.currency} ${totalTake.toLocaleString()}` },
    { label: 'Bill Credit Due', value: `${settings.currency} ${totalCreditDue.toLocaleString()}` },
    { label: 'Net Balance', value: `${settings.currency} ${(totalGive - totalTake + totalCreditDue).toLocaleString()}` },
  ]);

  // Manual entries
  if (khataEntries.length > 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Manual Khata Entries', 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [['#', 'Name', 'Phone', 'Type', 'Amount', 'Description', 'Date']],
      body: khataEntries.map((e, i) => [
        i + 1, e.customerName, e.customerPhone,
        e.type === 'give' ? '↗ Dena' : '↙ Lena',
        `${settings.currency} ${e.amount.toLocaleString()}`,
        e.description, format(parseISO(e.date), 'dd/MM/yyyy'),
      ]),
      styles: { fontSize: 8, cellPadding: 2, lineColor: [200, 200, 200], lineWidth: 0.2 },
      headStyles: { fillColor: [80, 60, 40], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 240] },
      margin: { bottom: 25 },
    });
  }

  addVIPFooter(doc, settings);
  doc.save(`Khata-Report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ===== Accounting Report PDF =====
export function exportAccountingPDF(
  stats: { totalRevenue: number; grossProfit: number; totalExp: number; netProfit: number; homeExp: number; shopExp: number; totalAccountBalance: number; totalReceivable: number; inventoryValue: number; khataNet: number },
  settings: StoreSettings,
  suggestions: string[]
) {
  const doc = new jsPDF();
  let y = addVIPHeader(doc, settings, 'ACCOUNTING & BUDGET REPORT');

  y = addSummaryCards(doc, y, [
    { label: 'Monthly Revenue', value: `${settings.currency} ${stats.totalRevenue.toLocaleString()}` },
    { label: 'Gross Profit', value: `${settings.currency} ${stats.grossProfit.toLocaleString()}` },
    { label: 'Total Expenses', value: `${settings.currency} ${stats.totalExp.toLocaleString()}` },
    { label: 'Net Profit', value: `${settings.currency} ${stats.netProfit.toLocaleString()}` },
  ]);

  // Breakdown
  autoTable(doc, {
    startY: y,
    head: [['Category', 'Amount']],
    body: [
      ['Home Expenses', `${settings.currency} ${stats.homeExp.toLocaleString()}`],
      ['Shop Expenses', `${settings.currency} ${stats.shopExp.toLocaleString()}`],
      ['Account Balances', `${settings.currency} ${stats.totalAccountBalance.toLocaleString()}`],
      ['Receivable (Udhar)', `${settings.currency} ${stats.totalReceivable.toLocaleString()}`],
      ['Inventory Value', `${settings.currency} ${stats.inventoryValue.toLocaleString()}`],
      ['Khata Net', `${settings.currency} ${Math.abs(stats.khataNet).toLocaleString()} ${stats.khataNet >= 0 ? '(Dena)' : '(Lena)'}`],
    ],
    styles: { fontSize: 9, cellPadding: 3, lineColor: [200, 200, 200], lineWidth: 0.2 },
    headStyles: { fillColor: [22, 78, 58], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 240] },
    margin: { bottom: 25 },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // AI suggestions
  if (suggestions.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 78, 58);
    doc.text('AI Budget Advisor', 14, y);
    y += 5;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    suggestions.forEach(tip => {
      // Strip emoji for PDF
      const cleanTip = tip.replace(/[^\x00-\x7F]/g, '').trim();
      if (cleanTip) {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(`• ${cleanTip}`, 16, y);
        y += 5;
      }
    });
  }

  addVIPFooter(doc, settings);
  doc.save(`Accounting-Report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ===== Leads Report PDF =====
export function exportLeadsReportPDF(leads: Lead[], settings: StoreSettings) {
  const doc = new jsPDF();
  let y = addVIPHeader(doc, settings, 'LEADS REPORT');

  const statusCounts: Record<string, number> = {};
  leads.forEach(l => { statusCounts[l.status] = (statusCounts[l.status] || 0) + 1; });

  y = addSummaryCards(doc, y, [
    { label: 'Total Leads', value: `${leads.length}` },
    { label: 'New', value: `${statusCounts['new'] || 0}` },
    { label: 'Interested', value: `${statusCounts['interested'] || 0}` },
    { label: 'Converted', value: `${statusCounts['converted'] || 0}` },
  ], settings);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Name', 'Phone', 'Source', 'Status', 'Interest', 'Follow-up']],
    body: leads.map((l, i) => [
      i + 1, l.name, l.phone, l.source, l.status, l.interest || '-', l.followUpDate || '-',
    ]),
    styles: { fontSize: 8, cellPadding: 2.5, lineColor: [200, 200, 200], lineWidth: 0.2 },
    headStyles: { fillColor: [22, 78, 58], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 240] },
    margin: { bottom: 25 },
  });

  addVIPFooter(doc, settings);
  doc.save(`Leads-Report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ===== Expenses & Budget PDF =====
export function exportExpensesPDF(expenses: Expense[], settings: StoreSettings, suggestions: string[]) {
  const doc = new jsPDF();
  let y = addVIPHeader(doc, settings, 'EXPENSES & BUDGET REPORT');

  const homeTotal = expenses.filter(e => e.category === 'home').reduce((s, e) => s + e.amount, 0);
  const shopTotal = expenses.filter(e => e.category === 'shop').reduce((s, e) => s + e.amount, 0);

  y = addSummaryCards(doc, y, [
    { label: 'Total Expenses', value: `${settings.currency} ${(homeTotal + shopTotal).toLocaleString()}` },
    { label: 'Home Expenses', value: `${settings.currency} ${homeTotal.toLocaleString()}` },
    { label: 'Shop Expenses', value: `${settings.currency} ${shopTotal.toLocaleString()}` },
  ], settings);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Date', 'Type', 'Label', 'Description', 'Amount']],
    body: expenses.map((e, i) => [
      i + 1, format(parseISO(e.date), 'dd/MM/yyyy'),
      e.category === 'home' ? 'Home' : 'Shop',
      e.label, e.description || '-',
      `${settings.currency} ${e.amount.toLocaleString()}`,
    ]),
    styles: { fontSize: 8, cellPadding: 2.5, lineColor: [200, 200, 200], lineWidth: 0.2 },
    headStyles: { fillColor: [22, 78, 58], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 240] },
    margin: { bottom: 25 },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  if (suggestions.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 78, 58);
    doc.text('AI Budget Advisor', 14, y);
    y += 5;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    suggestions.forEach(tip => {
      const cleanTip = tip.replace(/[^\x20-\x7F]/g, '').trim();
      if (cleanTip) {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(`- ${cleanTip}`, 16, y);
        y += 5;
      }
    });
  }

  addVIPFooter(doc, settings);
  doc.save(`Expenses-Report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ===== Accounts & Transactions Report PDF =====
export function exportAccountsReportPDF(
  accounts: { id: string; name: string; type: string; balance: number; accountNumber?: string }[],
  transactions: { id: string; accountName: string; type: string; amount: number; category: string; description: string; date: string }[],
  settings: StoreSettings
) {
  const doc = new jsPDF();
  let y = addVIPHeader(doc, settings, 'ACCOUNTS & TRANSACTIONS REPORT');

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const totalIn = transactions.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
  const totalOut = transactions.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0);

  y = addSummaryCards(doc, y, [
    { label: 'Total Accounts', value: `${accounts.length}` },
    { label: 'Total Balance', value: `${settings.currency} ${totalBalance.toLocaleString()}` },
    { label: 'Money In', value: `${settings.currency} ${totalIn.toLocaleString()}` },
    { label: 'Money Out', value: `${settings.currency} ${totalOut.toLocaleString()}` },
  ], settings);

  // Account balances table
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 78, 58);
  doc.text('Account Balances', 14, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [['#', 'Account Name', 'Type', 'Account #', 'Balance']],
    body: accounts.map((a, i) => [
      i + 1, a.name, a.type.toUpperCase(), a.accountNumber || '-',
      `${settings.currency} ${a.balance.toLocaleString()}`,
    ]),
    styles: { fontSize: 9, cellPadding: 3, lineColor: [200, 200, 200], lineWidth: 0.2 },
    headStyles: { fillColor: settings.bwReports ? [40, 40, 40] as any : [22, 78, 58] as any, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 240] },
    margin: { bottom: 25 },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // Transaction history
  if (transactions.length > 0) {
    if (y > 200) { doc.addPage(); y = 20; }
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 78, 58);
    doc.text('Transaction History', 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [['#', 'Date', 'Account', 'Category', 'Description', 'Type', 'Amount']],
      body: transactions.slice().reverse().map((t, i) => [
        i + 1, t.date, t.accountName, t.category, t.description || '-',
        t.type === 'credit' ? 'IN' : 'OUT',
        `${settings.currency} ${t.amount.toLocaleString()}`,
      ]),
      styles: { fontSize: 8, cellPadding: 2.5, lineColor: [200, 200, 200], lineWidth: 0.2 },
      headStyles: { fillColor: settings.bwReports ? [40, 40, 40] as any : [22, 78, 58] as any, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 240] },
      margin: { bottom: 25 },
    });
  }

  addVIPFooter(doc, settings);
  doc.save(`Accounts-Report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ===== Invoice PDF (receipt style) =====
export function exportInvoicePDF(sale: Sale, settings: StoreSettings, cashierName: string) {
  const doc = new jsPDF({ unit: 'mm', format: [80, 200] });
  let y = 8;

  if (settings.logoUrl && settings.logoUrl.startsWith('data:')) {
    try {
      doc.addImage(settings.logoUrl, 'PNG', 20, y, 40, 15);
      y += 18;
    } catch { /* skip */ }
  }

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(settings.storeName, 40, y, { align: 'center' });
  y += 4;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  if (settings.address) { doc.text(settings.address, 40, y, { align: 'center' }); y += 3; }
  if (settings.phone) { doc.text(`Ph: ${settings.phone}`, 40, y, { align: 'center' }); y += 3; }

  doc.setDrawColor(150);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(4, y, 76, y);
  y += 4;

  doc.setFontSize(7);
  doc.text(`Invoice: ${sale.invoiceNumber}`, 4, y);
  doc.text(`Date: ${format(parseISO(sale.createdAt), 'dd/MM/yyyy')}`, 50, y);
  y += 3;
  doc.text(`Time: ${format(parseISO(sale.createdAt), 'hh:mm a')}`, 4, y);
  doc.text(`Cashier: ${cashierName}`, 50, y);
  y += 3;
  if (sale.customerName) { doc.text(`Customer: ${sale.customerName}`, 4, y); y += 3; }
  if (sale.customerPhone) { doc.text(`Phone: ${sale.customerPhone}`, 4, y); y += 3; }

  doc.line(4, y, 76, y);
  y += 3;

  autoTable(doc, {
    startY: y,
    head: [['Item', 'Qty', 'Price', 'Total']],
    body: sale.items.map(item => [
      `${item.product.brand} ${item.product.article}${item.color ? ` (${item.color})` : ''}`,
      item.quantity, item.unitPrice.toLocaleString(), item.lineTotal.toLocaleString(),
    ]),
    styles: { fontSize: 6.5, cellPadding: 1 },
    headStyles: { fillColor: [60, 60, 60], textColor: 255, fontSize: 7 },
    tableWidth: 72,
    margin: { left: 4, right: 4 },
  });

  y = (doc as any).lastAutoTable.finalY + 3;

  doc.setLineDashPattern([1, 1], 0);
  doc.line(4, y, 76, y);
  y += 4;
  doc.setFontSize(7);
  doc.text('Subtotal:', 4, y);
  doc.text(`${settings.currency} ${sale.subtotal.toLocaleString()}`, 76, y, { align: 'right' });
  y += 3;
  if (sale.discountAmount > 0) {
    doc.text('Discount:', 4, y);
    doc.text(`-${settings.currency} ${sale.discountAmount.toLocaleString()}`, 76, y, { align: 'right' });
    y += 3;
  }
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL:', 4, y);
  doc.text(`${settings.currency} ${sale.total.toLocaleString()}`, 76, y, { align: 'right' });
  y += 4;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(`Payment: ${sale.paymentMethod}`, 4, y);
  doc.text(`Paid: ${settings.currency} ${sale.amountPaid.toLocaleString()}`, 76, y, { align: 'right' });
  y += 3;
  if (sale.saleType === 'cash' && sale.amountPaid > sale.total) {
    doc.text(`Change: ${settings.currency} ${(sale.amountPaid - sale.total).toLocaleString()}`, 4, y);
    y += 3;
  }
  if (sale.creditAmount > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text(`Credit (Udhar): ${settings.currency} ${sale.creditAmount.toLocaleString()}`, 4, y);
    y += 3;
    doc.setFont('helvetica', 'normal');
  }

  doc.line(4, y, 76, y);
  y += 4;
  doc.setFontSize(7);
  doc.text(settings.footerMessage || 'Thank you!', 40, y, { align: 'center' });
  y += 3;
  if (settings.footerNote) {
    doc.text(settings.footerNote, 40, y, { align: 'center' });
    y += 3;
  }

  // Developer branding on receipt
  y += 2;
  doc.setFontSize(5);
  doc.setTextColor(150);
  doc.text(`Developed by ${settings.developerCompany || 'Digital Target'}`, 40, y, { align: 'center' });

  doc.save(`Invoice-${sale.invoiceNumber}.pdf`);
}
