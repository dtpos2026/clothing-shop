import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Product, Customer, Sale, CreditEntry, CreditPayment,
  GoodsReceiving, StoreSettings, CartItem, HeldBill, BackupEntry,
  PaymentMethod, SaleType, ColorStock, KhataEntry, Expense, SavingsTarget, AppUser,
  Account, AccountTransaction, Lead
} from '@/types';

const generateId = () => crypto.randomUUID();
const now = () => new Date().toISOString();

interface AppState {
  // Data
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  credits: CreditEntry[];
  khataEntries: KhataEntry[];
  goodsReceivings: GoodsReceiving[];
  heldBills: HeldBill[];
  backups: BackupEntry[];
  expenses: Expense[];
  savingsTargets: SavingsTarget[];
  users: AppUser[];
  accounts: Account[];
  accountTransactions: AccountTransaction[];
  leads: Lead[];
  settings: StoreSettings;
  currentUser: { role: 'admin' | 'cashier' | 'father' | 'son'; name: string };
  invoiceCounter: number;
  isLoggedIn: boolean;

  // Cart state
  cart: CartItem[];
  cartCustomerId: string | null;
  cartCustomerName: string;
  cartNotes: string;
  cartDiscount: number;
  cartDiscountType: 'amount' | 'percent';

  // Actions - Products
  addProduct: (p: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateProduct: (id: string, p: Partial<Product>) => void;
  deleteProduct: (id: string) => void;

  // Actions - Cart
  addToCart: (product: Product, color?: string) => void;
  updateCartItemQty: (productId: string, color: string | undefined, qty: number) => void;
  removeFromCart: (productId: string, color?: string) => void;
  clearCart: () => void;
  setCartCustomer: (id: string | null, name: string) => void;
  setCartNotes: (n: string) => void;
  setCartDiscount: (amount: number, type: 'amount' | 'percent') => void;
  overrideCartItemPrice: (productId: string, color: string | undefined, price: number) => void;

  // Actions - Sales
  completeSale: (paymentMethod: PaymentMethod, saleType: SaleType, amountPaid: number) => Sale | null;
  deleteSale: (id: string) => void;

  // Actions - Customers
  addCustomer: (c: Omit<Customer, 'id' | 'createdAt'>) => Customer;
  updateCustomer: (id: string, c: Partial<Customer>) => void;

  // Actions - Credits
  addCreditPayment: (creditId: string, payment: Omit<CreditPayment, 'id' | 'date'>) => void;

  // Actions - Manual Khata
  addKhataEntry: (entry: Omit<KhataEntry, 'id' | 'createdAt'>) => void;
  deleteKhataEntry: (id: string) => void;
  getCustomerKhataBalance: (customerId: string) => number;

  // Actions - Goods Receiving
  receiveGoods: (entry: Omit<GoodsReceiving, 'id' | 'createdAt'>) => void;

  // Actions - Held Bills
  holdBill: () => void;
  resumeBill: (id: string) => void;
  deleteHeldBill: (id: string) => void;

  // Actions - Settings
  updateSettings: (s: Partial<StoreSettings>) => void;

  // Actions - Day Close
  closeDayAndResetSales: () => void;
  lastDayCloseDate: string | null;

  // Actions - Backup
  createBackup: () => string;
  restoreBackup: (data: string) => boolean;

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
  getCartTotal: () => { subtotal: number; discount: number; total: number };
  getProduct: (id: string) => Product | undefined;
  getCustomer: (id: string) => Customer | undefined;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
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
      invoiceCounter: 1000,
      lastDayCloseDate: null,
      isLoggedIn: false,
      currentUser: { role: 'admin', name: 'Admin' },
      settings: {
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
      },

      // Cart
      cart: [],
      cartCustomerId: null,
      cartCustomerName: '',
      cartNotes: '',
      cartDiscount: 0,
      cartDiscountType: 'amount',

      // Product actions
      addProduct: (p) => set((s) => ({
        products: [...s.products, { ...p, id: generateId(), createdAt: now(), updatedAt: now() }],
      })),
      updateProduct: (id, p) => set((s) => ({
        products: s.products.map(pr => pr.id === id ? { ...pr, ...p, updatedAt: now() } : pr),
      })),
      deleteProduct: (id) => set((s) => ({
        products: s.products.filter(pr => pr.id !== id),
      })),

      // Cart actions
      addToCart: (product, color) => set((s) => {
        const existing = s.cart.find(c => c.productId === product.id && c.color === color);
        if (existing) {
          return {
            cart: s.cart.map(c =>
              c.productId === product.id && c.color === color
                ? { ...c, quantity: c.quantity + 1, lineTotal: (c.quantity + 1) * c.unitPrice - c.discount }
                : c
            ),
          };
        }
        const item: CartItem = {
          productId: product.id,
          product,
          quantity: 1,
          color,
          unitPrice: product.salePrice,
          discount: 0,
          lineTotal: product.salePrice,
        };
        return { cart: [...s.cart, item] };
      }),
      updateCartItemQty: (productId, color, qty) => set((s) => ({
        cart: qty <= 0
          ? s.cart.filter(c => !(c.productId === productId && c.color === color))
          : s.cart.map(c =>
              c.productId === productId && c.color === color
                ? { ...c, quantity: qty, lineTotal: qty * c.unitPrice - c.discount }
                : c
            ),
      })),
      removeFromCart: (productId, color) => set((s) => ({
        cart: s.cart.filter(c => !(c.productId === productId && c.color === color)),
      })),
      clearCart: () => set({ cart: [], cartCustomerId: null, cartCustomerName: '', cartNotes: '', cartDiscount: 0, cartDiscountType: 'amount' }),
      setCartCustomer: (id, name) => set({ cartCustomerId: id, cartCustomerName: name }),
      setCartNotes: (n) => set({ cartNotes: n }),
      setCartDiscount: (amount, type) => set({ cartDiscount: amount, cartDiscountType: type }),
      overrideCartItemPrice: (productId, color, price) => set((s) => ({
        cart: s.cart.map(c =>
          c.productId === productId && c.color === color
            ? { ...c, unitPrice: price, lineTotal: c.quantity * price - c.discount }
            : c
        ),
      })),

      // Sale
      completeSale: (paymentMethod, saleType, amountPaid) => {
        const s = get();
        if (s.cart.length === 0) return null;

        const { subtotal, discount, total } = s.getCartTotal();
        const creditAmount = saleType === 'credit' ? total : saleType === 'partial' ? total - amountPaid : 0;
        const invoiceNumber = `INV-${String(s.invoiceCounter + 1).padStart(5, '0')}`;

        const sale: Sale = {
          id: generateId(),
          invoiceNumber,
          customerId: s.cartCustomerId || undefined,
          customerName: s.cartCustomerName || undefined,
          customerPhone: s.cartCustomerId ? s.customers.find(c => c.id === s.cartCustomerId)?.phone : undefined,
          items: [...s.cart],
          subtotal,
          discountAmount: discount,
          discountPercent: s.cartDiscountType === 'percent' ? s.cartDiscount : 0,
          total,
          paymentMethod,
          saleType,
          amountPaid: saleType === 'cash' ? total : amountPaid,
          creditAmount,
          notes: s.cartNotes || undefined,
          createdAt: now(),
          deleted: false,
        };

        // Deduct stock
        const updatedProducts = [...s.products];
        for (const item of s.cart) {
          const pIdx = updatedProducts.findIndex(p => p.id === item.productId);
          if (pIdx === -1) continue;
          const prod = { ...updatedProducts[pIdx] };

          if (prod.stockMode === 'meter' || prod.stockMode === 'color_meter') {
            const deduction = item.quantity * prod.suitCutMeters;
            if (item.color && prod.colorStocks.length > 0) {
              prod.colorStocks = prod.colorStocks.map(cs =>
                cs.color === item.color ? { ...cs, quantity: Math.max(0, cs.quantity - deduction) } : cs
              );
              prod.stockQty = prod.colorStocks.reduce((sum, cs) => sum + cs.quantity, 0);
            } else {
              prod.stockQty = Math.max(0, prod.stockQty - deduction);
            }
          } else {
            if (item.color && prod.colorStocks.length > 0) {
              prod.colorStocks = prod.colorStocks.map(cs =>
                cs.color === item.color ? { ...cs, quantity: Math.max(0, cs.quantity - item.quantity) } : cs
              );
              prod.stockQty = prod.colorStocks.reduce((sum, cs) => sum + cs.quantity, 0);
            } else {
              prod.stockQty = Math.max(0, prod.stockQty - item.quantity);
            }
          }
          updatedProducts[pIdx] = prod;
        }

        // Credit entry
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
          cart: [],
          cartCustomerId: null,
          cartCustomerName: '',
          cartNotes: '',
          cartDiscount: 0,
          cartDiscountType: 'amount',
        });

        return sale;
      },

      deleteSale: (id) => {
        const s = get();
        const sale = s.sales.find(sl => sl.id === id);
        if (!sale || sale.deleted) return;

        const updatedProducts = [...s.products];
        for (const item of sale.items) {
          const pIdx = updatedProducts.findIndex(p => p.id === item.productId);
          if (pIdx === -1) continue;
          const prod = { ...updatedProducts[pIdx] };

          if (prod.stockMode === 'meter' || prod.stockMode === 'color_meter') {
            const restoration = item.quantity * prod.suitCutMeters;
            if (item.color && prod.colorStocks.length > 0) {
              prod.colorStocks = prod.colorStocks.map(cs =>
                cs.color === item.color ? { ...cs, quantity: cs.quantity + restoration } : cs
              );
              prod.stockQty = prod.colorStocks.reduce((sum, cs) => sum + cs.quantity, 0);
            } else {
              prod.stockQty += restoration;
            }
          } else {
            if (item.color && prod.colorStocks.length > 0) {
              prod.colorStocks = prod.colorStocks.map(cs =>
                cs.color === item.color ? { ...cs, quantity: cs.quantity + item.quantity } : cs
              );
              prod.stockQty = prod.colorStocks.reduce((sum, cs) => sum + cs.quantity, 0);
            } else {
              prod.stockQty += item.quantity;
            }
          }
          updatedProducts[pIdx] = prod;
        }

        const updatedCredits = s.credits.filter(c => c.saleId !== id);

        set({
          sales: s.sales.map(sl => sl.id === id ? { ...sl, deleted: true, deletedAt: now() } : sl),
          products: updatedProducts,
          credits: updatedCredits,
        });
      },

      // Customers
      addCustomer: (c) => {
        const customer: Customer = { ...c, id: generateId(), createdAt: now() };
        set((s) => ({ customers: [...s.customers, customer] }));
        return customer;
      },
      updateCustomer: (id, c) => set((s) => ({
        customers: s.customers.map(cu => cu.id === id ? { ...cu, ...c } : cu),
      })),

      // Credits
      addCreditPayment: (creditId, payment) => set((s) => ({
        credits: s.credits.map(c => {
          if (c.id !== creditId) return c;
          const p: CreditPayment = { ...payment, id: generateId(), date: now() };
          const newPaid = c.paidAmount + p.amount;
          return {
            ...c,
            payments: [...c.payments, p],
            paidAmount: newPaid,
            remainingAmount: c.totalAmount - newPaid,
            fullyPaid: newPaid >= c.totalAmount,
          };
        }),
      })),

      // Manual Khata
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
        return creditDue + manualBalance;
      },

      // Goods Receiving
      receiveGoods: (entry) => {
        const s = get();
        const prod = s.products.find(p => p.id === entry.productId);
        if (!prod) return;

        const updatedProd = { ...prod };
        if (entry.colorAdded && updatedProd.colorStocks.length > 0) {
          const existing = updatedProd.colorStocks.find(cs => cs.color === entry.colorAdded);
          if (existing) {
            updatedProd.colorStocks = updatedProd.colorStocks.map(cs =>
              cs.color === entry.colorAdded ? { ...cs, quantity: cs.quantity + entry.quantityAdded } : cs
            );
          } else {
            updatedProd.colorStocks = [...updatedProd.colorStocks, { color: entry.colorAdded!, quantity: entry.quantityAdded }];
          }
          updatedProd.stockQty = updatedProd.colorStocks.reduce((sum, cs) => sum + cs.quantity, 0);
        } else {
          updatedProd.stockQty += entry.quantityAdded;
        }

        set((s) => ({
          products: s.products.map(p => p.id === entry.productId ? updatedProd : p),
          goodsReceivings: [...s.goodsReceivings, { ...entry, id: generateId(), createdAt: now() }],
        }));
      },

      // Held Bills
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
          cart: [],
          cartCustomerId: null,
          cartCustomerName: '',
          cartNotes: '',
          cartDiscount: 0,
          cartDiscountType: 'amount',
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

      // Day Close
      closeDayAndResetSales: () => set((s) => ({
        sales: [],
        credits: s.credits.map(c => c),
        lastDayCloseDate: now(),
      })),

      // Settings
      updateSettings: (s) => set((state) => ({
        settings: { ...state.settings, ...s },
      })),

      // Expenses
      addExpense: (e) => set((s) => ({
        expenses: [...s.expenses, { ...e, id: generateId(), createdAt: now() }],
      })),
      deleteExpense: (id) => set((s) => ({
        expenses: s.expenses.filter(e => e.id !== id),
      })),

      // Savings Targets
      addSavingsTarget: (t) => set((s) => ({
        savingsTargets: [...s.savingsTargets, { ...t, id: generateId(), createdAt: now() }],
      })),
      deleteSavingsTarget: (id) => set((s) => ({
        savingsTargets: s.savingsTargets.filter(t => t.id !== id),
      })),

      // Users
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

      // Accounts
      addAccount: (a) => set((s) => ({
        accounts: [...s.accounts, { ...a, id: generateId(), createdAt: now() }],
      })),
      deleteAccount: (id) => set((s) => ({
        accounts: s.accounts.filter(a => a.id !== id),
        accountTransactions: s.accountTransactions.filter(t => t.accountId !== id),
      })),
      addAccountTransaction: (t) => set((s) => {
        const acc = s.accounts.find(a => a.id === t.accountId);
        const balanceChange = t.type === 'credit' ? t.amount : -t.amount;
        return {
          accountTransactions: [...s.accountTransactions, { ...t, id: generateId(), createdAt: now() }],
          accounts: s.accounts.map(a => a.id === t.accountId ? { ...a, balance: a.balance + balanceChange } : a),
        };
      }),

      // Leads
      addLead: (l) => set((s) => ({
        leads: [...s.leads, { ...l, id: generateId(), createdAt: now() }],
      })),
      updateLead: (id, l) => set((s) => ({
        leads: s.leads.map(lead => lead.id === id ? { ...lead, ...l } : lead),
      })),
      deleteLead: (id) => set((s) => ({
        leads: s.leads.filter(l => l.id !== id),
      })),

      // Backup
      createBackup: () => {
        const s = get();
        const data = JSON.stringify({
          products: s.products,
          customers: s.customers,
          sales: s.sales,
          credits: s.credits,
          khataEntries: s.khataEntries,
          goodsReceivings: s.goodsReceivings,
          expenses: s.expenses,
          savingsTargets: s.savingsTargets,
          users: s.users,
          settings: s.settings,
          invoiceCounter: s.invoiceCounter,
        });
        const entry: BackupEntry = {
          id: generateId(),
          date: now(),
          size: `${(data.length / 1024).toFixed(1)} KB`,
          type: 'manual',
        };
        set((s) => ({ backups: [...s.backups, entry] }));
        return data;
      },
      restoreBackup: (data) => {
        try {
          const parsed = JSON.parse(data);
          set({
            products: parsed.products || [],
            customers: parsed.customers || [],
            sales: parsed.sales || [],
            credits: parsed.credits || [],
            goodsReceivings: parsed.goodsReceivings || [],
            expenses: parsed.expenses || [],
            savingsTargets: parsed.savingsTargets || [],
            users: parsed.users || [],
            settings: parsed.settings || get().settings,
            invoiceCounter: parsed.invoiceCounter || get().invoiceCounter,
          });
          return true;
        } catch {
          return false;
        }
      },

      // Helpers
      getCartTotal: () => {
        const s = get();
        const subtotal = s.cart.reduce((sum, item) => sum + item.lineTotal, 0);
        let discount = 0;
        if (s.cartDiscountType === 'percent') {
          discount = subtotal * (s.cartDiscount / 100);
        } else {
          discount = s.cartDiscount;
        }
        if (s.settings.promoEnabled && s.settings.promoDiscount > 0) {
          discount += subtotal * (s.settings.promoDiscount / 100);
        }
        return { subtotal, discount, total: Math.max(0, subtotal - discount) };
      },
      getProduct: (id) => get().products.find(p => p.id === id),
      getCustomer: (id) => get().customers.find(c => c.id === id),
    }),
    {
      name: 'clothing-pos-store',
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
