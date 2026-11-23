import type { InvoiceDesign, LabelSettings, NotificationPrefs, StoreSettings } from '@/types';

export const APP_VERSION = '3.0.0';
/** Bump when the persisted/backup data shape changes; add a step to migrations.ts. */
export const SCHEMA_VERSION = 2;

export const DEFAULT_CATEGORIES = ['Ladies', 'Gents', 'Kids', 'Unisex'];
export const DEFAULT_PRODUCT_TYPES = [
  'Fabric Suit', 'Unstitched Suit', '2 Piece Suit', '3 Piece Suit', 'Fabric Roll', 'Ready Suit', 'Ready-made', 'Other',
];
export const DEFAULT_FABRICS = [
  'Lawn', 'Cotton', 'Linen', 'Khaddar', 'Silk', 'Chiffon', 'Wash & Wear', 'Embroidered', 'Printed',
  'Reshmi', 'Karandi', 'Boski', 'Other',
];
export const DEFAULT_SEASONS = ['Summer', 'Winter', 'All Season'];
export const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Card', 'JazzCash', 'EasyPaisa', 'Other'] as const;

export const DEFAULT_INVOICE_DESIGN: InvoiceDesign = {
  accentColor: '#164e3a',
  secondaryColor: '#c6a458',
  paperSize: '80mm',
  title: 'SALES INVOICE',
  terms: 'Goods once sold will be exchanged within 7 days with receipt. No cash refund on unstitched fabric once cut.',
  taxLabel: 'GST',
  taxRate: 0,
  fontScale: 1,
  fields: {
    logo: true, address: true, phone: true, customer: true, sku: false, unit: true, discount: true,
    tax: false, paid: true, balance: true, terms: true, notes: true, qr: true, footer: true, cashier: true,
  },
  columns: { item: 40, qty: 12, unit: 10, rate: 14, discount: 10, total: 14 },
};

export const DEFAULT_LABEL_SETTINGS: LabelSettings = {
  size: '50x25', codeType: 'CODE128', showName: true, showPrice: true, showSku: true, showStore: true, showCodeText: true,
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  lowStock: true, outOfStock: true, sales: false, backupReminder: true, license: true, syncErrors: true, updates: true,
};

export const getInvoiceDesign = (s: StoreSettings): InvoiceDesign => ({
  ...DEFAULT_INVOICE_DESIGN,
  ...(s.invoiceDesign || {}),
  fields: { ...DEFAULT_INVOICE_DESIGN.fields, ...(s.invoiceDesign?.fields || {}) },
  columns: { ...DEFAULT_INVOICE_DESIGN.columns, ...(s.invoiceDesign?.columns || {}) },
  paperSize: s.invoiceDesign?.paperSize || s.printerType || '80mm',
});
export const getLabelSettings = (s: StoreSettings): LabelSettings => ({ ...DEFAULT_LABEL_SETTINGS, ...(s.labelDefaults || {}) });
export const getNotificationPrefs = (s: StoreSettings): NotificationPrefs => ({ ...DEFAULT_NOTIFICATION_PREFS, ...(s.notificationPrefs || {}) });

export const categoriesOf = (s: StoreSettings) => [...new Set([...DEFAULT_CATEGORIES, ...(s.customCategories || [])])];
export const fabricsOf = (s: StoreSettings) => [...new Set([...DEFAULT_FABRICS, ...(s.customFabrics || [])])];
export const productTypesOf = (s: StoreSettings) => [...new Set([...DEFAULT_PRODUCT_TYPES, ...(s.customProductTypes || [])])];
