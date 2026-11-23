import type { Product } from '@/types';

let n = 0;
export const id = () => `id-${++n}`;

export function makeProduct(over: Partial<Product> = {}): Product {
  return {
    id: id(), brand: 'Grace', article: 'Chinto', sku: `GRC-${n}`, category: 'Gents', productType: 'Fabric Suit',
    season: 'Winter', fabricCategory: 'Wash & Wear', salePrice: 2800, costPrice: 2000, active: true,
    stockMode: 'meter', stockQty: 0, colorStocks: [], suitCutMeters: 4, lowStockThreshold: 10,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...over,
  };
}
