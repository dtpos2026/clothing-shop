import { describe, it, expect } from 'vitest';
import { addRoll, deductStock, restoreStock, ensureRolls, unitPriceFor, baseQtyFor, inventoryValuation, costPerBaseUnit, allowedSellUnits } from '@/core/inventory';
import { makeProduct, id } from './fixtures';

const T = '2026-03-01T10:00:00.000Z';

describe('Thaan / roll inventory', () => {
  it('50 m thaan, customer buys 4 m → 46 m remain', () => {
    let p = makeProduct({ stockQty: 0 });
    p = addRoll(p, { rollNo: 'T-1', initialMeters: 50, costPerMeter: 500, receivedAt: T }, id, T);
    expect(p.stockQty).toBe(50);
    const r = deductStock(p, baseQtyFor(p, 'meter', 4));
    expect(r.product.stockQty).toBe(46);
    expect(r.product.rolls![0].remainingMeters).toBe(46);
    expect(r.cost).toBe(2000);
    expect(r.shortfall).toBe(0);
  });

  it('multiple rolls of the same design keep independent quantity and cost (FIFO)', () => {
    let p = makeProduct();
    p = addRoll(p, { rollNo: 'A', initialMeters: 10, costPerMeter: 400, receivedAt: '2026-01-01T00:00:00Z' }, id, T);
    p = addRoll(p, { rollNo: 'B', initialMeters: 30, costPerMeter: 600, receivedAt: '2026-02-01T00:00:00Z' }, id, T);
    const r = deductStock(p, 14);
    const [a, b] = r.product.rolls!;
    expect(a.remainingMeters).toBe(0);
    expect(a.status).toBe('finished');
    expect(b.remainingMeters).toBe(26);
    expect(r.cost).toBe(10 * 400 + 4 * 600);
    expect(r.product.stockQty).toBe(26);
  });

  it('cuts from a chosen roll first', () => {
    let p = makeProduct();
    p = addRoll(p, { rollNo: 'A', initialMeters: 10, costPerMeter: 400, receivedAt: '2026-01-01T00:00:00Z' }, id, T);
    p = addRoll(p, { rollNo: 'B', initialMeters: 30, costPerMeter: 600, receivedAt: '2026-02-01T00:00:00Z' }, id, T);
    const rollB = p.rolls![1].id;
    const r = deductStock(p, 5, { rollId: rollB });
    expect(r.product.rolls![0].remainingMeters).toBe(10);
    expect(r.product.rolls![1].remainingMeters).toBe(25);
  });

  it('colour-wise rolls update colour stock', () => {
    let p = makeProduct({ stockMode: 'color_meter', colorStocks: [] });
    p = addRoll(p, { rollNo: 'R1', color: 'Black', initialMeters: 50, costPerMeter: 500, receivedAt: T }, id, T);
    p = addRoll(p, { rollNo: 'R2', color: 'Navy', initialMeters: 40, costPerMeter: 500, receivedAt: T }, id, T);
    const r = deductStock(p, 4.5, { color: 'Navy' });
    expect(r.product.colorStocks).toEqual([{ color: 'Black', quantity: 50 }, { color: 'Navy', quantity: 35.5 }]);
    expect(r.product.stockQty).toBe(85.5);
  });

  it('converts existing legacy stock into opening rolls before adding the first thaan', () => {
    const legacy = makeProduct({ stockMode: 'color_meter', colorStocks: [{ color: 'Black', quantity: 20 }], stockQty: 20 });
    const withOpening = ensureRolls(legacy, id, T);
    expect(withOpening.rolls).toHaveLength(1);
    const p = addRoll(legacy, { rollNo: 'NEW', color: 'Black', initialMeters: 50, costPerMeter: 520, receivedAt: T }, id, T);
    expect(p.stockQty).toBe(70);
    expect(p.colorStocks).toEqual([{ color: 'Black', quantity: 70 }]);
  });

  it('restoring a return puts meters back on the roll', () => {
    let p = makeProduct();
    p = addRoll(p, { rollNo: 'A', initialMeters: 50, costPerMeter: 500, receivedAt: T }, id, T);
    const sold = deductStock(p, 4).product;
    const back = restoreStock(sold, 4);
    expect(back.stockQty).toBe(50);
    expect(back.rolls![0].remainingMeters).toBe(50);
  });

  it('legacy products without rolls behave like v1 (no negative stock)', () => {
    const p = makeProduct({ stockMode: 'piece', stockQty: 3, suitCutMeters: 0 });
    const r = deductStock(p, 5);
    expect(r.product.stockQty).toBe(0);
    expect(r.shortfall).toBe(2);
  });
});

describe('pricing and units', () => {
  const p = makeProduct({ salePrice: 2800, suitCutMeters: 4, wholesalePrice: 2400 });
  it('suit sale deducts suitCut meters', () => expect(baseQtyFor(p, 'suit', 2)).toBe(8));
  it('meter price derives from suit price', () => expect(unitPriceFor(p, 'meter')).toBe(700));
  it('explicit per-meter price wins', () => expect(unitPriceFor({ ...p, pricePerMeter: 750 }, 'meter')).toBe(750));
  it('wholesale tier', () => {
    expect(unitPriceFor(p, 'suit', 'wholesale')).toBe(2400);
    expect(unitPriceFor(p, 'meter', 'wholesale')).toBe(600);
  });
  it('allowed units', () => {
    expect(allowedSellUnits(p)).toEqual(['suit', 'meter']);
    expect(allowedSellUnits({ ...p, stockMode: 'piece' })).toEqual(['piece']);
  });
  it('cost per meter from legacy suit cost', () => expect(costPerBaseUnit(p)).toBe(500));
});

describe('valuation', () => {
  it('values rolls at their own cost', () => {
    let p = makeProduct();
    p = addRoll(p, { rollNo: 'A', initialMeters: 10, costPerMeter: 400, receivedAt: T }, id, T);
    p = addRoll(p, { rollNo: 'B', initialMeters: 10, costPerMeter: 600, receivedAt: T }, id, T);
    const piece = makeProduct({ stockMode: 'piece', stockQty: 5, costPrice: 1000, salePrice: 1500, suitCutMeters: 0 });
    const v = inventoryValuation([p, piece]);
    expect(v.costValue).toBe(4000 + 6000 + 5000);
    expect(v.retailValue).toBe(20 * 700 + 5 * 1500);
    expect(v.units).toEqual({ meters: 20, pieces: 5 });
  });
});
