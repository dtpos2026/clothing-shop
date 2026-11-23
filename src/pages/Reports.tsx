import { useState, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { BarChart3, Eye, Printer, Trash2, FileDown, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InvoiceReceipt } from '@/components/pos/InvoiceReceipt';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import type { Sale } from '@/types';
import { printReceiptElement } from '@/lib/receiptPrint';
import {
  exportSalesReportPDF, exportBrandReportPDF, exportCategoryReportPDF,
  exportLowStockPDF, exportCreditReportPDF, exportReceivingReportPDF, exportInvoicePDF,
  exportKhataReportPDF,
} from '@/lib/pdfExport';

export default function Reports() {
  const { sales, products, credits, goodsReceivings, settings, deleteSale, currentUser } = useStore();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [viewSale, setViewSale] = useState<Sale | null>(null);

  const activeSales = sales.filter(s => !s.deleted);

  const filteredSales = useMemo(() => {
    if (!dateFrom && !dateTo) return activeSales;
    return activeSales.filter(s => {
      const d = parseISO(s.createdAt);
      if (dateFrom && dateTo) {
        return isWithinInterval(d, { start: startOfDay(new Date(dateFrom)), end: endOfDay(new Date(dateTo)) });
      }
      if (dateFrom) return d >= startOfDay(new Date(dateFrom));
      if (dateTo) return d <= endOfDay(new Date(dateTo));
      return true;
    });
  }, [activeSales, dateFrom, dateTo]);

  const totalRevenue = filteredSales.reduce((s, sl) => s + sl.total, 0);
  const totalDiscount = filteredSales.reduce((s, sl) => s + sl.discountAmount, 0);

  const brandMap: Record<string, number> = {};
  filteredSales.forEach(s => s.items.forEach(i => {
    brandMap[i.product.brand] = (brandMap[i.product.brand] || 0) + i.lineTotal;
  }));

  const catMap: Record<string, number> = {};
  filteredSales.forEach(s => s.items.forEach(i => {
    catMap[i.product.category] = (catMap[i.product.category] || 0) + i.lineTotal;
  }));

  const lowStock = products.filter(p => p.active && p.stockQty <= p.lowStockThreshold);

  const handleDelete = (sale: Sale) => {
    if (confirm(`Delete invoice ${sale.invoiceNumber}? Stock will be restored.`)) {
      deleteSale(sale.id);
    }
  };

  const exportCSV = () => {
    const rows = [['Invoice', 'Date', 'Customer', 'Items', 'Total', 'Payment', 'Type'].join(',')];
    filteredSales.forEach(s => {
      rows.push([s.invoiceNumber, format(parseISO(s.createdAt), 'dd/MM/yyyy'), s.customerName || 'Walk-in', s.items.length, s.total, s.paymentMethod, s.saleType].join(','));
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `sales-report-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };

  const handlePrintInvoice = (sale: Sale) => {
    setViewSale(sale);
    setTimeout(() => {
      const printArea = document.getElementById('report-print-receipt-area');
      if (printArea) {
        printArea.style.display = 'block';
        setTimeout(() => {
          window.print();
          setTimeout(() => { printArea.style.display = 'none'; }, 500);
        }, 100);
      }
    }, 200);
  };

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="w-6 h-6" /> Reports</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV}><FileDown className="w-4 h-4 mr-2" /> CSV</Button>
          <Button variant="outline" onClick={() => exportSalesReportPDF(filteredSales, settings, dateFrom, dateTo)}>
            <FileText className="w-4 h-4 mr-2" /> PDF Sales
          </Button>
        </div>
      </div>

      <div className="flex gap-3 items-end">
        <div><label className="text-xs font-medium text-muted-foreground">From</label><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" /></div>
        <div><label className="text-xs font-medium text-muted-foreground">To</label><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" /></div>
        <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); }}>Clear</Button>
      </div>

      <Tabs defaultValue="sales">
        <TabsList>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="brands">By Brand</TabsTrigger>
          <TabsTrigger value="categories">By Category</TabsTrigger>
          <TabsTrigger value="lowstock">Low Stock</TabsTrigger>
          <TabsTrigger value="credits">Credits</TabsTrigger>
          <TabsTrigger value="receiving">Receiving</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="mt-4">
          <div className="flex gap-4 mb-4">
            <div className="bg-card rounded-lg border border-border p-4 flex-1">
              <p className="text-xs text-muted-foreground">Total Revenue</p>
              <p className="text-xl font-bold">{settings.currency} {totalRevenue.toLocaleString()}</p>
            </div>
            <div className="bg-card rounded-lg border border-border p-4 flex-1">
              <p className="text-xs text-muted-foreground">Total Bills</p>
              <p className="text-xl font-bold">{filteredSales.length}</p>
            </div>
            <div className="bg-card rounded-lg border border-border p-4 flex-1">
              <p className="text-xs text-muted-foreground">Total Discount</p>
              <p className="text-xl font-bold">{settings.currency} {totalDiscount.toLocaleString()}</p>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-auto max-h-[calc(100vh-400px)]">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0"><tr>
                  <th className="text-left p-3 font-medium">Invoice</th>
                  <th className="text-left p-3 font-medium">Date</th>
                  <th className="text-left p-3 font-medium">Customer</th>
                  <th className="text-center p-3 font-medium">Items</th>
                  <th className="text-right p-3 font-medium">Total</th>
                  <th className="text-left p-3 font-medium">Payment</th>
                  <th className="text-center p-3 font-medium">Actions</th>
                </tr></thead>
                <tbody>
                  {filteredSales.slice().reverse().map(s => (
                    <tr key={s.id} className="border-t border-border hover:bg-muted/30">
                      <td className="p-3 font-mono text-xs">{s.invoiceNumber}</td>
                      <td className="p-3 text-xs">{format(parseISO(s.createdAt), 'dd MMM yyyy, hh:mm a')}</td>
                      <td className="p-3">{s.customerName || 'Walk-in'}</td>
                      <td className="p-3 text-center">{s.items.length}</td>
                      <td className="p-3 text-right font-semibold">{settings.currency} {s.total.toLocaleString()}</td>
                      <td className="p-3">
                        <span className="text-xs">{s.paymentMethod}</span>
                        {s.saleType !== 'cash' && <span className="ml-1 text-xs text-warning">({s.saleType})</span>}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex justify-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setViewSale(s)}><Eye className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => handlePrintInvoice(s)}><Printer className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => exportInvoicePDF(s, settings, currentUser.name)} title="Download PDF"><FileText className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(s)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredSales.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No sales</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="brands" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button variant="outline" size="sm" onClick={() => exportBrandReportPDF(brandMap, settings)}>
              <FileText className="w-4 h-4 mr-2" /> PDF Export
            </Button>
          </div>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted"><tr><th className="text-left p-3 font-medium">Brand</th><th className="text-right p-3 font-medium">Revenue</th></tr></thead>
              <tbody>
                {Object.entries(brandMap).sort((a, b) => b[1] - a[1]).map(([brand, rev]) => (
                  <tr key={brand} className="border-t border-border"><td className="p-3 font-medium">{brand}</td><td className="p-3 text-right">{settings.currency} {rev.toLocaleString()}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="categories" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button variant="outline" size="sm" onClick={() => exportCategoryReportPDF(catMap, settings)}>
              <FileText className="w-4 h-4 mr-2" /> PDF Export
            </Button>
          </div>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted"><tr><th className="text-left p-3 font-medium">Category</th><th className="text-right p-3 font-medium">Revenue</th></tr></thead>
              <tbody>
                {Object.entries(catMap).sort((a, b) => b[1] - a[1]).map(([cat, rev]) => (
                  <tr key={cat} className="border-t border-border"><td className="p-3 font-medium">{cat}</td><td className="p-3 text-right">{settings.currency} {rev.toLocaleString()}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="lowstock" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button variant="outline" size="sm" onClick={() => exportLowStockPDF(lowStock, settings)}>
              <FileText className="w-4 h-4 mr-2" /> PDF Export
            </Button>
          </div>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted"><tr>
                <th className="text-left p-3 font-medium">Product</th>
                <th className="text-left p-3 font-medium">Mode</th>
                <th className="text-right p-3 font-medium">Stock</th>
                <th className="text-right p-3 font-medium">Threshold</th>
              </tr></thead>
              <tbody>
                {lowStock.map(p => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="p-3"><span className="font-medium">{p.brand}</span> — {p.article}</td>
                    <td className="p-3 text-xs">{p.stockMode}</td>
                    <td className="p-3 text-right font-mono text-destructive">{p.stockQty}{p.stockMode.includes('meter') ? 'm' : 'pc'}</td>
                    <td className="p-3 text-right font-mono">{p.lowStockThreshold}</td>
                  </tr>
                ))}
                {lowStock.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">All stock healthy</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="credits" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button variant="outline" size="sm" onClick={() => exportCreditReportPDF(credits, settings)}>
              <FileText className="w-4 h-4 mr-2" /> PDF Export
            </Button>
          </div>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted"><tr>
                <th className="text-left p-3 font-medium">Customer</th>
                <th className="text-left p-3 font-medium">Invoice</th>
                <th className="text-right p-3 font-medium">Total</th>
                <th className="text-right p-3 font-medium">Paid</th>
                <th className="text-right p-3 font-medium">Remaining</th>
                <th className="text-left p-3 font-medium">Status</th>
              </tr></thead>
              <tbody>
                {credits.map(c => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="p-3 font-medium">{c.customerName}</td>
                    <td className="p-3 font-mono text-xs">{c.invoiceNumber}</td>
                    <td className="p-3 text-right">{settings.currency} {c.totalAmount.toLocaleString()}</td>
                    <td className="p-3 text-right text-success">{settings.currency} {c.paidAmount.toLocaleString()}</td>
                    <td className="p-3 text-right text-warning">{settings.currency} {c.remainingAmount.toLocaleString()}</td>
                    <td className="p-3"><span className={`text-xs px-2 py-0.5 rounded-full ${c.fullyPaid ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{c.fullyPaid ? 'Paid' : 'Pending'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="receiving" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button variant="outline" size="sm" onClick={() => exportReceivingReportPDF(goodsReceivings, settings)}>
              <FileText className="w-4 h-4 mr-2" /> PDF Export
            </Button>
          </div>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted"><tr>
                <th className="text-left p-3 font-medium">Date</th>
                <th className="text-left p-3 font-medium">Product</th>
                <th className="text-left p-3 font-medium">Color</th>
                <th className="text-right p-3 font-medium">Qty</th>
                <th className="text-left p-3 font-medium">Supplier</th>
              </tr></thead>
              <tbody>
                {goodsReceivings.slice().reverse().map(gr => (
                  <tr key={gr.id} className="border-t border-border">
                    <td className="p-3 text-xs">{format(parseISO(gr.createdAt), 'dd MMM yyyy')}</td>
                    <td className="p-3">{gr.brand} — {gr.productName}</td>
                    <td className="p-3">{gr.colorAdded || '-'}</td>
                    <td className="p-3 text-right font-mono">{gr.quantityAdded}</td>
                    <td className="p-3">{gr.supplier || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Invoice Detail */}
      <Dialog open={!!viewSale} onOpenChange={() => setViewSale(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-auto">
          <DialogHeader><DialogTitle>Invoice Detail</DialogTitle></DialogHeader>
          {viewSale && <InvoiceReceipt sale={viewSale} />}
          <div className="flex gap-2 mt-4">
            <Button onClick={async () => {
              await printReceiptElement('report-print-receipt-area');
            }} className="flex-1"><Printer className="w-4 h-4 mr-2" /> Print</Button>
            <Button variant="outline" onClick={() => { if (viewSale) exportInvoicePDF(viewSale, settings, currentUser.name); }} className="flex-1">
              <FileText className="w-4 h-4 mr-2" /> PDF
            </Button>
            <Button variant="outline" onClick={() => setViewSale(null)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Offscreen print area for reports */}
      {viewSale && (
        <div id="report-print-receipt-area" style={{ position: 'fixed', left: '-10000px', top: '0', width: '302px', background: '#fff', zIndex: -1 }}>
          <InvoiceReceipt sale={viewSale} />
        </div>
      )}
    </div>
  );
}
