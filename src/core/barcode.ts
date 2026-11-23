/**
 * Product code / barcode utilities.
 *
 * - EAN-13 codes are generated in the GS1 "in-store" prefix range (20–29), so they never
 *   collide with manufacturer barcodes printed on branded goods.
 * - CODE128 labels encode the SKU (any ASCII).
 * - QR labels encode the plain product code; legacy v1 stickers encoded JSON
 *   ({"sku": ...}) and are still recognised by `parseScannedCode`.
 */
import type { BarcodeFormat, Product } from '@/types';

export function eanCheckDigit(digitsWithoutCheck: string): number {
  // Weights alternate 3,1 starting from the rightmost digit (works for EAN-8 and EAN-13).
  let sum = 0;
  for (let i = 0; i < digitsWithoutCheck.length; i++) {
    const d = Number(digitsWithoutCheck[digitsWithoutCheck.length - 1 - i]);
    sum += d * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

export function isValidEan(code: string): boolean {
  if (!/^\d+$/.test(code) || (code.length !== 13 && code.length !== 8)) return false;
  return eanCheckDigit(code.slice(0, -1)) === Number(code[code.length - 1]);
}

export function makeEan13(prefix2: string, body10: string): string {
  const raw = (prefix2 + body10).slice(0, 12).padEnd(12, '0');
  return raw + eanCheckDigit(raw);
}

export function makeEan8(body7: string): string {
  const raw = body7.padStart(7, '0').slice(-7);
  return raw + eanCheckDigit(raw);
}

/** Collect every code already used by any product (barcode + SKU), normalised. */
export function usedCodes(products: Product[], exceptId?: string): Set<string> {
  const set = new Set<string>();
  for (const p of products) {
    if (p.id === exceptId) continue;
    if (p.barcode) set.add(p.barcode.trim().toUpperCase());
    if (p.sku) set.add(p.sku.trim().toUpperCase());
  }
  return set;
}

/** Next unique in-store EAN-13 ("20" + 10 digit sequence + check). */
export function generateUniqueEan13(products: Product[]): string {
  const used = usedCodes(products);
  let max = 0;
  for (const code of used) {
    if (/^2\d{12}$/.test(code)) max = Math.max(max, Number(code.slice(2, 12)));
  }
  for (let seq = max + 1; ; seq++) {
    const code = makeEan13('20', String(seq).padStart(10, '0'));
    if (!used.has(code)) return code;
  }
}

export function generateUniqueEan8(products: Product[]): string {
  const used = usedCodes(products);
  let max = 2000000;
  for (const code of used) if (/^2\d{7}$/.test(code)) max = Math.max(max, Number(code.slice(0, 7)));
  for (let seq = max + 1; ; seq++) {
    const code = makeEan8(String(seq));
    if (!used.has(code)) return code;
  }
}

const slug = (s: string, n: number) =>
  (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, n) || 'X';

/** Human-friendly unique SKU like GRC-CHN-003. */
export function generateUniqueSku(products: Product[], brand: string, article: string, exceptId?: string): string {
  const used = usedCodes(products, exceptId);
  const stem = `${slug(brand, 3)}-${slug(article, 3)}`;
  for (let i = 1; ; i++) {
    const sku = `${stem}-${String(i).padStart(3, '0')}`;
    if (!used.has(sku)) return sku;
  }
}

export function generateCode(products: Product[], format: BarcodeFormat, brand = '', article = ''): string {
  switch (format) {
    case 'EAN13': return generateUniqueEan13(products);
    case 'EAN8': return generateUniqueEan8(products);
    default: return generateUniqueSku(products, brand, article);
  }
}

export interface CodeValidation { ok: boolean; error?: string }

export function validateCode(code: string, format: BarcodeFormat, products: Product[], exceptId?: string): CodeValidation {
  const c = code.trim();
  if (!c) return { ok: false, error: 'Code is empty' };
  if (format === 'EAN13' && (c.length !== 13 || !isValidEan(c))) return { ok: false, error: 'Invalid EAN-13 (13 digits with valid check digit)' };
  if (format === 'EAN8' && (c.length !== 8 || !isValidEan(c))) return { ok: false, error: 'Invalid EAN-8 (8 digits with valid check digit)' };
  if (format === 'CODE128' && !/^[\x20-\x7E]+$/.test(c)) return { ok: false, error: 'CODE128 supports printable ASCII only' };
  if (usedCodes(products, exceptId).has(c.toUpperCase())) return { ok: false, error: 'This code is already used by another product' };
  return { ok: true };
}

/** The code printed on a product's label for a given format. */
export function labelCode(p: Product, format: BarcodeFormat): string {
  if (format === 'EAN13' || format === 'EAN8') return p.barcode && isValidEan(p.barcode) ? p.barcode : p.sku;
  return p.barcode || p.sku;
}

/** Normalise raw scanner / camera output into a lookup code. */
export function parseScannedCode(raw: string): string {
  const text = (raw || '').trim();
  if (text.startsWith('{')) {
    try {
      const obj = JSON.parse(text);
      return String(obj.code || obj.barcode || obj.sku || '').trim();
    } catch { /* not JSON */ }
  }
  // URLs like https://shop/p/CODE or ...?code=CODE
  const m = text.match(/[?&]code=([^&]+)/) || text.match(/\/p\/([^/?#]+)$/);
  if (m) return decodeURIComponent(m[1]);
  return text;
}

/** Find a product by barcode, SKU, or id (case-insensitive). */
export function findProductByCode(products: Product[], raw: string): Product | undefined {
  const code = parseScannedCode(raw).toUpperCase();
  if (!code) return undefined;
  return (
    products.find(p => (p.barcode || '').toUpperCase() === code) ||
    products.find(p => (p.sku || '').toUpperCase() === code) ||
    products.find(p => p.id.toUpperCase() === code) ||
    // EAN scanners sometimes drop/keep a leading zero (UPC-A ↔ EAN-13)
    products.find(p => p.barcode && p.barcode.replace(/^0+/, '') === code.replace(/^0+/, ''))
  );
}
