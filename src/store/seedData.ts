import { useStore } from './useStore';
import type { Product, Customer, StockMode, ColorStock } from '@/types';

const colors = ['Black', 'Navy Blue', 'Maroon', 'White', 'Grey', 'Beige', 'Olive', 'Camel', 'Sky Blue', 'Charcoal'];

function makeColorStocks(clrs: string[], mode: StockMode, base: number): ColorStock[] {
  if (mode === 'color_piece' || mode === 'color_meter') {
    return clrs.map(c => ({ color: c, quantity: base + Math.floor(Math.random() * 20) }));
  }
  return [];
}

function calcTotal(cs: ColorStock[]): number {
  return cs.reduce((s, c) => s + c.quantity, 0);
}

export function seedDemoData() {
  const store = useStore.getState();
  if (store.products.length > 0) return; // already seeded

  const fabricProducts: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>[] = [
    {
      brand: 'Grace', article: 'Chinto', sku: 'GRC-CHN-001', category: 'Gents', productType: 'Fabric Suit',
      season: 'Winter', fabricCategory: 'Wash & Wear', salePrice: 2800, costPrice: 2000,
      active: true, stockMode: 'color_meter', stockQty: 0,
      colorStocks: makeColorStocks(['Black', 'Navy Blue', 'Charcoal', 'Grey', 'Maroon'], 'color_meter', 40),
      suitCutMeters: 4, lowStockThreshold: 20, description: 'Premium Wash & Wear fabric',
    },
    {
      brand: 'Grace', article: 'Royal', sku: 'GRC-RYL-002', category: 'Gents', productType: 'Fabric Suit',
      season: 'Summer', fabricCategory: 'Cotton', salePrice: 3200, costPrice: 2400,
      active: true, stockMode: 'color_meter', stockQty: 0,
      colorStocks: makeColorStocks(['White', 'Beige', 'Sky Blue', 'Olive'], 'color_meter', 35),
      suitCutMeters: 4.5, lowStockThreshold: 20, description: 'Premium Egyptian Cotton',
    },
    {
      brand: 'Gul Ahmed', article: 'Noor', sku: 'GA-NOR-001', category: 'Ladies', productType: 'Fabric Suit',
      season: 'Summer', fabricCategory: 'Lawn', salePrice: 4500, costPrice: 3200,
      active: true, stockMode: 'color_meter', stockQty: 0,
      colorStocks: makeColorStocks(['Maroon', 'Navy Blue', 'White', 'Beige', 'Sky Blue'], 'color_meter', 30),
      suitCutMeters: 5, lowStockThreshold: 15, description: 'Premium printed lawn 3-piece',
    },
    {
      brand: 'Khaddi', article: 'Elegance', sku: 'KHD-ELG-001', category: 'Ladies', productType: 'Fabric Suit',
      season: 'Winter', fabricCategory: 'Karandi', salePrice: 5500, costPrice: 4000,
      active: true, stockMode: 'color_meter', stockQty: 0,
      colorStocks: makeColorStocks(['Black', 'Maroon', 'Camel'], 'color_meter', 25),
      suitCutMeters: 4.5, lowStockThreshold: 10, description: 'Embroidered Karandi',
    },
    {
      brand: 'Al-Karam', article: 'Boski Premium', sku: 'AK-BSK-001', category: 'Gents', productType: 'Fabric Suit',
      season: 'Winter', fabricCategory: 'Boski', salePrice: 6000, costPrice: 4500,
      active: true, stockMode: 'color_meter', stockQty: 0,
      colorStocks: makeColorStocks(['White', 'Beige', 'Grey'], 'color_meter', 50),
      suitCutMeters: 4, lowStockThreshold: 15, description: 'Premium Boski for special occasions',
    },
    {
      brand: 'Bonanza', article: 'Reshmi Classic', sku: 'BNZ-RSH-001', category: 'Gents', productType: 'Fabric Suit',
      season: 'Summer', fabricCategory: 'Reshmi', salePrice: 3500, costPrice: 2500,
      active: true, stockMode: 'color_meter', stockQty: 0,
      colorStocks: makeColorStocks(['Charcoal', 'Navy Blue', 'Black', 'Olive'], 'color_meter', 45),
      suitCutMeters: 4, lowStockThreshold: 20, description: 'Cool Reshmi fabric',
    },
  ];

  const readyProducts: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>[] = [
    {
      brand: 'Junaid Jamshed', article: 'Stitched Kurta', sku: 'JJ-SK-001', category: 'Gents', productType: 'Ready Suit',
      season: 'Summer', fabricCategory: 'Cotton', salePrice: 4500, costPrice: 3200,
      active: true, stockMode: 'color_piece', stockQty: 0,
      colorStocks: makeColorStocks(['White', 'Beige', 'Sky Blue', 'Grey'], 'color_piece', 8),
      suitCutMeters: 0, lowStockThreshold: 5, description: 'Ready-made cotton kurta',
    },
    {
      brand: 'Sapphire', article: 'Ready Suit 3PC', sku: 'SPH-RS-001', category: 'Ladies', productType: 'Ready Suit',
      season: 'Summer', fabricCategory: 'Lawn', salePrice: 7500, costPrice: 5500,
      active: true, stockMode: 'color_piece', stockQty: 0,
      colorStocks: makeColorStocks(['Maroon', 'Navy Blue', 'Black'], 'color_piece', 6),
      suitCutMeters: 0, lowStockThreshold: 3, description: 'Stitched 3-piece lawn suit',
    },
    {
      brand: 'Nishat Linen', article: 'Formal Shirt', sku: 'NL-FS-001', category: 'Gents', productType: 'Other',
      season: 'Summer', fabricCategory: 'Cotton', salePrice: 3200, costPrice: 2200,
      active: true, stockMode: 'piece', stockQty: 45,
      colorStocks: [], suitCutMeters: 0, lowStockThreshold: 10, description: 'Formal cotton shirts',
    },
    {
      brand: 'Limelight', article: 'Embroidered Kurti', sku: 'LL-EK-001', category: 'Ladies', productType: 'Ready Suit',
      season: 'Winter', fabricCategory: 'Karandi', salePrice: 4200, costPrice: 3000,
      active: true, stockMode: 'color_piece', stockQty: 0,
      colorStocks: makeColorStocks(['Black', 'Maroon', 'Camel', 'Grey'], 'color_piece', 5),
      suitCutMeters: 0, lowStockThreshold: 3, description: 'Winter embroidered kurti',
    },
  ];

  // Set totals for color products
  [...fabricProducts, ...readyProducts].forEach(p => {
    if (p.colorStocks.length > 0) {
      p.stockQty = calcTotal(p.colorStocks);
    }
  });

  // Add products
  [...fabricProducts, ...readyProducts].forEach(p => store.addProduct(p));

  // Add customers
  const c1 = store.addCustomer({ name: 'Ahmed Khan', phone: '0300-1234567', address: 'Gulshan-e-Iqbal, Karachi' });
  const c2 = store.addCustomer({ name: 'Fatima Bibi', phone: '0321-9876543', address: 'Model Town, Lahore' });
  const c3 = store.addCustomer({ name: 'Muhammad Ali', phone: '0333-5551234', address: 'Satellite Town, Rawalpindi' });
  store.addCustomer({ name: 'Ayesha Siddiqui', phone: '0312-7778899', address: 'DHA Phase 5, Karachi' });
  store.addCustomer({ name: 'Bilal Hassan', phone: '0345-1112233' });

  // Update settings
  store.updateSettings({
    storeName: 'Al-Madina Cloth House',
    phone: '042-35761234',
    address: 'Shop #12, Anarkali Bazaar, Lahore',
    footerMessage: 'Shukriya! Visit again for quality fabrics.',
  });
}
