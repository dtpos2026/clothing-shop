import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Package, Truck, Users, BookOpen,
  BarChart3, Settings, Database, ChevronLeft, ChevronRight, Store,
  Wallet, Moon, Landmark, Calculator, UserPlus, LogOut
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/pos', label: 'POS / Billing', icon: ShoppingCart },
  { path: '/inventory', label: 'Inventory', icon: Package },
  { path: '/goods-receiving', label: 'Goods Receiving', icon: Truck },
  { path: '/customers', label: 'Customers', icon: Users },
  { path: '/udhar', label: 'Udhar / Khata', icon: BookOpen },
  { path: '/accounts', label: 'Accounts', icon: Landmark },
  { path: '/accounting', label: 'Accounting', icon: Calculator },
  { path: '/expenses', label: 'Expenses', icon: Wallet },
  { path: '/leads', label: 'Leads', icon: UserPlus },
  { path: '/reports', label: 'Reports', icon: BarChart3 },
  { path: '/day-close', label: 'Day Close', icon: Moon },
  { path: '/settings', label: 'Settings', icon: Settings },
  { path: '/backup', label: 'Backup / Restore', icon: Database },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { settings, currentUser, setLoggedIn, users } = useStore();

  const activeUsers = users.filter(u => u.active);
  const showLogout = activeUsers.length > 0;

  const handleLogout = () => {
    setLoggedIn(false);
  };

  return (
    <aside
      className={cn(
        'h-screen flex flex-col transition-all duration-300 relative flex-shrink-0',
        collapsed ? 'w-[72px]' : 'w-[250px]'
      )}
      style={{ background: 'hsl(var(--sidebar-bg))' }}
    >
      {/* Header with Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b" style={{ borderColor: 'hsl(var(--sidebar-hover))' }}>
        {settings.logoUrl ? (
          <img
            src={settings.logoUrl}
            alt="Logo"
            className="flex-shrink-0 rounded-lg object-contain"
            style={{ width: collapsed ? 36 : 40, height: collapsed ? 36 : 40 }}
          />
        ) : (
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'hsl(var(--sidebar-accent))' }}>
            <Store className="w-5 h-5 text-foreground" />
          </div>
        )}
        {!collapsed && (
          <div className="overflow-hidden min-w-0">
            <h1 className="text-sm font-extrabold truncate" style={{ color: 'hsl(var(--sidebar-fg))' }}>
              {settings.storeName}
            </h1>
            <p className="text-[10px] truncate" style={{ color: 'hsl(var(--sidebar-fg) / 0.5)' }}>Premium POS System</p>
          </div>
        )}
      </div>

      {/* Current User */}
      {!collapsed && showLogout && (
        <div className="px-4 py-2 border-b flex items-center justify-between" style={{ borderColor: 'hsl(var(--sidebar-hover))' }}>
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate" style={{ color: 'hsl(var(--sidebar-fg))' }}>{currentUser.name}</p>
            <p className="text-[10px] capitalize" style={{ color: 'hsl(var(--sidebar-fg) / 0.45)' }}>{currentUser.role}</p>
          </div>
          <button onClick={handleLogout} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" title="Logout">
            <LogOut className="w-4 h-4" style={{ color: 'hsl(var(--sidebar-fg) / 0.6)' }} />
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200',
                isActive ? 'font-bold' : 'font-medium'
              )}
              style={{
                background: isActive ? 'hsl(var(--sidebar-active))' : 'transparent',
                color: isActive ? 'hsl(var(--sidebar-fg))' : 'hsl(var(--sidebar-fg) / 0.65)',
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'hsl(var(--sidebar-hover))'; e.currentTarget.style.color = 'hsl(var(--sidebar-fg))'; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; if (!isActive) e.currentTarget.style.color = 'hsl(var(--sidebar-fg) / 0.65)'; }}
              title={item.label}
            >
              <item.icon className={cn('w-5 h-5 flex-shrink-0')} style={isActive ? { color: 'hsl(var(--sidebar-accent))' } : {}} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3.5 top-20 w-7 h-7 rounded-full bg-card border border-border shadow-md flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors z-10"
      >
        {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>

      {/* Logout button for collapsed */}
      {collapsed && showLogout && (
        <button onClick={handleLogout} className="mx-auto mb-2 p-2 rounded-lg hover:bg-white/10 transition-colors" title="Logout">
          <LogOut className="w-5 h-5" style={{ color: 'hsl(var(--sidebar-fg) / 0.6)' }} />
        </button>
      )}

      {/* Footer */}
      <div className="px-4 py-3 border-t" style={{ borderColor: 'hsl(var(--sidebar-hover))' }}>
        {!collapsed && (
          <p className="text-[10px] text-center" style={{ color: 'hsl(var(--sidebar-fg) / 0.35)' }}>
            {settings.developerCompany || 'Digital Target'} POS v2.0
          </p>
        )}
      </div>
    </aside>
  );
}
