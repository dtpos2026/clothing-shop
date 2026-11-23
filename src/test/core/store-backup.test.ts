import { describe, it, expect, beforeEach } from 'vitest';
import JSZip from 'jszip';
import { useStore } from '@/store/useStore';
import { buildBackupZip, readBackup, mergeBusinessData, BackupError } from '@/core/backup';
import { migrateState } from '@/core/migrations';
import { profitAndLoss, cashBook, cashTotals, customerLedger, amountInWords } from '@/core/accounting';
import { makeProduct } from './fixtures';

const reset = () => {
  const s = useStore.getState();
  s.replaceBusinessData({ products: [], customers: [], sales: [], credits: [], settings: s.settings, invoiceCounter: 1000 });
};

describe('store: fabric POS flows', () => {
  beforeEach(reset);

  it('sells 4 m from a 50 m thaan via POS and records cost', () => {
    const s = useStore.getState();
    const p = s.addProduct({ ...makeProduct(), stockQty: 0 });
    s.receiveGoods({ productId: p.id, productName: 'x', brand: 'Grace', quantityAdded: 50, stockMode: 'meter', costPrice: 500, rollNo: 'T-001' });
    let prod = useStore.getState().products[0];
    expect(prod.stockQty).toBe(50);
    useStore.getState().addToCart(prod, undefined, { sellUnit: 'meter', quantity: 4 });
    const sale = useStore.getState().completeSale('Cash', 'cash', 0)!;
    prod = useStore.getState().products[0];
    expect(prod.stockQty).toBe(46);
    expect(prod.rolls![0].remainingMeters).toBe(46);
    expect(sale.total).toBe(2800); // 4 m × 700/m
    expect(sale.items[0].costTotal).toBe(2000);
  });

  it('split payment + udhar creates a credit entry for the remainder', () => {
    const s = useStore.getState();
    const p = s.addProduct(makeProduct({ stockMode: 'piece', stockQty: 10, salePrice: 5000, costPrice: 3000, suitCutMeters: 0 }));
    const c = s.addCustomer({ name: 'Ahmed', phone: '0300' });
    s.setCartCustomer(c.id, c.name);
    s.addToCart(p);
    s.addToCart(p);
    const sale = useStore.getState().completeSale('Cash', 'cash', 0, [{ method: 'Cash', amount: 4000 }, { method: 'JazzCash', amount: 3000 }])!;
    expect(sale.total).toBe(10000);
    expect(sale.saleType).toBe('partial');
    expect(sale.creditAmount).toBe(3000);
    expect(useStore.getState().credits[0].remainingAmount).toBe(3000);
    expect(useStore.getState().getCustomerKhataBalance(c.id)).toBe(3000);
    const book = cashBook(useStore.getState());
    expect(cashTotals(book, ['Cash']).cashIn).toBe(4000);
    expect(cashTotals(book).cashIn).toBe(7000);
  });

  it('refuses udhar without a customer', () => {
    const s = useStore.getState();
    const p = s.addProduct(makeProduct({ stockMode: 'piece', stockQty: 10, suitCutMeters: 0 }));
    s.addToCart(p);
    expect(useStore.getState().completeSale('Cash', 'credit', 0)).toBeNull();
  });

  it('return restocks, adjusts udhar first, refunds rest; P&L nets it out', () => {
    const s = useStore.getState();
    const p = s.addProduct(makeProduct({ stockMode: 'piece', stockQty: 10, salePrice: 1000, costPrice: 600, suitCutMeters: 0 }));
    const c = s.addCustomer({ name: 'Fatima', phone: '0321' });
    s.setCartCustomer(c.id, c.name);
    s.addToCart(p, undefined, { quantity: 3 });
    const sale = useStore.getState().completeSale('Cash', 'partial', 1000)!; // 2000 udhar
    expect(useStore.getState().products[0].stockQty).toBe(7);
    const ret = useStore.getState().processReturn(sale.id, [{ index: 0, quantity: 1 }], 'Cash')!;
    expect(ret.total).toBe(-1000);
    expect(useStore.getState().products[0].stockQty).toBe(8);
    expect(useStore.getState().credits[0].remainingAmount).toBe(1000); // adjusted, no cash out
    expect(ret.amountPaid).toBe(-0);
    expect(useStore.getState().returnableQty(sale.id)).toEqual([2]);
    expect(useStore.getState().processReturn(sale.id, [{ index: 0, quantity: 5 }], 'Cash')).toBeNull();
    const pl = profitAndLoss(useStore.getState());
    expect(pl.netSales).toBe(2000);
    expect(pl.cogs).toBe(1200);
    const ledger = customerLedger(useStore.getState().customers[0], useStore.getState());
    expect(ledger[ledger.length - 1].balance).toBe(1000);
  });

  it('day close keeps sales history (v1 used to delete it)', () => {
    const s = useStore.getState();
    const p = s.addProduct(makeProduct({ stockMode: 'piece', stockQty: 10, salePrice: 500, suitCutMeters: 0 }));
    s.addToCart(p);
    useStore.getState().completeSale('Cash', 'cash', 0);
    const closing = useStore.getState().closeDay({ countedCash: 450, openingCash: 0 });
    expect(useStore.getState().sales).toHaveLength(1);
    expect(closing.expectedCash).toBe(500);
    expect(closing.difference).toBe(-50);
    useStore.getState().closeDayAndResetSales();
    expect(useStore.getState().sales).toHaveLength(1);
  });

  it('purchase creates a thaan per line and supplier payable', () => {
    const s = useStore.getState();
    const p = s.addProduct(makeProduct({ stockMode: 'color_meter', colorStocks: [], stockQty: 0 }));
    const sup = s.addSupplier({ name: 'Faisalabad Mills', phone: '041', openingBalance: 0 });
    const pur = useStore.getState().addPurchase({
      supplierId: sup.id, supplierName: sup.name, discount: 0, paid: 20000, paymentMethod: 'Cash',
      items: [
        { productId: p.id, productName: 'x', quantity: 50, unit: 'meter', color: 'Black', costPrice: 500, lineTotal: 0, rollNo: 'TH-1' },
        { productId: p.id, productName: 'x', quantity: 40, unit: 'meter', color: 'Navy', costPrice: 520, lineTotal: 0 },
      ],
    });
    expect(pur.total).toBe(50 * 500 + 40 * 520);
    expect(pur.due).toBe(pur.total - 20000);
    const prod = useStore.getState().products[0];
    expect(prod.rolls).toHaveLength(2);
    expect(prod.stockQty).toBe(90);
  });

  it('damaged stock adjustment records loss at cost', () => {
    const s = useStore.getState();
    const p = s.addProduct(makeProduct({ stockMode: 'piece', stockQty: 10, costPrice: 700, suitCutMeters: 0 }));
    const adj = useStore.getState().addStockAdjustment({ productId: p.id, type: 'damaged', quantity: 2, reason: 'water damage' })!;
    expect(adj.costValue).toBe(1400);
    expect(useStore.getState().products[0].stockQty).toBe(8);
    expect(profitAndLoss(useStore.getState()).stockLosses).toBe(1400);
  });
});

describe('migrations', () => {
  it('upgrades a v1 persisted state without touching existing records', () => {
    const v1 = { products: [{ id: 'p1', sku: 'A' }], sales: [{ id: 's1' }], settings: { storeName: 'Old' }, invoiceCounter: 1234 };
    const m = migrateState(v1, 0);
    expect(m.products).toEqual(v1.products);
    expect(m.sales).toEqual([{ id: 's1', kind: 'sale' }]);
    expect(m.suppliers).toEqual([]);
    expect(String(m.businessId)).toMatch(/^biz-/);
    expect(m.invoiceCounter).toBe(1234);
    expect(migrateState(m, 2).businessId).toBe(m.businessId);
  });
});

describe('cross-platform ZIP backup', () => {
  const img = 'data:image/png;base64,' + btoa('\x89PNG fake image bytes');
  const sample = () => {
    reset();
    const s = useStore.getState();
    s.updateSettings({ storeName: 'Karachi Cloth Center', logoUrl: img });
    s.addProduct(makeProduct({ imageUrl: img, sku: 'KCC-1', article: 'لان پرنٹ' }));
    s.addCustomer({ name: 'احمد', phone: '0300' });
    return useStore.getState().getBusinessData();
  };

  it('Windows backup → Android restore round-trips all data and images', async () => {
    const data = sample();
    const { bytes, manifest, fileName } = await buildBackupZip(data, { platform: 'windows', deviceId: 'win-1' });
    expect(fileName).toMatch(/\.dtbackup\.zip$/);
    expect(manifest.counts.products).toBe(1);
    const zip = await JSZip.loadAsync(bytes);
    expect(Object.keys(zip.files)).toEqual(expect.arrayContaining(['manifest.json', 'data.json', 'images/logo.png', 'templates/invoice.json']));
    const preview = await readBackup(bytes);
    expect(preview.warnings).toEqual([]);
    expect(preview.manifest.platform).toBe('windows');
    expect(preview.data.products[0].imageUrl).toBe(img);
    expect(preview.data.settings.logoUrl).toBe(img);
    expect(preview.data.products[0].article).toBe('لان پرنٹ');
    expect(preview.data.businessId).toBe(data.businessId);
    // "Android" restores
    useStore.getState().replaceBusinessData(preview.data);
    expect(useStore.getState().customers[0].name).toBe('احمد');
  });

  it('detects tampering', async () => {
    const { bytes } = await buildBackupZip(sample(), { platform: 'android', deviceId: 'and-1' });
    const zip = await JSZip.loadAsync(bytes);
    const d = JSON.parse(await zip.file('data.json')!.async('string'));
    d.products[0].salePrice = 1;
    zip.file('data.json', JSON.stringify(d));
    const evil = await zip.generateAsync({ type: 'uint8array' });
    await expect(readBackup(evil)).rejects.toBeInstanceOf(BackupError);
  });

  it('ignores unexpected / path-traversal entries instead of extracting them', async () => {
    const { bytes } = await buildBackupZip(sample(), { platform: 'windows', deviceId: 'w' });
    const zip = await JSZip.loadAsync(bytes);
    zip.file('../../evil.exe', 'MZ');
    zip.file('run.bat', 'del *');
    const p = await readBackup(await zip.generateAsync({ type: 'uint8array' }));
    expect(p.warnings.join(' ')).toContain('Ignored unexpected file');
  });

  it('refuses backups from a newer schema', async () => {
    const { bytes } = await buildBackupZip(sample(), { platform: 'windows', deviceId: 'w' });
    const zip = await JSZip.loadAsync(bytes);
    const m = JSON.parse(await zip.file('manifest.json')!.async('string'));
    m.schemaVersion = 99;
    zip.file('manifest.json', JSON.stringify(m));
    await expect(readBackup(await zip.generateAsync({ type: 'uint8array' }))).rejects.toThrow(/newer version/);
  });

  it('accepts legacy v1 JSON backups', async () => {
    const legacy = JSON.stringify({ products: [makeProduct()], customers: [], sales: [], settings: { storeName: 'Old' } });
    const p = await readBackup(legacy);
    expect(p.legacy).toBe(true);
    expect(p.data.products).toHaveLength(1);
    expect(p.data.suppliers).toEqual([]);
  });

  it('merge mode never overwrites and reports duplicates', () => {
    const a = sample();
    const b = { ...a, products: [...a.products, makeProduct({ sku: 'KCC-1' }), makeProduct({ sku: 'NEW-1' })] };
    const { merged, stats } = mergeBusinessData(a, b);
    expect(merged.products).toHaveLength(2);
    expect(stats.products).toEqual({ added: 1, duplicates: 2 });
  });
});

describe('amount in words', () => {
  it('uses lakh/crore', () => {
    expect(amountInWords(125050)).toBe('One Lakh Twenty Five Thousand Fifty Only');
    expect(amountInWords(0)).toBe('Zero Only');
  });
});
