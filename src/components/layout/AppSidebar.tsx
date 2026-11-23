import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Store, LogOut } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';
import { NAV_ITEMS } from './nav';
import { APP_VERSION } from '@/core/defaults';

const GROUP_LABEL: Record<string, string> = { sell: 'Sell', stock: 'Stock', people: 'People', money: 'Money', system: 'System' };

export function AppSidebar({ onNavigate, forceExpanded }: { onNavigate?: () => void; forceExpanded?: boolean }) {
  const [collapsedState, setCollapsed] = useState(false);
  const collapsed = forceExpanded ? false : collapsedState;
  const location = useLocation();
  const navigate = useNavigate();
  const { settings, currentUser, setLoggedIn, users } = useStore();
  const { t, dir } = useT();

  const showLogout = users.some(u => u.active);
  const items = NAV_ITEMS.filter(i => !(i.adminOnly && currentUser.role === 'cashier'));
  let lastGroup = '';

  return (
    <aside
      className={cn('h-full flex flex-col transition-all duration-300 relative flex-shrink-0', collapsed ? 'w-[72px]' : 'w-[250px]')}
      style={{ background: 'hsl(var(--sidebar-bg))' }}
    >
      <div className="flex items-center gap-3 px-4 py-4 border-b" style={{ borderColor: 'hsl(var(--sidebar-hover))' }}>
        {settings.logoUrl ? (
          <img src={settings.logoUrl} alt="Logo" className="flex-shrink-0 rounded-lg object-contain bg-white/90" style={{ width: 40, height: 40 }} />
        ) : (
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'hsl(var(--sidebar-accent))' }}>
            <Store className="w-5 h-5 text-foreground" />
          </div>
        )}
        {!collapsed && (
          <div className="overflow-hidden min-w-0">
            <h1 className="text-sm font-extrabold truncate" style={{ color: 'hsl(var(--sidebar-fg))' }}>{settings.storeName}</h1>
            <p className="text-[10px] truncate" style={{ color: 'hsl(var(--sidebar-fg) / 0.5)' }}>Fabric & Clothing POS</p>
          </div>
        )}
      </div>

      {!collapsed && showLogout && (
        <div className="px-4 py-2 border-b flex items-center justify-between" style={{ borderColor: 'hsl(var(--sidebar-hover))' }}>
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate" style={{ color: 'hsl(var(--sidebar-fg))' }}>{currentUser.name}</p>
            <p className="text-[10px] capitalize" style={{ color: 'hsl(var(--sidebar-fg) / 0.45)' }}>{currentUser.role}</p>
          </div>
          <button onClick={() => setLoggedIn(false)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" title="Logout" aria-label="Logout">
            <LogOut className="w-4 h-4" style={{ color: 'hsl(var(--sidebar-fg) / 0.6)' }} />
          </button>
        </div>
      )}

      <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto scrollbar-thin">
        {items.map(item => {
          const isActive = location.pathname === item.path;
          const header = !collapsed && item.group !== lastGroup ? GROUP_LABEL[item.group] : null;
          lastGroup = item.group;
          return (
            <div key={item.path}>
              {header && <p className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'hsl(var(--sidebar-fg) / 0.35)' }}>{header}</p>}
              <button
                onClick={() => { navigate(item.path); onNavigate?.(); }}
                className={cn('w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-200 text-start', isActive ? 'font-bold' : 'font-medium hover:bg-[hsl(var(--sidebar-hover))]')}
                style={{
                  background: isActive ? 'hsl(var(--sidebar-active))' : undefined,
                  color: isActive ? 'hsl(var(--sidebar-fg))' : 'hsl(var(--sidebar-fg) / 0.7)',
                }}
                title={t(item.key)}
              >
                <item.icon className="w-[18px] h-[18px] flex-shrink-0" style={isActive ? { color: 'hsl(var(--sidebar-accent))' } : {}} />
                {!collapsed && <span className="truncate">{t(item.key)}</span>}
              </button>
            </div>
          );
        })}
      </nav>

      {!forceExpanded && (
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -end-3.5 top-20 w-7 h-7 rounded-full bg-card border border-border shadow-md flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors z-10"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {(collapsed ? dir === 'ltr' : dir === 'rtl') ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      )}

      {collapsed && showLogout && (
        <button onClick={() => setLoggedIn(false)} className="mx-auto mb-2 p-2 rounded-lg hover:bg-white/10 transition-colors" title="Logout">
          <LogOut className="w-5 h-5" style={{ color: 'hsl(var(--sidebar-fg) / 0.6)' }} />
        </button>
      )}

      <div className="px-4 py-3 border-t" style={{ borderColor: 'hsl(var(--sidebar-hover))' }}>
        {!collapsed && (
          <p className="text-[10px] text-center" style={{ color: 'hsl(var(--sidebar-fg) / 0.35)' }}>
            {settings.developerCompany || 'Digital Target'} POS v{APP_VERSION}
          </p>
        )}
      </div>
    </aside>
  );
}
