import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Search, Plus, Minus, Trash2, X, Pause, Play, User, ScanLine, Undo2, ShoppingBag, Split, Ruler, Package as PackageIcon } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import type { Product, PaymentMethod, SaleType, Sale, SellUnit, SalePayment } from '@/types';
import { InvoiceActions } from '@/components/invoice/InvoiceActions';
import { InvoiceReceipt } from '@/components/pos/InvoiceReceipt';
import { useScanner } from '@/components/scan/ScanProvider';
import { findProductByCode } from '@/core/barcode';
import { allowedSellUnits, activeRolls, availableQty, baseQtyFor, effectiveSellUnit, isColorProduct, isMeterProduct, round2, unitLabel, unitPriceFor } from '@/core/inventory';
import { PAYMENT_METHODS, categoriesOf, getInvoiceDesign } from '@/core/defaults';
import { printInvoiceElement } from '@/lib/invoiceOutput';
import { isNewTemplate } from '@/components/invoice/templates';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

const UNIT_ICON: Record<SellUnit, string> = { meter: 'm', suit: 'suit', piece: 'pc' };

export default function POS() {
  const {
    products, cart, settings, customers, heldBills, sales,
    addToCart, updateCartItemQty, removeFromCart, clearCart,
    setCartCustomer, setCartNotes, setCartDiscount, setCartItemUnit, setCartItemDiscount,
    overrideCartItemPrice, completeSale, holdBill, resumeBill,
    deleteHeldBill, getCartTotal, cartCustomerId, cartCustomerName,
    cartNotes, cartDiscount, cartDiscountType, addCustomer, cartPriceTier, setCartPriceTier,
    cartExchange, setCartExchange, processReturn, returnableQty,
  } = useStore();
  const { t } = useT();
  const { scan, setPageHandler } = useScanner();
  const [params, setParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [saleType, setSaleType] = useState<SaleType>('cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [splitMode, setSplitMode] = useState(false);
  const [splits, setSplits] = useState<SalePayment[]>([{ method: 'Cash', amount: 0 }, { method: 'JazzCash', amount: 0 }]);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [showHeld, setShowHeld] = useState(false);
  const [showCustomer, setShowCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [addDialog, setAddDialog] = useState<{ product: Product; color?: string } | null>(null);
  const [colorPickProduct, setColorPickProduct] = useState<Product | null>(null);
  const [showReturn, setShowReturn] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const autoPrintRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const activeProducts = useMemo(() => products.filter(p => p.active), [products]);
  const brands = useMemo(() => [...new Set(activeProducts.map(p => p.brand))], [activeProducts]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return activeProducts.filter(p => {
      const matchSearch = !q || `${p.article} ${p.brand} ${p.sku} ${p.barcode || ''} ${p.design || ''} ${p.fabricCategory}`.toLowerCase().includes(q);
      const matchCat = categoryFilter === 'all' || p.category === categoryFilter;
      const matchBrand = brandFilter === 'all' || p.brand === brandFilter;
      return matchSearch && matchCat && matchBrand;
    });
  }, [activeProducts, search, categoryFilter, brandFilter]);

  const { subtotal, discount, total, exchange, payable } = getCartTotal();

  /** Click/scan → add. Meter products open the quantity dialog (meters or suits, choose thaan). */
  const handleAddProduct = useCallback((product: Product, color?: string) => {
    if (color === undefined && isColorProduct(product) && product.colorStocks.length > 0) {
      setColorPickProduct(product);
      return;
    }
    if (isMeterProduct(product)) {
      setAddDialog({ product, color });
      return;
    }
    if (availableQty(product, color) <= 0) toast.warning(`${product.brand} ${product.article}${color ? ` (${color})` : ''} is out of stock`);
    addToCart(product, color);
  }, [addToCart]);

  const onCode = useCallback((code: string) => {
    const p = findProductByCode(useStore.getState().products, code);
    if (!p) { toast.error(`${t('pos.notFound')}: ${code}`); return; }
    if (!p.active) { toast.error(`${p.brand} ${p.article} is inactive`); return; }
    handleAddProduct(p);
    setSearch('');
  }, [handleAddProduct, t]);

  // hardware scanners + mobile bottom-bar scan button
  useEffect(() => {
    setPageHandler(onCode);
    const ev = (e: Event) => onCode((e as CustomEvent<string>).detail);
    window.addEventListener('pos-scan', ev);
    return () => { setPageHandler(null); window.removeEventListener('pos-scan', ev); };
  }, [onCode, setPageHandler]);

  // /pos?add=<id> from the global scanner
  useEffect(() => {
    const id = params.get('add');
    if (!id) return;
    const p = products.find(x => x.id === id);
    if (p) handleAddProduct(p);
    params.delete('add');
    setParams(params, { replace: true });
  }, [params, products, handleAddProduct, setParams]);

  const receivedSplit = round2(splits.reduce((a, s) => a + (s.amount || 0), 0));
  const cashGiven = parseFloat(amountPaid) || 0;
  const change = !splitMode && saleType === 'cash' && paymentMethod === 'Cash' && cashGiven > payable ? round2(cashGiven - payable) : 0;
  const needsCustomer = (splitMode ? receivedSplit < payable : saleType !== 'cash') && !cartCustomerId;

  const handleCompleteSale = () => {
    if (needsCustomer) { toast.error('Select a customer for Udhar / partial payment'); setShowCustomer(true); return; }
    let sale: Sale | null;
    if (splitMode) {
      if (receivedSplit > payable + 0.009) { toast.error('Split amounts are more than the bill'); return; }
      sale = completeSale(paymentMethod, 'cash', 0, splits.filter(s => s.amount > 0));
    } else {
      const paid = saleType === 'cash' ? payable : cashGiven;
      if (saleType === 'partial' && (paid <= 0 || paid >= payable)) { toast.error('Enter the partial amount received (less than the total)'); return; }
      sale = completeSale(paymentMethod, saleType, paid);
    }
    if (!sale) { toast.error('Could not complete sale'); return; }
    setLastSale(sale);
    setAmountPaid('');
    setSplits([{ method: 'Cash', amount: 0 }, { method: 'JazzCash', amount: 0 }]);
    setSplitMode(false);
    setSaleType('cash');
    setCartOpen(false);
    toast.success(`Sale ${sale.invoiceNumber} saved${change ? ` · Change ${settings.currency} ${change.toLocaleString()}` : ''}`);
    if (settings.autoPrint) {
      setTimeout(() => {
        const el = autoPrintRef.current?.querySelector('.print-receipt > div, .print-receipt') as HTMLElement | null;
        const paper = isNewTemplate(settings.receiptTemplate) ? getInvoiceDesign(settings).paperSize : settings.printerType;
        if (el) printInvoiceElement(el, paper, { silent: !settings.printPreview, printerName: settings.printerName });
      }, 400);
    }
  };

  const filteredCustomers = customers.filter(c => {
    const q = customerSearch.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || c.phone.includes(q);
  });

  const cartCount = cart.length;

  const cartPanel = (
    <div className="flex flex-col h-full bg-card">
      <div className="p-3 border-b border-border space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-foreground flex items-center gap-2"><ShoppingBag className="w-4 h-4" />{t('pos.cart')} <span className="text-xs text-muted-foreground">({cartCount})</span></h2>
          <div className="flex gap-1 dense-touch">
            <Button variant="ghost" size="sm" onClick={() => setShowReturn(true)} title={t('pos.return')}><Undo2 className="w-4 h-4" /></Button>
            <Button variant="ghost" size="sm" onClick={() => setShowHeld(true)} title={t('pos.held')}>
              <Play className="w-4 h-4" />{heldBills.length > 0 && <span className="ms-1 text-xs">{heldBills.length}</span>}
            </Button>
            <Button variant="ghost" size="sm" onClick={holdBill} title={t('pos.hold')} disabled={cart.length === 0}><Pause className="w-4 h-4" /></Button>
            <Button variant="ghost" size="sm" onClick={clearCart} title="Clear" disabled={cart.length === 0 && !cartExchange}><Trash2 className="w-4 h-4" /></Button>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCustomer(true)} className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2 rounded-lg bg-muted text-sm hover:bg-muted/80 transition-colors">
            <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className={cn('truncate', cartCustomerName ? 'text-foreground font-medium' : 'text-muted-foreground')}>{cartCustomerName || t('pos.selectCustomer')}</span>
          </button>
          <div className="flex rounded-lg border border-border overflow-hidden text-xs dense-touch">
            {(['retail', 'wholesale'] as const).map(tier => (
              <button key={tier} onClick={() => setCartPriceTier(tier)} className={cn('px-2', cartPriceTier === tier ? 'bg-primary text-primary-foreground' : 'bg-background')}>{t(tier === 'retail' ? 'pos.retail' : 'pos.wholesale')}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-2 space-y-2 scrollbar-thin">
        {cartExchange && (
          <div className="rounded-lg border border-info/40 bg-info/10 p-2 text-xs flex items-center justify-between">
            <span>Exchange credit from <b>{cartExchange.invoice}</b>: {settings.currency} {cartExchange.amount.toLocaleString()}</span>
            <button onClick={() => setCartExchange(null)} className="p-1"><X className="w-3 h-3" /></button>
          </div>
        )}
        {cart.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">{t('pos.empty')}</div>
        ) : cart.map((item, idx) => {
          const unit = effectiveSellUnit(item);
          const units = allowedSellUnits(item.product);
          const meters = isMeterProduct(item.product) ? baseQtyFor(item.product, unit, item.quantity) : null;
          const live = products.find(p => p.id === item.productId);
          const short = live ? baseQtyFor(live, unit, item.quantity) > availableQty(live, item.color) : false;
          return (
            <div key={`${item.productId}-${item.color}-${idx}`} className={cn('rounded-lg p-2.5 border', short ? 'border-warning/60 bg-warning/5' : 'border-transparent bg-muted/50')}>
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{item.product.brand} — {item.product.article}</p>
                  <p className="text-[11px] text-muted-foreground">{item.color ? `${item.color} · ` : ''}{meters !== null ? `${meters} m` : ''}{short ? ' · low stock' : ''}{item.rollId ? ` · thaan ${item.product.rolls?.find(r => r.id === item.rollId)?.rollNo || ''}` : ''}</p>
                </div>
                <button onClick={() => removeFromCart(item.productId, item.color)} className="text-muted-foreground hover:text-destructive p-1 dense-touch" aria-label="Remove"><X className="w-3.5 h-3.5" /></button>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap dense-touch">
                <button onClick={() => updateCartItemQty(item.productId, item.color, round2(item.quantity - (unit === 'meter' ? 0.5 : 1)))} className="w-7 h-7 rounded bg-background border border-border flex items-center justify-center hover:bg-muted"><Minus className="w-3 h-3" /></button>
                <Input type="number" inputMode="decimal" step={unit === 'meter' ? 0.25 : 1} min={0} value={item.quantity}
                  onChange={e => updateCartItemQty(item.productId, item.color, parseFloat(e.target.value) || 0)}
                  className="h-7 w-16 text-center px-1 text-sm font-mono" />
                <button onClick={() => updateCartItemQty(item.productId, item.color, round2(item.quantity + (unit === 'meter' ? 0.5 : 1)))} className="w-7 h-7 rounded bg-background border border-border flex items-center justify-center hover:bg-muted"><Plus className="w-3 h-3" /></button>
                {units.length > 1 ? (
                  <select value={unit} onChange={e => setCartItemUnit(item.productId, item.color, e.target.value as SellUnit)} className="h-7 rounded border border-border bg-background text-xs px-1">
                    {units.map(u => <option key={u} value={u}>{UNIT_ICON[u]}</option>)}
                  </select>
                ) : <span className="text-xs text-muted-foreground">{UNIT_ICON[unit]}</span>}
                <div className="ms-auto text-end">
                  <button className="text-[11px] text-muted-foreground hover:text-primary" title="Change price" onClick={() => {
                    const v = prompt('Unit price', String(item.unitPrice));
                    if (v !== null && !isNaN(parseFloat(v))) overrideCartItemPrice(item.productId, item.color, parseFloat(v));
                  }}>{settings.currency} {item.unitPrice.toLocaleString()} × {item.quantity}</button>
                  <p className="text-sm font-semibold">{settings.currency} {item.lineTotal.toLocaleString()}</p>
                </div>
              </div>
              {item.discount > 0 || cart.length < 6 ? (
                <div className="flex items-center gap-1 mt-1 dense-touch">
                  <span className="text-[10px] text-muted-foreground">Line disc</span>
                  <Input type="number" min={0} value={item.discount || ''} placeholder="0" onChange={e => setCartItemDiscount(item.productId, item.color, parseFloat(e.target.value) || 0)} className="h-6 w-20 text-xs px-1" />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="border-t border-border p-3 space-y-2.5">
        <div className="flex items-center gap-2">
          <Input type="number" placeholder={t('pos.discount')} value={cartDiscount || ''} onChange={e => setCartDiscount(parseFloat(e.target.value) || 0, cartDiscountType)} className="flex-1 h-8 text-sm" />
          <Select value={cartDiscountType} onValueChange={(v: 'amount' | 'percent') => setCartDiscount(cartDiscount, v)}>
            <SelectTrigger className="w-20 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="amount">{settings.currency}</SelectItem><SelectItem value="percent">%</SelectItem></SelectContent>
          </Select>
          <Input placeholder={t('common.notes')} value={cartNotes} onChange={e => setCartNotes(e.target.value)} className="flex-1 h-8 text-sm" />
        </div>

        <div className="space-y-0.5 text-sm">
          <div className="flex justify-between text-muted-foreground"><span>{t('pos.subtotal')}</span><span>{settings.currency} {subtotal.toLocaleString()}</span></div>
          {discount > 0 && <div className="flex justify-between text-warning"><span>{t('pos.discount')}</span><span>-{settings.currency} {discount.toLocaleString()}</span></div>}
          {exchange > 0 && <div className="flex justify-between text-info"><span>Exchange credit</span><span>-{settings.currency} {exchange.toLocaleString()}</span></div>}
          <div className="flex justify-between font-bold text-lg text-foreground pt-1 border-t border-border"><span>{exchange > 0 ? t('pos.payable') : t('common.total')}</span><span>{settings.currency} {payable.toLocaleString()}</span></div>
          {cartExchange && cartExchange.amount > total && <p className="text-[11px] text-warning">Exchange credit is more than this bill. Add items, or refund the difference ({settings.currency} {(cartExchange.amount - total).toLocaleString()}) from the Return dialog.</p>}
        </div>

        {!splitMode ? (
          <>
            <div className="flex gap-2">
              <Select value={paymentMethod} onValueChange={(v: PaymentMethod) => setPaymentMethod(v)}>
                <SelectTrigger className="flex-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={saleType} onValueChange={(v: SaleType) => setSaleType(v)}>
                <SelectTrigger className="w-28 h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="cash">Full Pay</SelectItem><SelectItem value="credit">Udhar</SelectItem><SelectItem value="partial">Partial</SelectItem></SelectContent>
              </Select>
              <Button variant="outline" size="icon" className="h-9 w-9" title={t('pos.split')} onClick={() => { setSplitMode(true); setSplits([{ method: 'Cash', amount: payable }, { method: 'JazzCash', amount: 0 }]); }}><Split className="w-4 h-4" /></Button>
            </div>
            {(saleType === 'partial' || (saleType === 'cash' && paymentMethod === 'Cash')) && (
              <div className="flex items-center gap-2">
                <Input type="number" inputMode="decimal" placeholder={saleType === 'partial' ? 'Amount received now' : 'Cash received (for change)'} value={amountPaid} onChange={e => setAmountPaid(e.target.value)} className="h-9 text-sm" />
                {change > 0 && <span className="text-sm font-bold text-success whitespace-nowrap">{t('pos.change')}: {change.toLocaleString()}</span>}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-1.5 rounded-lg border border-border p-2">
            <div className="flex justify-between text-xs font-semibold"><span>{t('pos.split')}</span><button className="text-muted-foreground" onClick={() => setSplitMode(false)}>Cancel</button></div>
            {splits.map((s, i) => (
              <div key={i} className="flex gap-1.5">
                <select value={s.method} onChange={e => setSplits(sp => sp.map((x, j) => j === i ? { ...x, method: e.target.value as PaymentMethod } : x))} className="h-8 rounded border border-border bg-background text-xs px-1 flex-1">
                  {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                </select>
                <Input type="number" inputMode="decimal" value={s.amount || ''} onChange={e => setSplits(sp => sp.map((x, j) => j === i ? { ...x, amount: parseFloat(e.target.value) || 0 } : x))} className="h-8 w-28 text-sm" />
                {splits.length > 1 && <button className="p-1 text-muted-foreground" onClick={() => setSplits(sp => sp.filter((_, j) => j !== i))}><X className="w-3 h-3" /></button>}
              </div>
            ))}
            <div className="flex justify-between text-xs">
              <button className="text-primary" onClick={() => setSplits(sp => [...sp, { method: 'Bank Transfer', amount: round2(Math.max(0, payable - receivedSplit)) }])}>+ add method</button>
              <span className={receivedSplit < payable ? 'text-warning font-semibold' : 'text-success font-semibold'}>
                {receivedSplit < payable ? `Udhar ${settings.currency} ${round2(payable - receivedSplit).toLocaleString()}` : 'Fully paid'}
              </span>
            </div>
          </div>
        )}

        <Button onClick={handleCompleteSale} disabled={cart.length === 0} className="w-full h-11 bg-primary text-primary-foreground font-semibold text-base">
          {t('pos.complete')} — {settings.currency} {payable.toLocaleString()}
        </Button>
        {needsCustomer && cart.length > 0 && <p className="text-[11px] text-warning text-center">Udhar requires a customer</p>}
      </div>
    </div>
  );

  return (
    <div className="flex h-full animate-fade-in">
      {/* Left: Products */}
      <div className="flex-1 flex flex-col min-w-0 md:border-e border-border">
        <div className="p-3 md:p-4 border-b border-border space-y-2">
          <div className="flex items-center gap-2">
            <form className="relative flex-1" onSubmit={e => {
              e.preventDefault();
              const exact = findProductByCode(activeProducts, search);
              if (exact) onCode(search);
              else if (filtered.length === 1) { handleAddProduct(filtered[0]); setSearch(''); }
            }}>
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input ref={searchRef} placeholder={t('pos.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="ps-9" autoFocus />
            </form>
            <Button variant="outline" size="icon" onClick={() => scan(onCode)} title="Scan with camera"><ScanLine className="w-4 h-4" /></Button>
          </div>
          <div className="flex gap-2">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="flex-1 md:w-36 md:flex-none h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All categories</SelectItem>{categoriesOf(settings).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={brandFilter} onValueChange={setBrandFilter}>
              <SelectTrigger className="flex-1 md:w-40 md:flex-none h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Brands</SelectItem>{brands.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {settings.promoEnabled && (
            <div className="bg-warning/10 text-warning-foreground rounded-lg px-3 py-1.5 text-xs font-medium">🎉 Promotional Sale Active — {settings.promoDiscount}% off all items</div>
          )}
        </div>

        <div className="flex-1 overflow-auto p-3 md:p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
            {filtered.map(product => {
              const out = product.stockQty <= 0;
              return (
                <button key={product.id} onClick={() => handleAddProduct(product)}
                  className={cn('bg-card border border-border rounded-xl p-2.5 text-start hover:border-primary/50 hover:shadow-md transition-all group', out && 'opacity-60')}>
                  {product.imageUrl && <img src={product.imageUrl} alt="" className="w-full h-20 object-cover rounded-lg mb-1.5" loading="lazy" />}
                  <div className="flex items-start justify-between mb-0.5 gap-1">
                    <span className="text-[10px] font-medium text-muted-foreground uppercase truncate">{product.brand}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${product.category === 'Ladies' ? 'bg-pink-100 text-pink-700' : product.category === 'Gents' ? 'bg-blue-100 text-blue-700' : 'bg-muted text-muted-foreground'}`}>{product.category}</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground truncate">{product.article}</p>
                  <p className="text-xs text-muted-foreground truncate">{product.fabricCategory}{product.design ? ` · ${product.design}` : ''}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="font-bold text-primary text-sm">{settings.currency} {unitPriceFor(product, allowedSellUnits(product)[0], cartPriceTier).toLocaleString()}<span className="text-[10px] font-normal text-muted-foreground">/{UNIT_ICON[allowedSellUnits(product)[0]]}</span></span>
                    <span className={`text-[10px] font-mono ${product.stockQty <= product.lowStockThreshold ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {product.stockQty}{isMeterProduct(product) ? 'm' : 'pc'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          {filtered.length === 0 && <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">No products found</div>}
        </div>
      </div>

      {/* Right: Cart (desktop) */}
      <div className="hidden md:flex w-[390px] flex-shrink-0">{cartPanel}</div>

      {/* Mobile: floating cart button + sheet */}
      <button onClick={() => setCartOpen(true)} className="md:hidden fixed bottom-[72px] inset-x-3 z-20 h-12 rounded-xl bg-primary text-primary-foreground font-semibold shadow-xl flex items-center justify-between px-4">
        <span className="flex items-center gap-2"><ShoppingBag className="w-4 h-4" /> {cartCount} items</span>
        <span>{settings.currency} {payable.toLocaleString()}</span>
      </button>
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="bottom" className="p-0 h-[92dvh] md:hidden">{cartPanel}</SheetContent>
      </Sheet>

      {/* Colour picker */}
      <Dialog open={!!colorPickProduct} onOpenChange={() => setColorPickProduct(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Select Color — {colorPickProduct?.brand} {colorPickProduct?.article}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {colorPickProduct?.colorStocks.map(cs => (
              <button key={cs.color} onClick={() => { const p = colorPickProduct!; setColorPickProduct(null); handleAddProduct(p, cs.color); }}
                className={cn('flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/50 transition-colors', cs.quantity <= 0 && 'opacity-50')}>
                <span className="text-sm font-medium">{cs.color}</span>
                <span className="text-xs text-muted-foreground font-mono">{cs.quantity}{colorPickProduct!.stockMode.includes('meter') ? 'm' : 'pc'}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Meter / suit quantity dialog */}
      {addDialog && <MeterAddDialog key={addDialog.product.id + (addDialog.color || '')} product={addDialog.product} color={addDialog.color} tier={cartPriceTier} currency={settings.currency}
        onClose={() => setAddDialog(null)}
        onAdd={(unit, qty, rollId) => { addToCart(addDialog.product, addDialog.color, { sellUnit: unit, quantity: qty, rollId }); setAddDialog(null); }} />}

      {/* Customer dialog */}
      <Dialog open={showCustomer} onOpenChange={setShowCustomer}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Select Customer</DialogTitle></DialogHeader>
          <Input placeholder="Search by name or phone..." value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} className="mb-3" />
          <div className="max-h-48 overflow-auto space-y-1 mb-3">
            <button onClick={() => { setCartCustomer(null, ''); setShowCustomer(false); }} className="w-full text-start p-2 rounded-lg hover:bg-muted text-sm text-muted-foreground">{t('common.walkin')}</button>
            {filteredCustomers.map(c => {
              const bal = useStore.getState().getCustomerKhataBalance(c.id);
              return (
                <button key={c.id} onClick={() => { setCartCustomer(c.id, c.name); setShowCustomer(false); }} className="w-full text-start p-2 rounded-lg hover:bg-muted text-sm flex justify-between">
                  <span><span className="font-medium">{c.name}</span><span className="text-muted-foreground ms-2">{c.phone}</span></span>
                  {bal > 0 && <span className="text-xs text-warning">Udhar {bal.toLocaleString()}</span>}
                </button>
              );
            })}
          </div>
          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">New Customer</p>
            <Input placeholder="Name" value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)} />
            <Input placeholder="Phone" inputMode="tel" value={newCustomerPhone} onChange={e => setNewCustomerPhone(e.target.value)} />
            <Button size="sm" disabled={!newCustomerName} onClick={() => {
              const c = addCustomer({ name: newCustomerName, phone: newCustomerPhone });
              setCartCustomer(c.id, c.name);
              setNewCustomerName(''); setNewCustomerPhone('');
              setShowCustomer(false);
            }}>Add & Select</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Held Bills */}
      <Dialog open={showHeld} onOpenChange={setShowHeld}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t('pos.held')}</DialogTitle></DialogHeader>
          {heldBills.length === 0 ? <p className="text-sm text-muted-foreground">No held bills</p> : (
            <div className="space-y-2">
              {heldBills.map(b => (
                <div key={b.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div>
                    <p className="text-sm font-medium">{b.items.length} items · {b.customerName || 'Walk-in'}</p>
                    <p className="text-xs text-muted-foreground">{new Date(b.heldAt).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" disabled={cart.length > 0} title={cart.length > 0 ? 'Hold or clear the current cart first' : ''} onClick={() => { resumeBill(b.id); setShowHeld(false); }}>Resume</Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteHeldBill(b.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Return / Exchange */}
      {showReturn && <ReturnDialog sales={sales} currency={settings.currency} onClose={() => setShowReturn(false)} returnableQty={returnableQty}
        onDone={(ret, exchangeToCart) => {
          setShowReturn(false);
          if (exchangeToCart) {
            setCartExchange({ returnId: ret.id, invoice: ret.invoiceNumber, amount: Math.abs(ret.total) });
            if (ret.customerId) setCartCustomer(ret.customerId, ret.customerName || '');
            toast.success(`Return ${ret.invoiceNumber} saved. Add exchange items to the cart.`);
          } else {
            setLastSale(ret);
            toast.success(`Return ${ret.invoiceNumber} saved`);
          }
        }}
        processReturn={processReturn} />}

      {/* Invoice */}
      <Dialog open={!!lastSale} onOpenChange={v => !v && setLastSale(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[95dvh] overflow-auto">
          <DialogHeader><DialogTitle>{lastSale?.kind === 'return' ? 'Return receipt' : 'Invoice'} {lastSale?.invoiceNumber}</DialogTitle></DialogHeader>
          {lastSale && <InvoiceActions sale={lastSale} />}
        </DialogContent>
      </Dialog>
      {/* off-screen copy for auto-print */}
      {lastSale && <div ref={autoPrintRef} style={{ position: 'fixed', left: -10000, top: 0 }} aria-hidden><InvoiceReceipt sale={lastSale} /></div>}
    </div>
  );
}

function MeterAddDialog({ product, color, tier, currency, onAdd, onClose }: {
  product: Product; color?: string; tier: 'retail' | 'wholesale'; currency: string;
  onAdd: (unit: SellUnit, qty: number, rollId?: string) => void; onClose: () => void;
}) {
  const units = allowedSellUnits(product);
  const [unit, setUnit] = useState<SellUnit>(units.includes('meter') ? 'meter' : units[0]);
  const [qty, setQty] = useState(unit === 'meter' ? '' : '1');
  const [rollId, setRollId] = useState<string>('');
  const rolls = activeRolls(product, product.colorStocks.length ? color : undefined);
  const q = parseFloat(qty) || 0;
  const meters = baseQtyFor(product, unit, q);
  const avail = rollId ? rolls.find(r => r.id === rollId)?.remainingMeters ?? 0 : availableQty(product, color);
  const price = unitPriceFor(product, unit, tier);
  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{product.brand} {product.article}{color ? ` · ${color}` : ''}</DialogTitle>
          <DialogDescription>Available: {availableQty(product, color)} m{product.suitCutMeters ? ` · 1 suit = ${product.suitCutMeters} m` : ''}</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={e => { e.preventDefault(); if (q > 0) onAdd(unit, q, rollId || undefined); }}>
          <div className="grid grid-cols-2 gap-2">
            {units.map(u => (
              <button type="button" key={u} onClick={() => { setUnit(u); if (u !== 'meter' && !qty) setQty('1'); }}
                className={cn('rounded-lg border p-2 text-sm flex items-center justify-center gap-2', unit === u ? 'border-primary bg-primary/10 font-semibold' : 'border-border')}>
                {u === 'meter' ? <Ruler className="w-4 h-4" /> : <PackageIcon className="w-4 h-4" />}
                {u === 'meter' ? 'By meter' : 'By suit'} · {currency} {unitPriceFor(product, u, tier).toLocaleString()}
              </button>
            ))}
          </div>
          <div>
            <Label htmlFor="meter-qty">{unit === 'meter' ? 'Meters' : 'Suits'}</Label>
            <Input id="meter-qty" autoFocus type="number" inputMode="decimal" step={unit === 'meter' ? 0.25 : 1} min={0} value={qty} onChange={e => setQty(e.target.value)} className="text-lg font-mono" />
            <div className="flex flex-wrap gap-1 mt-1.5">
              {(unit === 'meter' ? [1, 2, 2.5, 3, 4, 4.5, 5, 6] : [1, 2, 3, 5]).map(v => (
                <button type="button" key={v} onClick={() => setQty(String(v))} className="px-2 py-0.5 text-xs rounded border border-border hover:bg-muted dense-touch">{v}</button>
              ))}
            </div>
          </div>
          {rolls.length > 0 && (
            <div>
              <Label htmlFor="meter-roll">Cut from thaan</Label>
              <select id="meter-roll" className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm" value={rollId} onChange={e => setRollId(e.target.value)}>
                <option value="">Auto (oldest first)</option>
                {rolls.map(r => <option key={r.id} value={r.id}>{r.rollNo}{r.color ? ` · ${r.color}` : ''} — {r.remainingMeters} m left</option>)}
              </select>
            </div>
          )}
          <div className="rounded-lg bg-muted p-2 text-sm flex justify-between">
            <span>{meters} m{meters > avail ? <span className="text-destructive"> (only {avail} m)</span> : ''}</span>
            <b>{currency} {round2(q * price).toLocaleString()}</b>
          </div>
          <Button type="submit" className="w-full" disabled={q <= 0}>Add {q || ''} {unitLabel(unit)}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReturnDialog({ sales, currency, onClose, onDone, processReturn, returnableQty }: {
  sales: Sale[]; currency: string; onClose: () => void; onDone: (ret: Sale, exchange: boolean) => void;
  processReturn: (saleId: string, lines: { index: number; quantity: number }[], method: PaymentMethod, note?: string) => Sale | null;
  returnableQty: (saleId: string) => number[];
}) {
  const [query, setQuery] = useState('');
  const [sale, setSale] = useState<Sale | null>(null);
  const [qty, setQty] = useState<Record<number, number>>({});
  const [method, setMethod] = useState<PaymentMethod>('Cash');
  const [note, setNote] = useState('');
  const { scan } = useScanner();
  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sales.filter(s => !s.deleted && s.kind !== 'return' && (!q || s.invoiceNumber.toLowerCase().includes(q) || (s.customerName || '').toLowerCase().includes(q) || (s.customerPhone || '').includes(q))).slice(-30).reverse();
  }, [sales, query]);
  const maxQ = sale ? returnableQty(sale.id) : [];
  const value = sale ? round2(sale.items.reduce((a, it, i) => a + (qty[i] || 0) * (it.quantity ? it.lineTotal / it.quantity : 0), 0) * (sale.subtotal ? 1 - sale.discountAmount / sale.subtotal : 1)) : 0;
  const lines = Object.entries(qty).map(([i, q]) => ({ index: Number(i), quantity: q })).filter(l => l.quantity > 0);

  const pickByCode = (code: string) => {
    let inv = code;
    try { inv = JSON.parse(code).inv || code; } catch { /* plain */ }
    const s = sales.find(x => x.invoiceNumber.toLowerCase() === inv.toLowerCase());
    if (s) { setSale(s); setQty({}); } else setQuery(inv);
  };

  const submit = (exchange: boolean) => {
    if (!sale) return;
    const r = processReturn(sale.id, lines, exchange ? 'Exchange' : method, note || undefined);
    if (!r) { toast.error('Nothing to return'); return; }
    onDone(r, exchange);
  };

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[92dvh] overflow-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Undo2 className="w-5 h-5" />Return / Exchange</DialogTitle>
          <DialogDescription>Returned goods go back into stock (and onto their thaan). Open udhar on the invoice is reduced first.</DialogDescription></DialogHeader>
        {!sale ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input autoFocus placeholder="Invoice no., customer or phone" value={query} onChange={e => setQuery(e.target.value)} />
              <Button variant="outline" size="icon" onClick={() => scan(pickByCode)} title="Scan invoice QR"><ScanLine className="w-4 h-4" /></Button>
            </div>
            <div className="max-h-72 overflow-auto divide-y divide-border">
              {candidates.map(s => (
                <button key={s.id} onClick={() => { setSale(s); setQty({}); }} className="w-full text-start py-2 px-1 hover:bg-muted rounded flex justify-between text-sm">
                  <span><b className="font-mono">{s.invoiceNumber}</b> · {s.customerName || 'Walk-in'}</span>
                  <span className="text-muted-foreground">{new Date(s.createdAt).toLocaleDateString()} · {currency} {s.total.toLocaleString()}</span>
                </button>
              ))}
              {candidates.length === 0 && <p className="text-sm text-muted-foreground p-4 text-center">No invoices found</p>}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between text-sm"><span><b>{sale.invoiceNumber}</b> · {sale.customerName || 'Walk-in'}</span><button className="text-primary text-xs" onClick={() => setSale(null)}>Change</button></div>
            <div className="divide-y divide-border border rounded-lg">
              {sale.items.map((it, i) => (
                <div key={i} className="flex items-center gap-2 p-2 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{it.product.brand} {it.product.article}{it.color ? ` (${it.color})` : ''}</p>
                    <p className="text-[11px] text-muted-foreground">Sold {it.quantity} {unitLabel(effectiveSellUnit(it))} · returnable {maxQ[i]}</p>
                  </div>
                  <Input type="number" inputMode="decimal" min={0} max={maxQ[i]} step={effectiveSellUnit(it) === 'meter' ? 0.25 : 1} className="w-20 h-8" disabled={!maxQ[i]}
                    value={qty[i] || ''} onChange={e => setQty(q => ({ ...q, [i]: Math.min(maxQ[i], Math.max(0, parseFloat(e.target.value) || 0)) }))} />
                  <span className="text-xs text-muted-foreground w-6">{unitLabel(effectiveSellUnit(it))}</span>
                </div>
              ))}
            </div>
            <Input placeholder="Reason / note" value={note} onChange={e => setNote(e.target.value)} />
            <div className="rounded-lg bg-muted p-2 flex justify-between text-sm"><span>Return value</span><b>{currency} {value.toLocaleString()}</b></div>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Select value={method} onValueChange={(v: PaymentMethod) => setMethod(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>Refund via {m}</SelectItem>)}</SelectContent>
              </Select>
              <Button variant="destructive" disabled={!lines.length} onClick={() => submit(false)}>Refund</Button>
            </div>
            <Button className="w-full" variant="secondary" disabled={!lines.length} onClick={() => submit(true)}>Exchange – apply {currency} {value.toLocaleString()} to a new bill</Button>
            <p className="text-[11px] text-muted-foreground">Partial returns are allowed until every item on the invoice has been returned.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
