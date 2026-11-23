import { useState, useMemo, useEffect, useCallback } from 'react';
import { useStore } from '@/store/useStore';
import { Search, Plus, Minus, Trash2, X, Pause, Play, Printer, User, ImageDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Product, PaymentMethod, SaleType, Sale } from '@/types';
import { InvoiceReceipt } from '@/components/pos/InvoiceReceipt';
import { printReceiptElement, saveReceiptAsPng } from '@/lib/receiptPrint';

export default function POS() {
  const {
    products, cart, settings, customers, heldBills,
    addToCart, updateCartItemQty, removeFromCart, clearCart,
    setCartCustomer, setCartNotes, setCartDiscount,
    overrideCartItemPrice, completeSale, holdBill, resumeBill,
    deleteHeldBill, getCartTotal, cartCustomerId, cartCustomerName,
    cartNotes, cartDiscount, cartDiscountType, addCustomer,
  } = useStore();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [saleType, setSaleType] = useState<SaleType>('cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [showInvoice, setShowInvoice] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [showHeld, setShowHeld] = useState(false);
  const [showCustomer, setShowCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [colorPickProduct, setColorPickProduct] = useState<Product | null>(null);

  const activeProducts = products.filter(p => p.active);
  const brands = [...new Set(activeProducts.map(p => p.brand))];

  const filtered = useMemo(() => {
    return activeProducts.filter(p => {
      const q = search.toLowerCase();
      const matchSearch = !q || p.article.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      const matchCat = categoryFilter === 'all' || p.category === categoryFilter;
      const matchBrand = brandFilter === 'all' || p.brand === brandFilter;
      return matchSearch && matchCat && matchBrand;
    });
  }, [activeProducts, search, categoryFilter, brandFilter]);

  const { subtotal, discount, total } = getCartTotal();

  const handleAddProduct = (product: Product) => {
    if ((product.stockMode === 'color_piece' || product.stockMode === 'color_meter') && product.colorStocks.length > 0) {
      setColorPickProduct(product);
    } else {
      addToCart(product);
    }
  };

  const handleCompleteSale = () => {
    const paid = saleType === 'cash' ? total : parseFloat(amountPaid) || 0;
    const sale = completeSale(paymentMethod, saleType, paid);
    if (sale) {
      setLastSale(sale);
      setShowInvoice(true);
      setAmountPaid('');
      // Auto-print after sale completes (wait for receipt to render)
      setTimeout(() => {
        printReceiptElement('print-receipt-area');
      }, 500);
    }
  };

  const filteredCustomers = customers.filter(c => {
    const q = customerSearch.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || c.phone.includes(q);
  });

  return (
    <div className="flex h-screen animate-fade-in">
      {/* Left: Products */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-border">
        {/* Top filters */}
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by article, brand, SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="Ladies">Ladies</SelectItem>
                <SelectItem value="Gents">Gents</SelectItem>
              </SelectContent>
            </Select>
            <Select value={brandFilter} onValueChange={setBrandFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Brands</SelectItem>
                {brands.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {settings.promoEnabled && (
            <div className="bg-warning/10 text-warning-foreground rounded-lg px-3 py-1.5 text-xs font-medium">
              🎉 Promotional Sale Active — {settings.promoDiscount}% off all items
            </div>
          )}
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filtered.map(product => (
              <button
                key={product.id}
                onClick={() => handleAddProduct(product)}
                className="bg-card border border-border rounded-xl p-3 text-left hover:border-primary/50 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase">{product.brand}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    product.category === 'Ladies' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {product.category}
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground truncate">{product.article}</p>
                <p className="text-xs text-muted-foreground">{product.fabricCategory}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-bold text-primary text-sm">{settings.currency} {product.salePrice.toLocaleString()}</span>
                  <span className={`text-[10px] font-mono ${product.stockQty <= product.lowStockThreshold ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {product.stockQty}{product.stockMode.includes('meter') ? 'm' : 'pc'}
                  </span>
                </div>
              </button>
            ))}
          </div>
          {filtered.length === 0 && (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">No products found</div>
          )}
        </div>
      </div>

      {/* Right: Cart */}
      <div className="w-[380px] flex flex-col bg-card flex-shrink-0">
        {/* Cart header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-foreground">Cart</h2>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => setShowHeld(true)} title="Held Bills">
                <Play className="w-4 h-4" />
                {heldBills.length > 0 && <span className="ml-1 text-xs">{heldBills.length}</span>}
              </Button>
              <Button variant="ghost" size="sm" onClick={holdBill} title="Hold Bill" disabled={cart.length === 0}>
                <Pause className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={clearCart} title="Clear Cart" disabled={cart.length === 0}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Customer */}
          <button
            onClick={() => setShowCustomer(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-muted text-sm hover:bg-muted/80 transition-colors"
          >
            <User className="w-4 h-4 text-muted-foreground" />
            <span className={cartCustomerName ? 'text-foreground font-medium' : 'text-muted-foreground'}>
              {cartCustomerName || 'Select Customer (Optional)'}
            </span>
          </button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-auto p-3 space-y-2 scrollbar-thin">
          {cart.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              Cart is empty
            </div>
          ) : (
            cart.map((item, idx) => (
              <div key={`${item.productId}-${item.color}-${idx}`} className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-start justify-between mb-1">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{item.product.brand} — {item.product.article}</p>
                    {item.color && <p className="text-xs text-muted-foreground">{item.color}</p>}
                  </div>
                  <button onClick={() => removeFromCart(item.productId, item.color)} className="text-muted-foreground hover:text-destructive p-1">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateCartItemQty(item.productId, item.color, item.quantity - 1)}
                      className="w-6 h-6 rounded bg-background border border-border flex items-center justify-center text-foreground hover:bg-muted"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-sm font-mono w-6 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateCartItemQty(item.productId, item.color, item.quantity + 1)}
                      className="w-6 h-6 rounded bg-background border border-border flex items-center justify-center text-foreground hover:bg-muted"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{settings.currency} {item.unitPrice.toLocaleString()} × {item.quantity}</p>
                    <p className="text-sm font-semibold">{settings.currency} {item.lineTotal.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Totals & Payment */}
        <div className="border-t border-border p-4 space-y-3">
          {/* Discount */}
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="Discount"
              value={cartDiscount || ''}
              onChange={(e) => setCartDiscount(parseFloat(e.target.value) || 0, cartDiscountType)}
              className="flex-1 h-8 text-sm"
            />
            <Select value={cartDiscountType} onValueChange={(v: any) => setCartDiscount(cartDiscount, v)}>
              <SelectTrigger className="w-20 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="amount">{settings.currency}</SelectItem>
                <SelectItem value="percent">%</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Totals */}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{settings.currency} {subtotal.toLocaleString()}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-warning">
                <span>Discount</span>
                <span>-{settings.currency} {discount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg text-foreground pt-1 border-t border-border">
              <span>Total</span>
              <span>{settings.currency} {total.toLocaleString()}</span>
            </div>
          </div>

          {/* Payment */}
          <div className="flex gap-2">
            <Select value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)}>
              <SelectTrigger className="flex-1 h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Cash">Cash</SelectItem>
                <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                <SelectItem value="Card">Card</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Select value={saleType} onValueChange={(v: any) => setSaleType(v)}>
              <SelectTrigger className="w-28 h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Full Pay</SelectItem>
                <SelectItem value="credit">Credit</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {saleType === 'partial' && (
            <Input
              type="number"
              placeholder="Amount Paid"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              className="h-9 text-sm"
            />
          )}

          <Button
            onClick={handleCompleteSale}
            disabled={cart.length === 0}
            className="w-full h-11 bg-primary text-primary-foreground font-semibold text-base"
          >
            Complete Sale — {settings.currency} {total.toLocaleString()}
          </Button>
        </div>
      </div>

      {/* Color picker dialog */}
      <Dialog open={!!colorPickProduct} onOpenChange={() => setColorPickProduct(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Color — {colorPickProduct?.brand} {colorPickProduct?.article}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {colorPickProduct?.colorStocks.map(cs => (
              <button
                key={cs.color}
                onClick={() => { addToCart(colorPickProduct!, cs.color); setColorPickProduct(null); }}
                className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/50 transition-colors"
              >
                <span className="text-sm font-medium">{cs.color}</span>
                <span className="text-xs text-muted-foreground font-mono">
                  {cs.quantity}{colorPickProduct!.stockMode.includes('meter') ? 'm' : 'pc'}
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Customer dialog */}
      <Dialog open={showCustomer} onOpenChange={setShowCustomer}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Select Customer</DialogTitle></DialogHeader>
          <Input placeholder="Search by name or phone..." value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} className="mb-3" />
          <div className="max-h-48 overflow-auto space-y-1 mb-3">
            <button
              onClick={() => { setCartCustomer(null, ''); setShowCustomer(false); }}
              className="w-full text-left p-2 rounded-lg hover:bg-muted text-sm text-muted-foreground"
            >
              Walk-in Customer
            </button>
            {filteredCustomers.map(c => (
              <button
                key={c.id}
                onClick={() => { setCartCustomer(c.id, c.name); setShowCustomer(false); }}
                className="w-full text-left p-2 rounded-lg hover:bg-muted text-sm"
              >
                <span className="font-medium">{c.name}</span>
                <span className="text-muted-foreground ml-2">{c.phone}</span>
              </button>
            ))}
          </div>
          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">New Customer</p>
            <Input placeholder="Name" value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)} />
            <Input placeholder="Phone" value={newCustomerPhone} onChange={e => setNewCustomerPhone(e.target.value)} />
            <Button
              size="sm"
              disabled={!newCustomerName}
              onClick={() => {
                const c = addCustomer({ name: newCustomerName, phone: newCustomerPhone });
                setCartCustomer(c.id, c.name);
                setNewCustomerName(''); setNewCustomerPhone('');
                setShowCustomer(false);
              }}
            >
              Add & Select
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Held Bills */}
      <Dialog open={showHeld} onOpenChange={setShowHeld}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Held Bills</DialogTitle></DialogHeader>
          {heldBills.length === 0 ? (
            <p className="text-sm text-muted-foreground">No held bills</p>
          ) : (
            <div className="space-y-2">
              {heldBills.map(b => (
                <div key={b.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div>
                    <p className="text-sm font-medium">{b.items.length} items · {b.customerName || 'Walk-in'}</p>
                    <p className="text-xs text-muted-foreground">{new Date(b.heldAt).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => { resumeBill(b.id); setShowHeld(false); }}>Resume</Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteHeldBill(b.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Invoice Dialog - for viewing */}
      <Dialog open={showInvoice} onOpenChange={setShowInvoice}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-auto">
          <DialogHeader><DialogTitle>Invoice</DialogTitle></DialogHeader>
          {lastSale && <InvoiceReceipt sale={lastSale} />}
          <div className="flex gap-2 mt-4">
            <Button
              onClick={async () => {
                await printReceiptElement('print-receipt-area');
              }}
              className="flex-1"
            >
              <Printer className="w-4 h-4 mr-2" /> Print
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                const filename = `receipt-${lastSale?.invoiceNumber || 'unknown'}.png`;
                await saveReceiptAsPng('print-receipt-area', filename);
              }}
              className="flex-1"
            >
              <ImageDown className="w-4 h-4 mr-2" /> Save PNG
            </Button>
            <Button variant="outline" onClick={() => setShowInvoice(false)} className="flex-1">Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Offscreen print area - visible but positioned off-screen for html2canvas */}
      {lastSale && (
        <div id="print-receipt-area" style={{ position: 'fixed', left: '-10000px', top: '0', width: '302px', background: '#fff', zIndex: -1 }}>
          <InvoiceReceipt sale={lastSale} />
        </div>
      )}
    </div>
  );
}
