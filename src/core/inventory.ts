/**
 * Fabric inventory domain logic (pure, framework-free, unit tested).
 *
 * Units
 * -----
 * Every product has a *base unit*: meters for meter-mode products, pieces otherwise.
 * Stock (stockQty, colorStocks, rolls) is always stored in the base unit.
 * A cart line can be sold per meter, per suit (meters = qty × suitCutMeters) or per piece.
 *
 * Rolls (Thaan)
 * -------------
 * When a meter product has rolls, the rolls are the source of truth: colorStocks and
 * stockQty are recomputed from active rolls after every movement.
 * Sale of 4 m from a 50 m thaan → that roll becomes 46 m, product stock drops by 4.
 */
import type { CartItem, FabricRoll, PriceTier, Product, SellUnit } from '@/types';

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const isMeterProduct = (p: Pick<Product, 'stockMode'>) =>
  p.stockMode === 'meter' || p.stockMode === 'color_meter';

export const isColorProduct = (p: Pick<Product, 'stockMode'>) =>
  p.stockMode === 'color_piece' || p.stockMode === 'color_meter';

export const baseUnit = (p: Pick<Product, 'stockMode'>): 'meter' | 'piece' =>
  isMeterProduct(p) ? 'meter' : 'piece';

export const unitLabel = (u: SellUnit | 'meter' | 'piece') =>
  u === 'meter' ? 'm' : u === 'suit' ? 'suit' : 'pc';

/** Sell units a product can be sold in. */
export function allowedSellUnits(p: Product): SellUnit[] {
  if (!isMeterProduct(p)) return ['piece'];
  return p.suitCutMeters > 0 ? ['suit', 'meter'] : ['meter'];
}

/** Legacy cart lines had no sellUnit: meter products were sold per suit. */
export function effectiveSellUnit(item: Pick<CartItem, 'sellUnit' | 'product'>): SellUnit {
  if (item.sellUnit) return item.sellUnit;
  return isMeterProduct(item.product) ? (item.product.suitCutMeters > 0 ? 'suit' : 'meter') : 'piece';
}

export function defaultSellUnit(p: Product): SellUnit {
  return allowedSellUnits(p)[0];
}

/** Quantity of a cart line expressed in the product's base unit. */
export function baseQtyFor(product: Product, sellUnit: SellUnit, quantity: number): number {
  if (sellUnit === 'suit') return round2(quantity * (product.suitCutMeters || 0));
  return quantity;
}

export function itemBaseQty(item: Pick<CartItem, 'sellUnit' | 'product' | 'quantity'>): number {
  return baseQtyFor(item.product, effectiveSellUnit(item), item.quantity);
}

/** Retail/wholesale unit price for a sell unit. salePrice is per suit for meter products (legacy). */
export function unitPriceFor(p: Product, sellUnit: SellUnit, tier: PriceTier = 'retail'): number {
  const suitPrice = tier === 'wholesale' && p.wholesalePrice ? p.wholesalePrice : p.salePrice;
  if (sellUnit === 'meter') {
    const perMeter = tier === 'wholesale' ? (p.wholesalePricePerMeter ?? p.pricePerMeter) : p.pricePerMeter;
    if (perMeter && perMeter > 0) return perMeter;
    return p.suitCutMeters > 0 ? round2(suitPrice / p.suitCutMeters) : suitPrice;
  }
  return suitPrice;
}

/** Cost of one base unit (meter or piece). */
export function costPerBaseUnit(p: Product, color?: string): number {
  const rolls = activeRolls(p, color);
  if (rolls.length > 0) {
    const meters = rolls.reduce((s, r) => s + r.remainingMeters, 0);
    if (meters > 0) return round2(rolls.reduce((s, r) => s + r.remainingMeters * r.costPerMeter, 0) / meters);
  }
  if (isMeterProduct(p) && p.suitCutMeters > 0) return round2(p.costPrice / p.suitCutMeters);
  return p.costPrice;
}

export function activeRolls(p: Product, color?: string): FabricRoll[] {
  return (p.rolls || []).filter(r => r.status === 'active' && (color === undefined || (r.color || undefined) === color));
}

/** Available stock in base units for a product (optionally a single colour). */
export function availableQty(p: Product, color?: string): number {
  if (color !== undefined && p.colorStocks.length > 0) {
    return p.colorStocks.find(c => c.color === color)?.quantity ?? 0;
  }
  return p.stockQty;
}

/** Rebuild stockQty/colorStocks from rolls (no-op if the product has no rolls). */
export function recomputeFromRolls(p: Product): Product {
  if (!p.rolls || p.rolls.length === 0) return p;
  const rolls = p.rolls.map(r =>
    r.status === 'active' && r.remainingMeters <= 0.0001 ? { ...r, remainingMeters: 0, status: 'finished' as const } : r,
  );
  const active = rolls.filter(r => r.status === 'active');
  const total = round2(active.reduce((s, r) => s + r.remainingMeters, 0));
  let colorStocks = p.colorStocks;
  if (isColorProduct(p)) {
    const map = new Map<string, number>();
    // keep known colours (even when empty) so they stay selectable
    p.colorStocks.forEach(c => map.set(c.color, 0));
    active.forEach(r => {
      const key = r.color || 'Default';
      map.set(key, round2((map.get(key) || 0) + r.remainingMeters));
    });
    colorStocks = [...map.entries()].map(([color, quantity]) => ({ color, quantity }));
  }
  return { ...p, rolls, stockQty: total, colorStocks };
}

/**
 * Converts existing (pre-roll) stock into "opening" rolls so the roll invariant holds
 * once the first real roll is received. Idempotent.
 */
export function ensureRolls(p: Product, makeId: () => string, nowIso: string): Product {
  if (!isMeterProduct(p) || (p.rolls && p.rolls.length > 0)) return p;
  const cost = costPerBaseUnit(p);
  const opening: FabricRoll[] = [];
  if (isColorProduct(p) && p.colorStocks.length > 0) {
    p.colorStocks.filter(c => c.quantity > 0).forEach((c, i) =>
      opening.push({
        id: makeId(), rollNo: `OPEN-${i + 1}`, color: c.color, initialMeters: c.quantity,
        remainingMeters: c.quantity, costPerMeter: cost, status: 'active', receivedAt: nowIso,
        notes: 'Opening stock (converted)',
      }));
  } else if (p.stockQty > 0) {
    opening.push({
      id: makeId(), rollNo: 'OPEN-1', initialMeters: p.stockQty, remainingMeters: p.stockQty,
      costPerMeter: cost, status: 'active', receivedAt: nowIso, notes: 'Opening stock (converted)',
    });
  }
  return { ...p, rolls: opening };
}

export interface RollAllocation { rollId: string; meters: number; cost: number }

export interface StockMoveResult {
  product: Product;
  /** Cost of goods moved (positive). */
  cost: number;
  allocations: RollAllocation[];
  /** Base units that could not be taken because stock ran out. */
  shortfall: number;
}

/**
 * Remove `qty` base units (sale, damage…). Rolls are consumed from the chosen roll first,
 * then FIFO by receivedAt. Stock never goes below zero (same as v1 behaviour).
 */
export function deductStock(p: Product, qty: number, opts: { color?: string; rollId?: string } = {}): StockMoveResult {
  const { color, rollId } = opts;
  if (qty <= 0) return { product: p, cost: 0, allocations: [], shortfall: 0 };

  if (p.rolls && p.rolls.length > 0) {
    let remaining = qty;
    let cost = 0;
    const allocations: RollAllocation[] = [];
    const order = [...p.rolls]
      .filter(r => r.status === 'active' && (color === undefined || p.colorStocks.length === 0 || (r.color || 'Default') === color))
      .sort((a, b) => (a.id === rollId ? -1 : b.id === rollId ? 1 : a.receivedAt.localeCompare(b.receivedAt)));
    const updates = new Map<string, number>();
    for (const r of order) {
      if (remaining <= 0) break;
      const take = Math.min(r.remainingMeters, remaining);
      if (take <= 0) continue;
      updates.set(r.id, round2(r.remainingMeters - take));
      allocations.push({ rollId: r.id, meters: round2(take), cost: round2(take * r.costPerMeter) });
      cost += take * r.costPerMeter;
      remaining = round2(remaining - take);
    }
    const rolls = p.rolls.map(r => (updates.has(r.id) ? { ...r, remainingMeters: updates.get(r.id)! } : r));
    return { product: recomputeFromRolls({ ...p, rolls }), cost: round2(cost), allocations, shortfall: Math.max(0, remaining) };
  }

  const unitCost = costPerBaseUnit(p);
  if (color !== undefined && p.colorStocks.length > 0) {
    const have = p.colorStocks.find(c => c.color === color)?.quantity ?? 0;
    const taken = Math.min(have, qty);
    const colorStocks = p.colorStocks.map(c => (c.color === color ? { ...c, quantity: round2(Math.max(0, c.quantity - qty)) } : c));
    return {
      product: { ...p, colorStocks, stockQty: round2(colorStocks.reduce((s, c) => s + c.quantity, 0)) },
      cost: round2(qty * unitCost), allocations: [], shortfall: round2(qty - taken),
    };
  }
  const taken = Math.min(p.stockQty, qty);
  return {
    product: { ...p, stockQty: round2(Math.max(0, p.stockQty - qty)) },
    cost: round2(qty * unitCost), allocations: [], shortfall: round2(qty - taken),
  };
}

/** Put `qty` base units back (returns, sale deletion, corrections). */
export function restoreStock(p: Product, qty: number, opts: { color?: string; rollId?: string } = {}): Product {
  const { color, rollId } = opts;
  if (qty <= 0) return p;
  if (p.rolls && p.rolls.length > 0) {
    const candidates = p.rolls.filter(r => (color === undefined || p.colorStocks.length === 0 || (r.color || 'Default') === color));
    const target =
      candidates.find(r => r.id === rollId) ||
      [...candidates].filter(r => r.status === 'active').sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))[0] ||
      [...candidates].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))[0];
    if (target) {
      const rolls = p.rolls.map(r =>
        r.id === target.id
          ? { ...r, remainingMeters: round2(r.remainingMeters + qty), status: r.status === 'damaged' ? r.status : ('active' as const) }
          : r);
      return recomputeFromRolls({ ...p, rolls });
    }
  }
  if (color !== undefined && p.colorStocks.length > 0) {
    const exists = p.colorStocks.some(c => c.color === color);
    const colorStocks = exists
      ? p.colorStocks.map(c => (c.color === color ? { ...c, quantity: round2(c.quantity + qty) } : c))
      : [...p.colorStocks, { color, quantity: qty }];
    return { ...p, colorStocks, stockQty: round2(colorStocks.reduce((s, c) => s + c.quantity, 0)) };
  }
  return { ...p, stockQty: round2(p.stockQty + qty) };
}

/** Add a new thaan/roll (goods receiving / purchase). */
export function addRoll(
  p: Product,
  roll: Omit<FabricRoll, 'id' | 'remainingMeters' | 'status'> & { remainingMeters?: number },
  makeId: () => string,
  nowIso: string,
): Product {
  const base = ensureRolls(p, makeId, nowIso);
  const full: FabricRoll = {
    ...roll,
    id: makeId(),
    remainingMeters: roll.remainingMeters ?? roll.initialMeters,
    status: 'active',
  };
  const colorStocks =
    isColorProduct(base) && full.color && !base.colorStocks.some(c => c.color === full.color)
      ? [...base.colorStocks, { color: full.color, quantity: 0 }]
      : base.colorStocks;
  return recomputeFromRolls({ ...base, colorStocks, rolls: [...(base.rolls || []), full] });
}

export interface StockStatus { level: 'ok' | 'low' | 'out' }
export function stockStatus(p: Product): StockStatus['level'] {
  if (p.stockQty <= 0) return 'out';
  if (p.stockQty <= p.lowStockThreshold) return 'low';
  return 'ok';
}

export interface Valuation { costValue: number; retailValue: number; units: { meters: number; pieces: number } }

/** Inventory valuation at cost (roll-accurate) and at retail. */
export function inventoryValuation(products: Product[]): Valuation {
  let costValue = 0;
  let retailValue = 0;
  let meters = 0;
  let pieces = 0;
  for (const p of products) {
    if (!p.active) continue;
    if (isMeterProduct(p)) {
      meters += p.stockQty;
      const rolls = activeRolls(p);
      costValue += rolls.length
        ? rolls.reduce((s, r) => s + r.remainingMeters * r.costPerMeter, 0)
        : p.stockQty * costPerBaseUnit(p);
      retailValue += p.stockQty * unitPriceFor(p, 'meter');
    } else {
      pieces += p.stockQty;
      costValue += p.stockQty * p.costPrice;
      retailValue += p.stockQty * p.salePrice;
    }
  }
  return { costValue: round2(costValue), retailValue: round2(retailValue), units: { meters: round2(meters), pieces } };
}
