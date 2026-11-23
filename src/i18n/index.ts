/**
 * Lightweight English / Urdu translations with RTL support.
 * Keys that are missing in Urdu fall back to English, so partially translated
 * screens never show blank labels.
 */
import { useEffect } from 'react';
import { useStore } from '@/store/useStore';

const en = {
  'nav.dashboard': 'Dashboard', 'nav.pos': 'POS / Billing', 'nav.inventory': 'Inventory', 'nav.receiving': 'Goods Receiving',
  'nav.purchases': 'Purchases & Suppliers', 'nav.stock': 'Stock Adjustments', 'nav.labels': 'Barcode & QR Labels',
  'nav.customers': 'Customers', 'nav.udhar': 'Udhar / Khata', 'nav.accounts': 'Accounts', 'nav.accounting': 'Accounting',
  'nav.cashbook': 'Cash Book & P/L', 'nav.expenses': 'Expenses', 'nav.leads': 'Leads', 'nav.reports': 'Reports',
  'nav.export': 'Export & Share', 'nav.dayclose': 'Day Close', 'nav.invoice': 'Invoice Designer', 'nav.settings': 'Settings',
  'nav.backup': 'Backup / Restore', 'nav.cloud': 'Cloud & License', 'nav.more': 'More', 'nav.scan': 'Scan', 'nav.home': 'Home',
  'nav.stockShort': 'Stock',
  'common.save': 'Save', 'common.cancel': 'Cancel', 'common.add': 'Add', 'common.edit': 'Edit', 'common.delete': 'Delete',
  'common.search': 'Search…', 'common.print': 'Print', 'common.share': 'Share', 'common.whatsapp': 'WhatsApp',
  'common.export': 'Export', 'common.close': 'Close', 'common.total': 'Total', 'common.date': 'Date', 'common.amount': 'Amount',
  'common.customer': 'Customer', 'common.supplier': 'Supplier', 'common.walkin': 'Walk-in Customer', 'common.qty': 'Qty',
  'common.price': 'Price', 'common.scan': 'Scan', 'common.yes': 'Yes', 'common.no': 'No', 'common.notes': 'Notes',
  'pos.cart': 'Cart', 'pos.empty': 'Cart is empty', 'pos.subtotal': 'Subtotal', 'pos.discount': 'Discount',
  'pos.complete': 'Complete Sale', 'pos.hold': 'Hold', 'pos.held': 'Held Bills', 'pos.selectCustomer': 'Select Customer (Optional)',
  'pos.searchPlaceholder': 'Search or scan article, brand, SKU, barcode…', 'pos.payment': 'Payment', 'pos.split': 'Split payment',
  'pos.return': 'Return / Exchange', 'pos.retail': 'Retail', 'pos.wholesale': 'Wholesale', 'pos.meters': 'Meters',
  'pos.suits': 'Suits', 'pos.pieces': 'Pieces', 'pos.payable': 'Payable', 'pos.change': 'Change', 'pos.udhar': 'Udhar (Credit)',
  'pos.notFound': 'No product found for code', 'pos.added': 'Added to cart',
  'lang.name': 'English',
};

type Key = keyof typeof en;

const ur: Partial<Record<Key, string>> = {
  'nav.dashboard': 'ڈیش بورڈ', 'nav.pos': 'بلنگ / پی او ایس', 'nav.inventory': 'اسٹاک', 'nav.receiving': 'مال وصولی',
  'nav.purchases': 'خریداری اور سپلائرز', 'nav.stock': 'اسٹاک ایڈجسٹمنٹ', 'nav.labels': 'بارکوڈ اور کیو آر لیبل',
  'nav.customers': 'گاہک', 'nav.udhar': 'ادھار / کھاتہ', 'nav.accounts': 'اکاؤنٹس', 'nav.accounting': 'حساب کتاب',
  'nav.cashbook': 'کیش بک اور نفع نقصان', 'nav.expenses': 'اخراجات', 'nav.leads': 'لیڈز', 'nav.reports': 'رپورٹس',
  'nav.export': 'ایکسپورٹ اور شیئر', 'nav.dayclose': 'دن کا اختتام', 'nav.invoice': 'انوائس ڈیزائنر', 'nav.settings': 'ترتیبات',
  'nav.backup': 'بیک اپ / ریسٹور', 'nav.cloud': 'کلاؤڈ اور لائسنس', 'nav.more': 'مزید', 'nav.scan': 'اسکین', 'nav.home': 'ہوم',
  'nav.stockShort': 'اسٹاک',
  'common.save': 'محفوظ کریں', 'common.cancel': 'منسوخ', 'common.add': 'شامل کریں', 'common.edit': 'ترمیم', 'common.delete': 'حذف',
  'common.search': 'تلاش کریں…', 'common.print': 'پرنٹ', 'common.share': 'شیئر', 'common.whatsapp': 'واٹس ایپ',
  'common.export': 'ایکسپورٹ', 'common.close': 'بند کریں', 'common.total': 'کل', 'common.date': 'تاریخ', 'common.amount': 'رقم',
  'common.customer': 'گاہک', 'common.supplier': 'سپلائر', 'common.walkin': 'عام گاہک', 'common.qty': 'مقدار',
  'common.price': 'قیمت', 'common.scan': 'اسکین', 'common.yes': 'ہاں', 'common.no': 'نہیں', 'common.notes': 'نوٹس',
  'pos.cart': 'کارٹ', 'pos.empty': 'کارٹ خالی ہے', 'pos.subtotal': 'ذیلی کل', 'pos.discount': 'رعایت',
  'pos.complete': 'سیل مکمل کریں', 'pos.hold': 'ہولڈ', 'pos.held': 'ہولڈ بل', 'pos.selectCustomer': 'گاہک منتخب کریں (اختیاری)',
  'pos.searchPlaceholder': 'آرٹیکل، برانڈ، کوڈ تلاش یا اسکین کریں…', 'pos.payment': 'ادائیگی', 'pos.split': 'تقسیم ادائیگی',
  'pos.return': 'واپسی / تبادلہ', 'pos.retail': 'پرچون', 'pos.wholesale': 'تھوک', 'pos.meters': 'میٹر',
  'pos.suits': 'سوٹ', 'pos.pieces': 'پیس', 'pos.payable': 'قابل ادائیگی', 'pos.change': 'بقایا', 'pos.udhar': 'ادھار',
  'pos.notFound': 'اس کوڈ کی کوئی پروڈکٹ نہیں ملی', 'pos.added': 'کارٹ میں شامل',
  'lang.name': 'اردو',
};

export type Lang = 'en' | 'ur';
export const dictionaries: Record<Lang, Partial<Record<Key, string>>> = { en, ur };

export function translate(lang: Lang, key: Key): string {
  return dictionaries[lang][key] || en[key] || key;
}

export function useT() {
  const lang = (useStore(s => s.settings.language) || 'en') as Lang;
  return { t: (key: Key) => translate(lang, key), lang, dir: lang === 'ur' ? 'rtl' : 'ltr' as 'rtl' | 'ltr' };
}

/** Applies <html dir/lang> and the Urdu font when Urdu is selected. */
export function useDocumentLanguage() {
  const lang = (useStore(s => s.settings.language) || 'en') as Lang;
  const urduFont = useStore(s => s.settings.urduFont);
  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = lang === 'ur' ? 'rtl' : 'ltr';
    root.classList.toggle('lang-ur', lang === 'ur');
    root.style.setProperty('--urdu-font', `'${urduFont || 'Jameel Noori Nastaleeq'}'`);
  }, [lang, urduFont]);
}
