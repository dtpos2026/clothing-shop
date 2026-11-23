import {
  LayoutDashboard, ShoppingCart, Package, Truck, Users, BookOpen, BarChart3, Settings, Database, Wallet, Moon,
  Landmark, Calculator, UserPlus, Factory, PackageMinus, Barcode, FileText, Share2, Cloud, BookText,
} from 'lucide-react';
import type { translate } from '@/i18n';

type NavKey = Parameters<typeof translate>[1];

export interface NavItem { path: string; key: NavKey; icon: typeof LayoutDashboard; group: 'sell' | 'stock' | 'people' | 'money' | 'system'; adminOnly?: boolean }

export const NAV_ITEMS: NavItem[] = [
  { path: '/', key: 'nav.dashboard', icon: LayoutDashboard, group: 'sell' },
  { path: '/pos', key: 'nav.pos', icon: ShoppingCart, group: 'sell' },
  { path: '/inventory', key: 'nav.inventory', icon: Package, group: 'stock' },
  { path: '/goods-receiving', key: 'nav.receiving', icon: Truck, group: 'stock' },
  { path: '/purchases', key: 'nav.purchases', icon: Factory, group: 'stock' },
  { path: '/stock-adjustments', key: 'nav.stock', icon: PackageMinus, group: 'stock' },
  { path: '/labels', key: 'nav.labels', icon: Barcode, group: 'stock' },
  { path: '/customers', key: 'nav.customers', icon: Users, group: 'people' },
  { path: '/udhar', key: 'nav.udhar', icon: BookOpen, group: 'people' },
  { path: '/leads', key: 'nav.leads', icon: UserPlus, group: 'people' },
  { path: '/cashbook', key: 'nav.cashbook', icon: BookText, group: 'money' },
  { path: '/accounts', key: 'nav.accounts', icon: Landmark, group: 'money' },
  { path: '/accounting', key: 'nav.accounting', icon: Calculator, group: 'money' },
  { path: '/expenses', key: 'nav.expenses', icon: Wallet, group: 'money' },
  { path: '/reports', key: 'nav.reports', icon: BarChart3, group: 'money' },
  { path: '/day-close', key: 'nav.dayclose', icon: Moon, group: 'money' },
  { path: '/export', key: 'nav.export', icon: Share2, group: 'system' },
  { path: '/invoice-designer', key: 'nav.invoice', icon: FileText, group: 'system', adminOnly: true },
  { path: '/backup', key: 'nav.backup', icon: Database, group: 'system', adminOnly: true },
  { path: '/cloud', key: 'nav.cloud', icon: Cloud, group: 'system', adminOnly: true },
  { path: '/settings', key: 'nav.settings', icon: Settings, group: 'system', adminOnly: true },
];
