import { ReactNode, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, ScanLine, Package, Menu, Cloud, CloudOff, RefreshCw, AlertTriangle, ShieldCheck, ShieldAlert } from 'lucide-react';
import { AppSidebar } from './AppSidebar';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useT } from '@/i18n';
import { useScanner } from '@/components/scan/ScanProvider';
import { useCloudStatus } from '@/cloud/status';
import { cn } from '@/lib/utils';
import { useStore } from '@/store/useStore';

function StatusChips() {
  const { online, sync, pending, license, syncError } = useCloudStatus();
  const navigate = useNavigate();
  const lic = license;
  return (
    <div className="flex items-center gap-1.5">
      <button onClick={() => navigate('/cloud')} title={syncError || `Sync: ${sync}`}
        className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold border',
          !online ? 'bg-muted text-muted-foreground border-border'
            : sync === 'error' ? 'bg-destructive/10 text-destructive border-destructive/30'
              : sync === 'syncing' ? 'bg-info/10 text-info border-info/30'
                : sync === 'idle' ? 'bg-success/10 text-success border-success/30' : 'bg-muted text-muted-foreground border-border')}>
        {!online ? <CloudOff className="w-3 h-3" /> : sync === 'syncing' ? <RefreshCw className="w-3 h-3 animate-spin" /> : sync === 'error' ? <AlertTriangle className="w-3 h-3" /> : <Cloud className="w-3 h-3" />}
        <span className="hidden sm:inline">{!online ? 'Offline' : sync === 'disabled' ? 'Local only' : sync === 'idle' ? 'Synced' : sync === 'syncing' ? `Syncing${pending ? ` ${pending}` : ''}` : sync === 'error' ? 'Sync error' : 'Offline'}</span>
      </button>
      {lic && (
        <button onClick={() => navigate('/cloud')} title={lic.state === 'invalid' ? lic.reason : 'License'}
          className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold border',
            lic.state === 'valid' ? 'bg-success/10 text-success border-success/30' : lic.state === 'grace' ? 'bg-warning/10 text-warning border-warning/30' : 'bg-destructive/10 text-destructive border-destructive/30')}>
          {lic.state === 'valid' ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
          <span className="hidden sm:inline">{lic.state === 'valid' ? `${lic.daysLeft}d` : lic.state === 'grace' ? `Grace ${lic.graceDaysLeft}d` : 'Unlicensed'}</span>
        </button>
      )}
    </div>
  );
}

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
        {/* Desktop status strip */}
        <div className="hidden md:flex no-print absolute top-2 end-4 z-20"><StatusChips /></div>

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
