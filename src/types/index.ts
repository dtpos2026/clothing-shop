export type Category = 'Ladies' | 'Gents';
export type ProductType = 'Ready Suit' | 'Fabric Suit' | 'Other';
export type Season = 'Summer' | 'Winter';
export type FabricCategory = 'Cotton' | 'Wash & Wear' | 'Lawn' | 'Reshmi' | 'Karandi' | 'Boski' | 'Other';
export type StockMode = 'piece' | 'meter' | 'color_piece' | 'color_meter';
export type PaymentMethod = 'Cash' | 'Bank Transfer' | 'Card' | 'Other';
export type SaleType = 'cash' | 'credit' | 'partial';
export type UserRole = 'admin' | 'cashier' | 'father' | 'son';

export interface ColorStock {
  color: string;
  quantity: number;
}

export interface Product {
  id: string;
  brand: string;
  article: string;
  sku: string;
  category: Category;
  productType: ProductType;
  season: Season;
  fabricCategory: FabricCategory;
  color?: string;
  description?: string;
  salePrice: number;
  costPrice: number;
  barcode?: string;
  active: boolean;
  stockMode: StockMode;
  stockQty: number;
  colorStocks: ColorStock[];
  suitCutMeters: number;
  lowStockThreshold: number;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  productId: string;
  product: Product;
  quantity: number;
  color?: string;
  unitPrice: number;
  discount: number;
  lineTotal: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string;
  notes?: string;
  createdAt: string;
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  items: CartItem[];
  subtotal: number;
  discountAmount: number;
  discountPercent: number;
  total: number;
  paymentMethod: PaymentMethod;
  saleType: SaleType;
  amountPaid: number;
  creditAmount: number;
  notes?: string;
  createdAt: string;
  deleted: boolean;
  deletedAt?: string;
}

export interface CreditEntry {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  saleId: string;
  invoiceNumber: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  payments: CreditPayment[];
  fullyPaid: boolean;
  createdAt: string;
}

export interface CreditPayment {
  id: string;
  amount: number;
  method: PaymentMethod;
  note?: string;
  date: string;
}

export interface KhataEntry {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  type: 'give' | 'take';
  amount: number;
  description: string;
  date: string;
  createdAt: string;
}

export interface GoodsReceiving {
  id: string;
  productId: string;
  productName: string;
  brand: string;
  quantityAdded: number;
  stockMode: StockMode;
  colorAdded?: string;
  costPrice?: number;
  supplier?: string;
  notes?: string;
  createdAt: string;
}

export type ReceiptTemplate = 'classic' | 'bordered' | 'modern' | 'compact';

export type ExpenseCategory = 'home' | 'shop';

export interface Expense {
  id: string;
  category: ExpenseCategory;
  label: string;
  amount: number;
  description?: string;
  date: string;
  createdAt: string;
}

export interface SavingsTarget {
  id: string;
  title: string;
  targetAmount: number;
  savedAmount: number;
  createdAt: string;
}

export interface AppUser {
  id: string;
  name: string;
  role: UserRole;
  pin: string;
  active: boolean;
  createdAt: string;
}

export interface Account {
  id: string;
  name: string;
  type: 'bank' | 'cash' | 'wallet' | 'other';
  balance: number;
  accountNumber?: string;
  bankName?: string;
  notes?: string;
  active: boolean;
  createdAt: string;
}

export interface AccountTransaction {
  id: string;
  accountId: string;
  accountName: string;
  type: 'credit' | 'debit';
  amount: number;
  category: string;
  description: string;
  relatedId?: string;
  date: string;
  createdAt: string;
}

export type LeadStatus = 'new' | 'contacted' | 'interested' | 'converted' | 'lost';
export type LeadSource = 'walk-in' | 'whatsapp' | 'facebook' | 'instagram' | 'referral' | 'other';

export interface Lead {
  id: string;
  name: string;
  phone: string;
  source: LeadSource;
  status: LeadStatus;
  interest: string;
  notes?: string;
  followUpDate?: string;
  createdAt: string;
}

export interface StoreSettings {
  storeName: string;
  logoUrl: string;
  logoWidth: number;
  logoHeight: number;
  phone: string;
  address: string;
  footerMessage: string;
  footerNote: string;
  customQrUrl: string;
  enableInvoiceQr: boolean;
  enableCustomQr: boolean;
  printerName: string;
  printerType: '58mm' | '80mm';
  autoPrint: boolean;
  printPreview: boolean;
  promoEnabled: boolean;
  promoDiscount: number;
  currency: string;
  displayFont: string;
  receiptFont: string;
  urduFont: string;
  receiptTemplate: ReceiptTemplate;
  developerName: string;
  developerCompany: string;
  developerLogoUrl: string;
  monthlyHomeExpenseBudget: number;
  monthlyShopExpenseBudget: number;
  bwReports: boolean;
}

export interface HeldBill {
  id: string;
  items: CartItem[];
  customerId?: string;
  customerName?: string;
  notes?: string;
  heldAt: string;
}

export interface BackupEntry {
  id: string;
  date: string;
  size: string;
  type: 'manual' | 'auto';
}
