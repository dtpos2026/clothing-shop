import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Product, Customer, Sale, CreditEntry, CreditPayment,
  GoodsReceiving, StoreSettings, CartItem, HeldBill, BackupEntry,
  PaymentMethod, SaleType, KhataEntry, Expense, SavingsTarget, AppUser,
  Account, AccountTransaction, Lead, Supplier, Purchase, PurchaseItem, SupplierPayment,
  StockAdjustment, CashEntry, DayClosing, SellUnit, PriceTier, SalePayment, FabricRoll,
} from '@/types';
import {
  addRoll, baseQtyFor, deductStock, defaultSellUnit, effectiveSellUnit, isMeterProduct, itemBaseQty,
  restoreStock, round2, unitPriceFor, costPerBaseUnit,
} from '@/core/inventory';
import { BUSINESS_COLLECTIONS, migrateState } from '@/core/migrations';
import { SCHEMA_VERSION } from '@/core/defaults';
import { cashBook, cashTotals, CASH_METHODS, dayOf, isReturn, salePayments, todayKey } from '@/core/accounting';
import { getDeviceId } from '@/platform/device';

const generateId = () => crypto.randomUUID();
const now = () => new Date().toISOString();

const lineTotalOf = (qty: number, unitPrice: number, discount: number) => round2(qty * unitPrice - discount);

export interface AddToCartOptions {
  sellUnit?: SellUnit;
  quantity?: number;
  rollId?: string;
}

export interface ReturnLine { index: number; quantity: number }

export interface PurchaseInput {
  supplierId?: string;
  supplierName: string;
  items: (PurchaseItem & { rollNo?: string })[];
  discount: number;
  paid: number;
  paymentMethod: PaymentMethod;
  notes?: string;
  /** For meter items: create one thaan per line (default true). */
  createRolls?: boolean;
}

/** Plain business data (what backups contain and sync replicates). */
export interface BusinessData {
  businessId: string;
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  credits: CreditEntry[];
  khataEntries: KhataEntry[];
  goodsReceivings: GoodsReceiving[];
  heldBills: HeldBill[];
  expenses: Expense[];
  savingsTargets: SavingsTarget[];
  users: AppUser[];
  accounts: Account[];
  accountTransactions: AccountTransaction[];
  leads: Lead[];
  suppliers: Supplier[];
  purchases: Purchase[];
  supplierPayments: SupplierPayment[];
  stockAdjustments: StockAdjustment[];
  cashEntries: CashEntry[];
  dayClosings: DayClosing[];
  settings: StoreSettings;
  invoiceCounter: number;
  purchaseCounter: number;
  returnCounter: number;
  lastDayCloseDate: string | null;
  backups: BackupEntry[];
}

interface AppState extends BusinessData {
  schemaVersion: number;
  demoSeeded: boolean;
  currentUser: { role: 'admin' | 'cashier' | 'father' | 'son'; name: string };
  isLoggedIn: boolean;
  _hasHydrated: boolean;

  // Cart state
  cart: CartItem[];
  cartCustomerId: string | null;
  cartCustomerName: string;
  cartNotes: string;
  cartDiscount: number;
  cartDiscountType: 'amount' | 'percent';
  cartPriceTier: PriceTier;
  /** Value of returned goods applied to this bill (exchange). */
  cartExchange: { returnId: string; invoice: string; amount: number } | null;

  // Actions - Products
  addProduct: (p: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Product;
  updateProduct: (id: string, p: Partial<Product>) => void;
  deleteProduct: (id: string) => void;

  // Actions - Cart
  addToCart: (product: Product, color?: string, opts?: AddToCartOptions) => void;
  updateCartItemQty: (productId: string, color: string | undefined, qty: number) => void;
  setCartItemUnit: (productId: string, color: string | undefined, unit: SellUnit) => void;
  setCartItemDiscount: (productId: string, color: string | undefined, discount: number) => void;
  removeFromCart: (productId: string, color?: string) => void;
  clearCart: () => void;
  setCartCustomer: (id: string | null, name: string) => void;
  setCartNotes: (n: string) => void;
  setCartDiscount: (amount: number, type: 'amount' | 'percent') => void;
  setCartPriceTier: (tier: PriceTier) => void;
  overrideCartItemPrice: (productId: string, color: string | undefined, price: number) => void;
  setCartExchange: (x: AppState['cartExchange']) => void;

  // Actions - Sales
  completeSale: (paymentMethod: PaymentMethod, saleType: SaleType, amountPaid: number, payments?: SalePayment[]) => Sale | null;
  deleteSale: (id: string) => void;
  processReturn: (saleId: string, lines: ReturnLine[], refundMethod: PaymentMethod, note?: string) => Sale | null;
  returnableQty: (saleId: string) => number[];

  // Actions - Customers
  addCustomer: (c: Omit<Customer, 'id' | 'createdAt'>) => Customer;
  updateCustomer: (id: string, c: Partial<Customer>) => void;
  deleteCustomer: (id: string) => boolean;

  // Actions - Credits
  addCreditPayment: (creditId: string, payment: Omit<CreditPayment, 'id' | 'date'>) => void;
  /** Spread a receipt across a customer's oldest open credits. Returns amount applied. */
  receiveCustomerPayment: (customerId: string, amount: number, method: PaymentMethod, note?: string) => number;

  // Actions - Manual Khata
  addKhataEntry: (entry: Omit<KhataEntry, 'id' | 'createdAt'>) => void;
  deleteKhataEntry: (id: string) => void;
  getCustomerKhataBalance: (customerId: string) => number;

  // Actions - Goods Receiving / Purchases / Suppliers / Adjustments
  receiveGoods: (entry: Omit<GoodsReceiving, 'id' | 'createdAt'> & { rollNo?: string }) => void;
  addSupplier: (s: Omit<Supplier, 'id' | 'createdAt'>) => Supplier;
  updateSupplier: (id: string, s: Partial<Supplier>) => void;
  deleteSupplier: (id: string) => boolean;
  addPurchase: (p: PurchaseInput) => Purchase;
  addSupplierPayment: (p: Omit<SupplierPayment, 'id' | 'createdAt' | 'date'> & { date?: string }) => void;
  addStockAdjustment: (a: Omit<StockAdjustment, 'id' | 'createdAt' | 'costValue' | 'userName' | 'productName'>) => StockAdjustment | null;
  updateRoll: (productId: string, rollId: string, patch: Partial<FabricRoll>) => void;

  // Actions - Held Bills
  holdBill: () => void;
  resumeBill: (id: string) => void;
  deleteHeldBill: (id: string) => void;

  // Actions - Settings
  updateSettings: (s: Partial<StoreSettings>) => void;

  // Actions - Day Close
  /** v1 name kept for compatibility – no longer deletes sales; records a closing instead. */
  closeDayAndResetSales: () => void;
  closeDay: (input: { countedCash: number; openingCash?: number; notes?: string }) => DayClosing;
  addCashEntry: (e: Omit<CashEntry, 'id' | 'createdAt'>) => void;
  deleteCashEntry: (id: string) => void;

  // Actions - Backup (legacy JSON; ZIP backups live in core/backup.ts)
  createBackup: () => string;
  restoreBackup: (data: string) => boolean;
  getBusinessData: () => BusinessData;
  replaceBusinessData: (data: Partial<BusinessData>) => void;
  recordBackup: (entry: Omit<BackupEntry, 'id'>) => void;
  markDemoSeeded: () => void;

  // Actions - Expenses
  addExpense: (e: Omit<Expense, 'id' | 'createdAt'>) => void;
  deleteExpense: (id: string) => void;

  // Actions - Savings Targets
  addSavingsTarget: (t: Omit<SavingsTarget, 'id' | 'createdAt'>) => void;
  deleteSavingsTarget: (id: string) => void;

  // Actions - Users
  addUser: (u: Omit<AppUser, 'id' | 'createdAt'>) => void;
  updateUser: (id: string, u: Partial<AppUser>) => void;
  deleteUser: (id: string) => void;
  setCurrentUser: (user: { role: 'admin' | 'cashier' | 'father' | 'son'; name: string }) => void;
  setLoggedIn: (v: boolean) => void;

  // Actions - Accounts
  addAccount: (a: Omit<Account, 'id' | 'createdAt'>) => void;
  deleteAccount: (id: string) => void;
  addAccountTransaction: (t: Omit<AccountTransaction, 'id' | 'createdAt'>) => void;

  // Actions - Leads
  addLead: (l: Omit<Lead, 'id' | 'createdAt'>) => void;
  updateLead: (id: string, l: Partial<Lead>) => void;
  deleteLead: (id: string) => void;

  // Computed helpers
  getCartTotal: () => { subtotal: number; discount: number; total: number; exchange: number; payable: number };
  getProduct: (id: string) => Product | undefined;
  getCustomer: (id: string) => Customer | undefined;
}

export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: 'My Clothing Store',
  logoUrl: '',
  logoWidth: 120,
  logoHeight: 60,
  phone: '',
  address: '',
  footerMessage: 'Thank you for shopping with us!',
  footerNote: '',
  customQrUrl: '',
  enableInvoiceQr: true,
  enableCustomQr: false,
  printerName: 'Default Printer',
  printerType: '80mm',
  autoPrint: false,
  printPreview: true,
  promoEnabled: false,
  promoDiscount: 0,
  currency: 'Rs.',
  displayFont: 'Plus Jakarta Sans',
  receiptFont: 'Montserrat',
  urduFont: 'Jameel Noori Nastaleeq',
  receiptTemplate: 'classic',
  developerName: 'Taimoor Younas',
  developerCompany: 'Digital Target',
  developerLogoUrl: '',
  monthlyHomeExpenseBudget: 0,
  monthlyShopExpenseBudget: 0,
  bwReports: false,
  language: 'en',
  backupReminderDays: 7,
};

const emptyCart = {
  cart: [] as CartItem[],
  cartCustomerId: null as string | null,
  cartCustomerName: '',
  cartNotes: '',
  cartDiscount: 0,
  cartDiscountType: 'amount' as const,
  cartExchange: null,
};

function pickBusinessData(s: AppState): BusinessData {
  const out: Record<string, unknown> = {};
  for (const c of BUSINESS_COLLECTIONS) out[c] = s[c];
  return {
    ...(out as unknown as BusinessData),
    businessId: s.businessId,
    settings: s.settings,
    invoiceCounter: s.invoiceCounter,
    purchaseCounter: s.purchaseCounter,
    returnCounter: s.returnCounter,
    lastDayCloseDate: s.lastDayCloseDate,
    backups: s.backups,
  };
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      businessId: `biz-${generateId()}`,
      schemaVersion: SCHEMA_VERSION,
      demoSeeded: false,
      _hasHydrated: false,
      products: [],
      customers: [],
      sales: [],
      credits: [],
      khataEntries: [],
      goodsReceivings: [],
      heldBills: [],
      backups: [],
      expenses: [],
      savingsTargets: [],
      users: [],
      accounts: [],
      accountTransactions: [],
      leads: [],
      suppliers: [],
      purchases: [],
      supplierPayments: [],
      stockAdjustments: [],
      cashEntries: [],
      dayClosings: [],
      invoiceCounter: 1000,
      purchaseCounter: 0,
      returnCounter: 0,
      lastDayCloseDate: null,
      isLoggedIn: false,
      currentUser: { role: 'admin', name: 'Admin' },
      settings: DEFAULT_SETTINGS,

      ...emptyCart,
      cartPriceTier: 'retail',

      // ---------------- Products ----------------
      addProduct: (p) => {
        const product: Product = { ...p, id: generateId(), createdAt: now(), updatedAt: now() };
        set((s) => ({ products: [...s.products, product] }));
        return product;
      },
      updateProduct: (id, p) => set((s) => ({
        products: s.products.map(pr => pr.id === id ? { ...pr, ...p, updatedAt: now() } : pr),
      })),
      deleteProduct: (id) => set((s) => ({
        products: s.products.filter(pr => pr.id !== id),
      })),

      // ---------------- Cart ----------------
      addToCart: (product, color, opts = {}) => set((s) => {
        const sellUnit = opts.sellUnit || defaultSellUnit(product);
        const addQty = opts.quantity ?? 1;
        const existing = s.cart.find(c => c.productId === product.id && c.color === color);
        if (existing && effectiveSellUnit(existing) === sellUnit && !opts.rollId) {
          return {
            cart: s.cart.map(c => {
              if (!(c.productId === product.id && c.color === color)) return c;
              const quantity = round2(c.quantity + addQty);
              return { ...c, quantity, lineTotal: lineTotalOf(quantity, c.unitPrice, c.discount) };
            }),
          };
        }
        const unitPrice = unitPriceFor(product, sellUnit, s.cartPriceTier);
        const item: CartItem = {
          productId: product.id,
          product,
          quantity: addQty,
          color,
          unitPrice,
          discount: 0,
          lineTotal: lineTotalOf(addQty, unitPrice, 0),
          sellUnit,
          priceTier: s.cartPriceTier,
          rollId: opts.rollId,
        };
        // a different unit for the same product/colour replaces the line
        return { cart: [...s.cart.filter(c => !(c.productId === product.id && c.color === color)), item] };
      }),
      updateCartItemQty: (productId, color, qty) => set((s) => ({
        cart: qty <= 0
          ? s.cart.filter(c => !(c.productId === productId && c.color === color))
          : s.cart.map(c =>
              c.productId === productId && c.color === color
                ? { ...c, quantity: round2(qty), lineTotal: lineTotalOf(qty, c.unitPrice, c.discount) }
                : c
            ),
      })),
      setCartItemUnit: (productId, color, unit) => set((s) => ({
        cart: s.cart.map(c => {
          if (!(c.productId === productId && c.color === color)) return c;
          const unitPrice = unitPriceFor(c.product, unit, c.priceTier || s.cartPriceTier);
          return { ...c, sellUnit: unit, unitPrice, lineTotal: lineTotalOf(c.quantity, unitPrice, c.discount) };
        }),
      })),
      setCartItemDiscount: (productId, color, discount) => set((s) => ({
        cart: s.cart.map(c => c.productId === productId && c.color === color
          ? { ...c, discount: Math.max(0, discount), lineTotal: lineTotalOf(c.quantity, c.unitPrice, Math.max(0, discount)) }
          : c),
      })),
      removeFromCart: (productId, color) => set((s) => ({
        cart: s.cart.filter(c => !(c.productId === productId && c.color === color)),
      })),
      clearCart: () => set({ ...emptyCart }),
      setCartCustomer: (id, name) => set({ cartCustomerId: id, cartCustomerName: name }),
      setCartNotes: (n) => set({ cartNotes: n }),
      setCartDiscount: (amount, type) => set({ cartDiscount: amount, cartDiscountType: type }),
      setCartPriceTier: (tier) => set((s) => ({
        cartPriceTier: tier,
        cart: s.cart.map(c => {
          const unitPrice = unitPriceFor(c.product, effectiveSellUnit(c), tier);
          return { ...c, priceTier: tier, unitPrice, lineTotal: lineTotalOf(c.quantity, unitPrice, c.discount) };
        }),
      })),
      overrideCartItemPrice: (productId, color, price) => set((s) => ({
        cart: s.cart.map(c =>
          c.productId === productId && c.color === color
            ? { ...c, unitPrice: price, lineTotal: lineTotalOf(c.quantity, price, c.discount) }
            : c
        ),
      })),
      setCartExchange: (x) => set({ cartExchange: x }),

      // ---------------- Sales ----------------
      completeSale: (paymentMethod, saleType, amountPaid, payments) => {
        const s = get();
        if (s.cart.length === 0) return null;

        const { subtotal, discount, total, exchange, payable } = s.getCartTotal();
        const exchangePay: SalePayment[] = exchange > 0 && s.cartExchange
          ? [{ method: 'Exchange', amount: exchange, reference: s.cartExchange.invoice }] : [];
        let moneyPayments: SalePayment[];
        if (payments && payments.length > 0) {
          moneyPayments = payments.filter(p => p.amount > 0);
        } else {
          const paid = saleType === 'cash' ? payable : Math.min(amountPaid, payable);
          moneyPayments = paid > 0 ? [{ method: paymentMethod, amount: round2(paid) }] : [];
        }
        // with explicit split payments the sale type follows the amount received
        const received = round2(moneyPayments.reduce((a, p) => a + p.amount, 0));
        const effType: SaleType = payments && payments.length > 0
          ? (received >= payable ? 'cash' : received > 0 ? 'partial' : 'credit')
          : saleType;
        const creditAmount = effType === 'cash' ? 0 : round2(Math.max(0, payable - received));
        if (creditAmount > 0 && !s.cartCustomerId) return null; // udhar needs a customer
        const invoiceNumber = `INV-${String(s.invoiceCounter + 1).padStart(5, '0')}`;
        const allPayments = [...exchangePay, ...moneyPayments];
        const primary = moneyPayments.slice().sort((a, b) => b.amount - a.amount)[0]?.method || paymentMethod;

        // Deduct stock & capture cost of goods per line
        let updatedProducts = s.products;
        const items: CartItem[] = s.cart.map(item => {
          const idx = updatedProducts.findIndex(p => p.id === item.productId);
          if (idx === -1) return { ...item, sellUnit: effectiveSellUnit(item) };
          const prod = updatedProducts[idx];
          const qty = baseQtyFor(prod, effectiveSellUnit(item), item.quantity);
          const res = deductStock(prod, qty, { color: item.color, rollId: item.rollId });
          updatedProducts = updatedProducts.map((p, i) => (i === idx ? { ...res.product, updatedAt: now() } : p));
          return { ...item, sellUnit: effectiveSellUnit(item), costTotal: res.cost, product: { ...prod, rolls: undefined, imageUrl: undefined } };
        });

        const sale: Sale = {
          id: generateId(),
          invoiceNumber,
          customerId: s.cartCustomerId || undefined,
          customerName: s.cartCustomerName || undefined,
          customerPhone: s.cartCustomerId ? s.customers.find(c => c.id === s.cartCustomerId)?.phone : undefined,
          items,
          subtotal,
          discountAmount: discount,
          discountPercent: s.cartDiscountType === 'percent' ? s.cartDiscount : 0,
          total,
          paymentMethod: primary,
          saleType: effType,
          amountPaid: round2(received + exchange),
          creditAmount,
          notes: s.cartNotes || undefined,
          createdAt: now(),
          deleted: false,
          kind: 'sale',
          payments: allPayments,
          cashierName: s.currentUser.name,
          deviceId: getDeviceId(),
          priceTier: s.cartPriceTier,
        };

        const newCredits = [...s.credits];
        if (creditAmount > 0 && s.cartCustomerId) {
          newCredits.push({
            id: generateId(),
            customerId: s.cartCustomerId,
            customerName: s.cartCustomerName,
            customerPhone: s.customers.find(c => c.id === s.cartCustomerId)?.phone || '',
            saleId: sale.id,
            invoiceNumber,
            totalAmount: creditAmount,
            paidAmount: 0,
            remainingAmount: creditAmount,
            payments: [],
            fullyPaid: false,
            createdAt: now(),
          });
        }

        set({
          sales: [...s.sales, sale],
          products: updatedProducts,
          credits: newCredits,
          invoiceCounter: s.invoiceCounter + 1,
          ...emptyCart,
          cartPriceTier: 'retail',
        });

        return sale;
      },

      deleteSale: (id) => {
        const s = get();
        const sale = s.sales.find(sl => sl.id === id);
        if (!sale || sale.deleted) return;

        let updatedProducts = s.products;
        for (const item of sale.items) {
          const idx = updatedProducts.findIndex(p => p.id === item.productId);
          if (idx === -1) continue;
          const qty = itemBaseQty({ ...item, product: updatedProducts[idx] });
          const prod = qty >= 0
            ? restoreStock(updatedProducts[idx], qty, { color: item.color, rollId: item.rollId })
            : deductStock(updatedProducts[idx], -qty, { color: item.color }).product; // deleting a return
          updatedProducts = updatedProducts.map((p, i) => (i === idx ? { ...prod, updatedAt: now() } : p));
        }

        set({
          sales: s.sales.map(sl => sl.id === id ? { ...sl, deleted: true, deletedAt: now() } : sl),
          products: updatedProducts,
          credits: s.credits.filter(c => c.saleId !== id),
        });
      },

      returnableQty: (saleId) => {
        const s = get();
        const sale = s.sales.find(x => x.id === saleId);
        if (!sale) return [];
        const returned = s.sales.filter(r => !r.deleted && r.kind === 'return' && r.returnOfId === saleId);
        return sale.items.map((it, idx) => {
          const already = returned.reduce((a, r) => a + r.items
            .filter(ri => ri.productId === it.productId && ri.color === it.color && effectiveSellUnit(ri) === effectiveSellUnit(it))
            .reduce((b, ri) => b + Math.abs(ri.quantity), 0), 0);
          void idx;
          return round2(Math.max(0, it.quantity - already));
        });
      },

      processReturn: (saleId, lines, refundMethod, note) => {
        const s = get();
        const orig = s.sales.find(x => x.id === saleId && !x.deleted && x.kind !== 'return');
        if (!orig) return null;
        const maxQty = s.returnableQty(saleId);
        const valid = lines.filter(l => l.quantity > 0 && l.index < orig.items.length && l.quantity <= maxQty[l.index] + 1e-9);
        if (valid.length === 0) return null;

        // proportional share of the bill discount, so refunds match what was paid
        const discRatio = orig.subtotal > 0 ? orig.discountAmount / orig.subtotal : 0;
        let updatedProducts = s.products;
        const items: CartItem[] = valid.map(l => {
          const it = orig.items[l.index];
          const perUnit = it.quantity ? it.lineTotal / it.quantity : it.unitPrice;
          const value = round2(perUnit * l.quantity);
          const idx = updatedProducts.findIndex(p => p.id === it.productId);
          let cost = 0;
          if (idx !== -1) {
            const prod = updatedProducts[idx];
            const qty = baseQtyFor(prod, effectiveSellUnit(it), l.quantity);
            cost = it.costTotal !== undefined && it.quantity ? round2((it.costTotal / it.quantity) * l.quantity) : round2(qty * costPerBaseUnit(prod, it.color));
            updatedProducts = updatedProducts.map((p, i) => (i === idx ? { ...restoreStock(prod, qty, { color: it.color, rollId: it.rollId }), updatedAt: now() } : p));
          }
          return { ...it, quantity: -l.quantity, discount: 0, lineTotal: -value, costTotal: -cost };
        });
        const subtotal = round2(items.reduce((a, i) => a + i.lineTotal, 0)); // negative
        const discountBack = round2(subtotal * discRatio); // negative
        const total = round2(subtotal - discountBack);
        const refundValue = Math.abs(total);

        // returned value first clears any open udhar on the original invoice
        let credits = s.credits;
        let adjusted = 0;
        const credit = s.credits.find(c => c.saleId === orig.id && !c.fullyPaid);
        if (credit && refundMethod !== 'Exchange') {
          adjusted = round2(Math.min(credit.remainingAmount, refundValue));
          if (adjusted > 0) {
            const pay: CreditPayment = { id: generateId(), amount: adjusted, method: 'Exchange', note: 'Adjusted against goods return', date: now() };
            credits = s.credits.map(c => c.id === credit.id ? {
              ...c, payments: [...c.payments, pay], paidAmount: round2(c.paidAmount + adjusted),
              remainingAmount: round2(c.remainingAmount - adjusted), fullyPaid: c.remainingAmount - adjusted <= 0.009,
            } : c);
          }
        }
        const refundCash = round2(refundValue - adjusted);
        const returnCounter = s.returnCounter + 1;
        const ret: Sale = {
          id: generateId(),
          invoiceNumber: `RET-${String(returnCounter).padStart(5, '0')}`,
          customerId: orig.customerId,
          customerName: orig.customerName,
          customerPhone: orig.customerPhone,
          items,
          subtotal,
          discountAmount: discountBack,
          discountPercent: 0,
          total,
          paymentMethod: refundMethod,
          saleType: 'cash',
          amountPaid: -refundCash,
          creditAmount: 0,
          notes: note || `Return against ${orig.invoiceNumber}`,
          createdAt: now(),
          deleted: false,
          kind: 'return',
          returnOfId: orig.id,
          returnOfInvoice: orig.invoiceNumber,
          payments: refundCash > 0 ? [{ method: refundMethod, amount: -refundCash }] : [],
          cashierName: s.currentUser.name,
          deviceId: getDeviceId(),
        };
        set({ sales: [...s.sales, ret], products: updatedProducts, credits, returnCounter });
        return ret;
      },

      // ---------------- Customers ----------------
      addCustomer: (c) => {
        const customer: Customer = { ...c, id: generateId(), createdAt: now() };
        set((s) => ({ customers: [...s.customers, customer] }));
        return customer;
      },
      updateCustomer: (id, c) => set((s) => ({
        customers: s.customers.map(cu => cu.id === id ? { ...cu, ...c, updatedAt: now() } : cu),
      })),
      deleteCustomer: (id) => {
        const s = get();
        const used = s.sales.some(x => x.customerId === id) || s.credits.some(x => x.customerId === id) || s.khataEntries.some(x => x.customerId === id);
        if (used) return false; // keep history intact
        set({ customers: s.customers.filter(c => c.id !== id) });
        return true;
      },

      // ---------------- Credits ----------------
      addCreditPayment: (creditId, payment) => set((s) => ({
        credits: s.credits.map(c => {
          if (c.id !== creditId) return c;
          const p: CreditPayment = { ...payment, id: generateId(), date: now() };
          const newPaid = round2(c.paidAmount + p.amount);
          return {
            ...c,
            payments: [...c.payments, p],
            paidAmount: newPaid,
            remainingAmount: round2(c.totalAmount - newPaid),
            fullyPaid: newPaid >= c.totalAmount,
          };
        }),
      })),
      receiveCustomerPayment: (customerId, amount, method, note) => {
        let left = round2(amount);
        const open = get().credits.filter(c => c.customerId === customerId && !c.fullyPaid)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        for (const c of open) {
          if (left <= 0) break;
          const pay = round2(Math.min(left, c.remainingAmount));
          get().addCreditPayment(c.id, { amount: pay, method, note });
          left = round2(left - pay);
        }
        if (left > 0) {
          const cust = get().customers.find(c => c.id === customerId);
          get().addKhataEntry({
            customerId, customerName: cust?.name || '', customerPhone: cust?.phone || '',
            type: 'take', amount: left, description: note || `Payment received (${method})`, date: now(),
          });
        }
        return round2(amount);
      },

      // ---------------- Manual Khata ----------------
      addKhataEntry: (entry) => set((s) => ({
        khataEntries: [...s.khataEntries, { ...entry, id: generateId(), createdAt: now() }],
      })),
      deleteKhataEntry: (id) => set((s) => ({
        khataEntries: s.khataEntries.filter(e => e.id !== id),
      })),
      getCustomerKhataBalance: (customerId) => {
        const s = get();
        const creditDue = s.credits
          .filter(c => c.customerId === customerId && !c.fullyPaid)
          .reduce((sum, c) => sum + c.remainingAmount, 0);
        const manualBalance = s.khataEntries
          .filter(e => e.customerId === customerId)
          .reduce((sum, e) => e.type === 'give' ? sum + e.amount : sum - e.amount, 0);
        const opening = s.customers.find(c => c.id === customerId)?.openingBalance || 0;
        return round2(creditDue + manualBalance + opening);
      },

      // ---------------- Goods Receiving ----------------
      receiveGoods: (entry) => {
        const s = get();
        const prod = s.products.find(p => p.id === entry.productId);
        if (!prod) return;

        let updatedProd: Product;
        if (isMeterProduct(prod) && entry.rollNo) {
          // a new Thaan: tracked individually with its own cost
          updatedProd = addRoll(prod, {
            rollNo: entry.rollNo, color: entry.colorAdded, initialMeters: entry.quantityAdded,
            costPerMeter: entry.costPrice ?? costPerBaseUnit(prod, entry.colorAdded),
            supplierName: entry.supplier, receivedAt: now(), notes: entry.notes,
          }, generateId, now());
        } else {
          updatedProd = restoreStock(prod, entry.quantityAdded, { color: entry.colorAdded || undefined });
        }
        const { rollNo: _r, ...rest } = entry;
        void _r;
        set((st) => ({
          products: st.products.map(p => p.id === entry.productId ? { ...updatedProd, updatedAt: now() } : p),
          goodsReceivings: [...st.goodsReceivings, { ...rest, notes: entry.rollNo ? `Thaan ${entry.rollNo}${rest.notes ? ` – ${rest.notes}` : ''}` : rest.notes, id: generateId(), createdAt: now() }],
        }));
      },

      // ---------------- Suppliers / Purchases ----------------
      addSupplier: (sup) => {
        const supplier: Supplier = { ...sup, id: generateId(), createdAt: now() };
        set((s) => ({ suppliers: [...s.suppliers, supplier] }));
        return supplier;
      },
      updateSupplier: (id, sup) => set((s) => ({
        suppliers: s.suppliers.map(x => x.id === id ? { ...x, ...sup, updatedAt: now() } : x),
      })),
      deleteSupplier: (id) => {
        const s = get();
        if (s.purchases.some(p => p.supplierId === id) || s.supplierPayments.some(p => p.supplierId === id)) return false;
        set({ suppliers: s.suppliers.filter(x => x.id !== id) });
        return true;
      },
      addPurchase: (input) => {
        const s = get();
        const purchaseCounter = s.purchaseCounter + 1;
        const purchaseNumber = `PUR-${String(purchaseCounter).padStart(5, '0')}`;
        const purchaseId = generateId();
        let products = s.products;
        const receivings: GoodsReceiving[] = [];
        const items = input.items.map(it => ({ ...it, lineTotal: round2(it.quantity * it.costPrice) }));
        for (const it of items) {
          const idx = products.findIndex(p => p.id === it.productId);
          if (idx === -1) continue;
          const prod = products[idx];
          let updated: Product;
          if (isMeterProduct(prod) && input.createRolls !== false) {
            updated = addRoll(prod, {
              rollNo: it.rollNo || `${purchaseNumber}-${receivings.length + 1}`, color: it.color, initialMeters: it.quantity,
              costPerMeter: it.costPrice, supplierId: input.supplierId, supplierName: input.supplierName,
              purchaseId, receivedAt: now(),
            }, generateId, now());
          } else {
            updated = restoreStock(prod, it.quantity, { color: it.color });
          }
          // keep the product's reference cost in sync with the latest purchase
          const costPrice = isMeterProduct(prod) && prod.suitCutMeters > 0 ? round2(it.costPrice * prod.suitCutMeters) : it.costPrice;
          products = products.map((p, i) => (i === idx ? { ...updated, costPrice, supplierId: input.supplierId || p.supplierId, updatedAt: now() } : p));
          receivings.push({
            id: generateId(), productId: prod.id, productName: `${prod.brand} ${prod.article}`, brand: prod.brand,
            quantityAdded: it.quantity, stockMode: prod.stockMode, colorAdded: it.color, costPrice: it.costPrice,
            supplier: input.supplierName, notes: `Purchase ${purchaseNumber}`, createdAt: now(),
          });
        }
        const subtotal = round2(items.reduce((a, i) => a + i.lineTotal, 0));
        const total = round2(subtotal - (input.discount || 0));
        const paid = round2(Math.min(input.paid || 0, total));
        const purchase: Purchase = {
          id: purchaseId, purchaseNumber, supplierId: input.supplierId, supplierName: input.supplierName,
          items, subtotal, discount: input.discount || 0, total, paid, due: round2(total - paid),
          paymentMethod: input.paymentMethod, notes: input.notes, createdAt: now(),
        };
        set({
          products, purchaseCounter,
          purchases: [...s.purchases, purchase],
          goodsReceivings: [...s.goodsReceivings, ...receivings],
        });
        return purchase;
      },
      addSupplierPayment: (p) => set((s) => ({
        supplierPayments: [...s.supplierPayments, { ...p, date: p.date || now(), id: generateId(), createdAt: now() }],
      })),

      addStockAdjustment: (a) => {
        const s = get();
        const prod = s.products.find(p => p.id === a.productId);
        if (!prod || a.quantity <= 0) return null;
        const removing = a.type !== 'correction_add';
        let updated: Product;
        let costValue: number;
        if (removing) {
          const res = deductStock(prod, a.quantity, { color: a.color, rollId: a.rollId });
          updated = res.product;
          costValue = res.cost;
        } else {
          updated = restoreStock(prod, a.quantity, { color: a.color, rollId: a.rollId });
          costValue = round2(a.quantity * costPerBaseUnit(prod, a.color));
        }
        const adj: StockAdjustment = {
          ...a, id: generateId(), createdAt: now(), costValue, userName: s.currentUser.name,
          productName: `${prod.brand} ${prod.article}`,
        };
        set({
          products: s.products.map(p => p.id === prod.id ? { ...updated, updatedAt: now() } : p),
          stockAdjustments: [...s.stockAdjustments, adj],
        });
        return adj;
      },
      updateRoll: (productId, rollId, patch) => set((s) => ({
        products: s.products.map(p => {
          if (p.id !== productId || !p.rolls) return p;
          const rolls = p.rolls.map(r => r.id === rollId ? { ...r, ...patch } : r);
          // recompute totals from the edited rolls
          const active = rolls.filter(r => r.status === 'active');
          const colorStocks = p.colorStocks.length
            ? p.colorStocks.map(c => ({ ...c, quantity: round2(active.filter(r => (r.color || 'Default') === c.color).reduce((a, r) => a + r.remainingMeters, 0)) }))
            : p.colorStocks;
          return { ...p, rolls, colorStocks, stockQty: round2(active.reduce((a, r) => a + r.remainingMeters, 0)), updatedAt: now() };
        }),
      })),

      // ---------------- Held Bills ----------------
      holdBill: () => set((s) => {
        if (s.cart.length === 0) return s;
        return {
          heldBills: [...s.heldBills, {
            id: generateId(),
            items: [...s.cart],
            customerId: s.cartCustomerId || undefined,
            customerName: s.cartCustomerName || undefined,
            notes: s.cartNotes || undefined,
            heldAt: now(),
          }],
          ...emptyCart,
        };
      }),
      resumeBill: (id) => set((s) => {
        const bill = s.heldBills.find(b => b.id === id);
        if (!bill) return s;
        return {
          cart: bill.items,
          cartCustomerId: bill.customerId || null,
          cartCustomerName: bill.customerName || '',
          cartNotes: bill.notes || '',
          heldBills: s.heldBills.filter(b => b.id !== id),
        };
      }),
      deleteHeldBill: (id) => set((s) => ({
        heldBills: s.heldBills.filter(b => b.id !== id),
      })),

      // ---------------- Day Close ----------------
      closeDayAndResetSales: () => {
        const s = get();
        const expected = s.closeDay({ countedCash: NaN });
        void expected;
      },
      closeDay: ({ countedCash, openingCash, notes }) => {
        const s = get();
        const day = todayKey();
        const prev = [...s.dayClosings].sort((a, b) => b.date.localeCompare(a.date))[0];
        const opening = openingCash ?? (prev ? (Number.isFinite(prev.countedCash) ? prev.countedCash : prev.expectedCash) : 0);
        const book = cashBook(s, { from: day, to: day });
        const { cashIn, cashOut } = cashTotals(book, CASH_METHODS);
        const todays = s.sales.filter(x => !x.deleted && dayOf(x.createdAt) === day);
        const expected = round2(opening + cashIn - cashOut);
        const counted = Number.isFinite(countedCash) ? countedCash : expected;
        const closing: DayClosing = {
          id: generateId(), date: day, openingCash: opening, cashIn, cashOut, expectedCash: expected,
          countedCash: counted, difference: round2(counted - expected),
          totalSales: round2(todays.filter(x => !isReturn(x)).reduce((a, x) => a + x.total, 0)),
          totalReturns: round2(-todays.filter(isReturn).reduce((a, x) => a + x.total, 0)),
          billCount: todays.filter(x => !isReturn(x)).length,
          creditGiven: round2(todays.reduce((a, x) => a + x.creditAmount, 0)),
          discountGiven: round2(todays.filter(x => !isReturn(x)).reduce((a, x) => a + x.discountAmount, 0)),
          expenses: round2(book.filter(e => e.source === 'expense').reduce((a, e) => a + e.amount, 0)),
          closedBy: s.currentUser.name, notes, createdAt: now(),
        };
        set({ dayClosings: [...s.dayClosings.filter(d => d.date !== day), closing], lastDayCloseDate: now() });
        return closing;
      },
      addCashEntry: (e) => set((s) => ({ cashEntries: [...s.cashEntries, { ...e, id: generateId(), createdAt: now() }] })),
      deleteCashEntry: (id) => set((s) => ({ cashEntries: s.cashEntries.filter(e => e.id !== id) })),

      // ---------------- Settings ----------------
      updateSettings: (s) => set((state) => ({
        settings: { ...state.settings, ...s },
      })),

      // ---------------- Expenses ----------------
      addExpense: (e) => set((s) => ({
        expenses: [...s.expenses, { ...e, id: generateId(), createdAt: now() }],
      })),
      deleteExpense: (id) => set((s) => ({
        expenses: s.expenses.filter(e => e.id !== id),
      })),

      // ---------------- Savings Targets ----------------
      addSavingsTarget: (t) => set((s) => ({
        savingsTargets: [...s.savingsTargets, { ...t, id: generateId(), createdAt: now() }],
      })),
      deleteSavingsTarget: (id) => set((s) => ({
        savingsTargets: s.savingsTargets.filter(t => t.id !== id),
      })),

      // ---------------- Users ----------------
      addUser: (u) => set((s) => ({
        users: [...s.users, { ...u, id: generateId(), createdAt: now() }],
      })),
      updateUser: (id, u) => set((s) => ({
        users: s.users.map(usr => usr.id === id ? { ...usr, ...u } : usr),
      })),
      deleteUser: (id) => set((s) => ({
        users: s.users.filter(u => u.id !== id),
      })),
      setCurrentUser: (user) => set({ currentUser: user, isLoggedIn: true }),
      setLoggedIn: (v) => set({ isLoggedIn: v }),

      // ---------------- Accounts ----------------
      addAccount: (a) => set((s) => ({
        accounts: [...s.accounts, { ...a, id: generateId(), createdAt: now() }],
      })),
      deleteAccount: (id) => set((s) => ({
        accounts: s.accounts.filter(a => a.id !== id),
        accountTransactions: s.accountTransactions.filter(t => t.accountId !== id),
      })),
      addAccountTransaction: (t) => set((s) => {
        const balanceChange = t.type === 'credit' ? t.amount : -t.amount;
        return {
          accountTransactions: [...s.accountTransactions, { ...t, id: generateId(), createdAt: now() }],
          accounts: s.accounts.map(a => a.id === t.accountId ? { ...a, balance: a.balance + balanceChange } : a),
        };
      }),

      // ---------------- Leads ----------------
      addLead: (l) => set((s) => ({
        leads: [...s.leads, { ...l, id: generateId(), createdAt: now() }],
      })),
      updateLead: (id, l) => set((s) => ({
        leads: s.leads.map(lead => lead.id === id ? { ...lead, ...l } : lead),
      })),
      deleteLead: (id) => set((s) => ({
        leads: s.leads.filter(l => l.id !== id),
      })),

      // ---------------- Backup ----------------
      getBusinessData: () => pickBusinessData(get()),
      replaceBusinessData: (data) => {
        const migrated = migrateState(data as Record<string, unknown>, (data as { schemaVersion?: number }).schemaVersion ?? 1) as Partial<BusinessData>;
        const next: Partial<AppState> = {};
        for (const c of BUSINESS_COLLECTIONS) (next as Record<string, unknown>)[c] = migrated[c] ?? [];
        set({
          ...next,
          businessId: migrated.businessId || get().businessId,
          settings: { ...DEFAULT_SETTINGS, ...(migrated.settings || get().settings) },
          invoiceCounter: migrated.invoiceCounter ?? get().invoiceCounter,
          purchaseCounter: migrated.purchaseCounter ?? 0,
          returnCounter: migrated.returnCounter ?? 0,
          lastDayCloseDate: migrated.lastDayCloseDate ?? null,
          backups: [...get().backups, ...((migrated.backups as BackupEntry[]) || []).filter(b => !get().backups.some(x => x.id === b.id))],
          demoSeeded: true,
          ...emptyCart,
        });
      },
      recordBackup: (entry) => set((s) => ({
        backups: [...s.backups, { ...entry, id: generateId() }].slice(-100),
        settings: entry.type === 'safety' ? s.settings : { ...s.settings, lastBackupAt: entry.date },
      })),
      markDemoSeeded: () => set({ demoSeeded: true }),

      /** Legacy v1 JSON backup (still supported for old files). */
      createBackup: () => {
        const s = get();
        const data = JSON.stringify({ ...pickBusinessData(s), schemaVersion: SCHEMA_VERSION });
        const entry: BackupEntry = {
          id: generateId(),
          date: now(),
          size: `${(data.length / 1024).toFixed(1)} KB`,
          type: 'manual',
        };
        set((st) => ({ backups: [...st.backups, entry], settings: { ...st.settings, lastBackupAt: entry.date } }));
        return data;
      },
      restoreBackup: (data) => {
        try {
          const parsed = JSON.parse(data);
          if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.products)) return false;
          get().replaceBusinessData(parsed);
          return true;
        } catch {
          return false;
        }
      },

      // ---------------- Helpers ----------------
      getCartTotal: () => {
        const s = get();
        const subtotal = round2(s.cart.reduce((sum, item) => sum + item.lineTotal, 0));
        let discount = 0;
        if (s.cartDiscountType === 'percent') {
          discount = subtotal * (s.cartDiscount / 100);
        } else {
          discount = s.cartDiscount;
        }
        if (s.settings.promoEnabled && s.settings.promoDiscount > 0) {
          discount += subtotal * (s.settings.promoDiscount / 100);
        }
        discount = round2(discount);
        const total = round2(Math.max(0, subtotal - discount));
        const exchange = round2(Math.min(total, s.cartExchange?.amount || 0));
        return { subtotal, discount, total, exchange, payable: round2(total - exchange) };
      },
      getProduct: (id) => get().products.find(p => p.id === id),
      getCustomer: (id) => get().customers.find(c => c.id === id),
    }),
    {
      name: 'clothing-pos-store',
      version: SCHEMA_VERSION,
      migrate: (persisted, version) => migrateState(persisted as Record<string, unknown>, version) as unknown as AppState,
      partialize: (s) => {
        // runtime-only flags are not persisted
        const { _hasHydrated, ...rest } = s;
        void _hasHydrated;
        return rest as AppState;
      },
      onRehydrateStorage: () => () => {
        useStore.setState({ _hasHydrated: true });
      },
      storage: {
        getItem: async (name) => {
          let raw: string | null = null;
          if (window.electronStore) {
            raw = await window.electronStore.getItem(name);
          } else {
            raw = localStorage.getItem(name);
          }
          return raw ? JSON.parse(raw) : null;
        },
        setItem: async (name, value) => {
          const raw = JSON.stringify(value);
          if (window.electronStore) {
            await window.electronStore.setItem(name, raw);
          } else {
            localStorage.setItem(name, raw);
          }
        },
        removeItem: async (name) => {
          if (window.electronStore) {
            await window.electronStore.removeItem(name);
          } else {
            localStorage.removeItem(name);
          }
        },
      },
    }
  )
);

export const salePaymentsOf = salePayments;
