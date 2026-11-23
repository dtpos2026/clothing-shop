import { describe, it, expect } from 'vitest';
import { eanCheckDigit, isValidEan, generateUniqueEan13, generateUniqueSku, validateCode, findProductByCode, parseScannedCode, generateUniqueEan8 } from '@/core/barcode';
import { toCSV, parseCSV } from '@/core/csv';
import { makeProduct } from './fixtures';

describe('barcodes', () => {
  it('computes EAN-13 check digit (known value)', () => {
    expect(eanCheckDigit('400638133393')).toBe(1); // 4006381333931
    expect(isValidEan('4006381333931')).toBe(true);
    expect(isValidEan('4006381333932')).toBe(false);
    expect(isValidEan('96385074')).toBe(true); // EAN-8
  });
  it('generates unique in-store EAN-13 codes', () => {
    const a = makeProduct({ barcode: generateUniqueEan13([]) });
    const b = generateUniqueEan13([a]);
    expect(a.barcode).toMatch(/^20\d{11}$/);
    expect(isValidEan(a.barcode!)).toBe(true);
    expect(b).not.toBe(a.barcode);
    expect(isValidEan(generateUniqueEan8([a]))).toBe(true);
  });
  it('generates unique SKUs and rejects duplicates', () => {
    const a = makeProduct({ sku: 'GRA-CHI-001', brand: 'Grace', article: 'Chinto' });
    expect(generateUniqueSku([a], 'Grace', 'Chinto')).toBe('GRA-CHI-002');
    expect(validateCode('gra-chi-001', 'CODE128', [a]).ok).toBe(false);
    expect(validateCode('gra-chi-001', 'CODE128', [a], a.id).ok).toBe(true);
    expect(validateCode('1234567890123', 'EAN13', []).ok).toBe(false);
  });
  it('finds products from scanner input incl. legacy JSON QR stickers', () => {
    const a = makeProduct({ sku: 'GA-NOR-001', barcode: '2000000000015' });
    expect(findProductByCode([a], '2000000000015')?.id).toBe(a.id);
    expect(findProductByCode([a], 'ga-nor-001')?.id).toBe(a.id);
    expect(findProductByCode([a], JSON.stringify({ sku: 'GA-NOR-001', brand: 'x' }))?.id).toBe(a.id);
    expect(findProductByCode([a], 'nope')).toBeUndefined();
    expect(parseScannedCode('https://shop.example/p/ABC?x')).toBe('https://shop.example/p/ABC?x');
    expect(parseScannedCode('https://shop.example/p/ABC')).toBe('ABC');
  });
});

describe('CSV', () => {
  it('writes BOM, quotes and keeps Urdu text', () => {
    const csv = toCSV([{ n: 'لان سوٹ, نیا', q: 3 }, { n: '=cmd()', q: 1 }], [{ header: 'Name', value: r => r.n }, { header: 'Qty', value: r => r.q }]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"لان سوٹ, نیا",3');
    expect(csv).toContain("'=cmd()");
    expect(parseCSV(csv)).toEqual([['Name', 'Qty'], ['لان سوٹ, نیا', '3'], ["'=cmd()", '1']]);
  });
});
