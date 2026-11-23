import { ReactNode, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, ScanLine, Package, Menu } from 'lucide-react';
import { AppSidebar } from './AppSidebar';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useT } from '@/i18n';
import { useScanner } from '@/components/scan/ScanProvider';
import { StatusChips } from './StatusChips';
import { cn } from '@/lib/utils';
import { useStore } from '@/store/useStore';

export function AppLayout({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { t, dir } = useT();
  const { scan, lookup } = useScanner();
  const storeName = useStore(s => s.settings.storeName);

  const bottom = [
    { path: '/', label: t('nav.home'), icon: LayoutDashboard },
    { path: '/pos', label: 'POS', icon: ShoppingCart },
    { path: '#scan', label: t('nav.scan'), icon: ScanLine },
    { path: '/inventory', label: t('nav.stockShort'), icon: Package },
    { path: '#more', label: t('nav.more'), icon: Menu },
  ];

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background">
      <div className="hidden md:flex no-print"><AppSidebar /></div>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden no-print flex items-center justify-between px-3 h-12 border-b border-border bg-card safe-top">
          <p className="font-bold text-sm truncate">{storeName}</p>
          <StatusChips />
        </header>

        <main className="flex-1 overflow-auto pb-16 md:pb-0">{children}</main>

        {/* Mobile bottom navigation */}
        <nav className="md:hidden no-print fixed bottom-0 inset-x-0 z-30 bg-card border-t border-border grid grid-cols-5 safe-bottom">
          {bottom.map(b => {
            const active = b.path === location.pathname;
            const isScan = b.path === '#scan';
            return (
              <button key={b.path}
                onClick={() => {
                  if (b.path === '#more') setMenuOpen(true);
                  else if (isScan) scan(code => (location.pathname === '/pos' ? window.dispatchEvent(new CustomEvent('pos-scan', { detail: code })) : lookup(code)));
                  else navigate(b.path);
                }}
                className={cn('flex flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-semibold min-h-[56px]', active ? 'text-primary' : 'text-muted-foreground')}>
                {isScan ? (
                  <span className="w-11 h-11 -mt-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg"><b.icon className="w-5 h-5" /></span>
                ) : <b.icon className="w-5 h-5" />}
                <span>{b.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side={dir === 'rtl' ? 'right' : 'left'} className="p-0 w-[260px] border-0">
          <AppSidebar forceExpanded onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
