/**
 * Category / product type / fabric are open string unions: the listed values are
 * the defaults shipped with the app, and shop owners can add their own from
 * Settings → Catalogue (stored in settings.customCategories etc.).
 */
export type Category = 'Ladies' | 'Gents' | 'Kids' | 'Unisex' | (string & {});
export type ProductType =
  | 'Ready Suit' | 'Fabric Suit' | 'Unstitched Suit' | '2 Piece Suit' | '3 Piece Suit'
  | 'Fabric Roll' | 'Ready-made' | 'Other' | (string & {});
export type Season = 'Summer' | 'Winter' | 'All Season' | (string & {});
export type FabricCategory =
  | 'Lawn' | 'Cotton' | 'Linen' | 'Khaddar' | 'Silk' | 'Chiffon' | 'Wash & Wear'
  | 'Embroidered' | 'Printed' | 'Reshmi' | 'Karandi' | 'Boski' | 'Other' | (string & {});
export type StockMode = 'piece' | 'meter' | 'color_piece' | 'color_meter';
/** How a cart line is sold: per meter, per suit cut (meters × suitCut), or per piece. */
export type SellUnit = 'meter' | 'suit' | 'piece';
export type PriceTier = 'retail' | 'wholesale';
export type BarcodeFormat = 'CODE128' | 'EAN13' | 'EAN8' | 'QR';
export type PaymentMethod = 'Cash' | 'Bank Transfer' | 'Card' | 'JazzCash' | 'EasyPaisa' | 'Other' | 'Exchange';
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
  // ---- v2 (all optional for backward compatibility) ----
  /** Wholesale price per sell unit (suit / piece). */
  wholesalePrice?: number;
  /** Retail price per meter for meter-based products. Defaults to salePrice / suitCutMeters. */
  pricePerMeter?: number;
  wholesalePricePerMeter?: number;
  barcodeFormat?: BarcodeFormat;
  design?: string;
  /** Compressed JPEG data URL (kept small so it syncs and backs up cleanly). */
  imageUrl?: string;
  supplierId?: string;
  /** Individual thaans / rolls. When present, meter stock is derived from these. */
  rolls?: FabricRoll[];
}

export type RollStatus = 'active' | 'finished' | 'damaged';

/** A single Thaan / fabric roll with its own quantity, cost and history. */
export interface FabricRoll {
  id: string;
  rollNo: string;
  color?: string;
  initialMeters: number;
  remainingMeters: number;
  costPerMeter: number;
  supplierId?: string;
  supplierName?: string;
  purchaseId?: string;
  status: RollStatus;
  notes?: string;
  receivedAt: string;
}

export interface CartItem {
  productId: string;
  product: Product;
  quantity: number;
  color?: string;
  unitPrice: number;
  discount: number;
  lineTotal: number;
  /** v2: unit of `quantity`. Missing on legacy data: meter-mode → 'suit', otherwise 'piece'. */
  sellUnit?: SellUnit;
  priceTier?: PriceTier;
  /** Specific roll to cut from (otherwise FIFO across rolls). */
  rollId?: string;
  /** Cost of goods for this line, captured at sale time for accurate profit. */
  costTotal?: number;
}

export interface SalePayment {
  method: PaymentMethod;
  amount: number;
  reference?: string;
}

export type SaleKind = 'sale' | 'return';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string;
  notes?: string;
  createdAt: string;
  /** v2: amount the customer already owed when added (positive = receivable). */
  openingBalance?: number;
  creditLimit?: number;
  updatedAt?: string;
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
  // ---- v2 ----
  kind?: SaleKind;
  /** For returns: the original sale id / invoice. */
  returnOfId?: string;
  returnOfInvoice?: string;
  /** Split payments. When absent, the whole amountPaid used `paymentMethod`. */
  payments?: SalePayment[];
  taxAmount?: number;
  cashierName?: string;
  deviceId?: string;
  priceTier?: PriceTier;
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

/** Legacy receipt templates (v1) remain selectable. */
export type LegacyReceiptTemplate = 'classic' | 'bordered' | 'modern' | 'compact';
export type InvoiceTemplateId =
  | 'classic-retail' | 'modern-minimal' | 'premium-business'
  | 'detailed-table' | 'compact-thermal' | 'professional-a4';
export type ReceiptTemplate = LegacyReceiptTemplate | InvoiceTemplateId;
export type PaperSize = '58mm' | '80mm' | 'A5' | 'A4';

export interface InvoiceFieldVisibility {
  logo: boolean; address: boolean; phone: boolean; customer: boolean;
  sku: boolean; unit: boolean; discount: boolean; tax: boolean;
  paid: boolean; balance: boolean; terms: boolean; notes: boolean;
  qr: boolean; footer: boolean; cashier: boolean;
}

export interface InvoiceColumnWidths {
  item: number; qty: number; unit: number; rate: number; discount: number; total: number;
}

export interface InvoiceDesign {
  accentColor: string;
  secondaryColor: string;
  paperSize: PaperSize;
  fields: InvoiceFieldVisibility;
  columns: InvoiceColumnWidths;
  title: string;
  terms: string;
  taxLabel: string;
  /** Percentage applied on display only when > 0 (prices are tax-inclusive by default). */
  taxRate: number;
  fontScale: number;
}

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
  // ---- v2 ----
  invoiceDesign?: InvoiceDesign;
  language?: 'en' | 'ur';
  labelDefaults?: LabelSettings;
  defaultBarcodeFormat?: BarcodeFormat;
  customCategories?: string[];
  customFabrics?: string[];
  customProductTypes?: string[];
  notificationPrefs?: NotificationPrefs;
  backupReminderDays?: number;
  lastBackupAt?: string;
  developerName: string;
  developerCompany: string;
  developerLogoUrl: string;
  monthlyHomeExpenseBudget: number;
  monthlyShopExpenseBudget: number;
  bwReports: boolean;
}

export interface NotificationPrefs {
  lowStock: boolean; outOfStock: boolean; sales: boolean; backupReminder: boolean;
  license: boolean; syncErrors: boolean; updates: boolean;
}

export type LabelSize = '38x25' | '50x25' | '50x30' | '58mm' | '80mm' | 'A4-3x8' | 'A4-4x10';
export interface LabelSettings {
  size: LabelSize;
  codeType: BarcodeFormat;
  showName: boolean; showPrice: boolean; showSku: boolean; showStore: boolean; showCodeText: boolean;
}

export interface Supplier {
  id: string;
  name: string;
  company?: string;
  phone: string;
  address?: string;
  openingBalance: number;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PurchaseItem {
  productId: string;
  productName: string;
  quantity: number;
  unit: 'meter' | 'piece';
  color?: string;
  rollNo?: string;
  costPrice: number;
  lineTotal: number;
}

export interface Purchase {
  id: string;
  purchaseNumber: string;
  supplierId?: string;
  supplierName: string;
  items: PurchaseItem[];
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  due: number;
  paymentMethod: PaymentMethod;
  notes?: string;
  createdAt: string;
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  supplierName: string;
  amount: number;
  method: PaymentMethod;
  note?: string;
  date: string;
  createdAt: string;
}

export type AdjustmentType = 'damaged' | 'lost' | 'correction_add' | 'correction_remove' | 'return_to_supplier';
export interface StockAdjustment {
  id: string;
  productId: string;
  productName: string;
  color?: string;
  rollId?: string;
  type: AdjustmentType;
  /** Always positive; direction comes from `type`. Unit = product base unit (meter or piece). */
  quantity: number;
  costValue: number;
  reason: string;
  userName: string;
  createdAt: string;
}

export interface CashEntry {
  id: string;
  type: 'in' | 'out';
  amount: number;
  category: string;
  description: string;
  method: PaymentMethod;
  date: string;
  createdAt: string;
}

export interface DayClosing {
  id: string;
  date: string; // yyyy-MM-dd
  openingCash: number;
  cashIn: number;
  cashOut: number;
  expectedCash: number;
  countedCash: number;
  difference: number;
  totalSales: number;
  totalReturns: number;
  billCount: number;
  creditGiven: number;
  discountGiven: number;
  expenses: number;
  closedBy: string;
  notes?: string;
  createdAt: string;
}

export interface CustomerOpening {
  customerId: string;
  amount: number;
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
  type: 'manual' | 'auto' | 'safety' | 'cloud';
  fileName?: string;
}
