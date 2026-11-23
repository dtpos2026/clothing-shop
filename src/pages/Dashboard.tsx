import { useStore } from '@/store/useStore';
import {
  ShoppingCart, TrendingUp, Package, AlertTriangle,
  DollarSign, Users, CreditCard, BarChart3, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { format, isToday, isThisWeek, isThisMonth, parseISO, subDays, startOfDay, isSameDay } from 'date-fns';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const CHART_COLORS = [
  'hsl(160, 60%, 28%)', 'hsl(38, 90%, 55%)', 'hsl(210, 70%, 50%)',
  'hsl(0, 72%, 50%)', 'hsl(145, 60%, 40%)', 'hsl(280, 60%, 50%)',
];

export default function Dashboard() {
  const sales = useStore((s) => s.sales).filter(s => !s.deleted);
  const products = useStore((s) => s.products);
  const credits = useStore((s) => s.credits);
  const settings = useStore((s) => s.settings);

  const todaySales = sales.filter(s => isToday(parseISO(s.createdAt)));
  const weekSales = sales.filter(s => isThisWeek(parseISO(s.createdAt)));
  const monthSales = sales.filter(s => isThisMonth(parseISO(s.createdAt)));

  const todayTotal = todaySales.reduce((sum, s) => sum + s.total, 0);
  const weekTotal = weekSales.reduce((sum, s) => sum + s.total, 0);
  const monthTotal = monthSales.reduce((sum, s) => sum + s.total, 0);

  const totalCreditDue = credits.filter(c => !c.fullyPaid).reduce((sum, c) => sum + c.remainingAmount, 0);
  const lowStockProducts = products.filter(p => p.active && p.stockQty <= p.lowStockThreshold);

  // Daily sales chart (last 7 days)
  const dailyData = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), 6 - i);
    const daySales = sales.filter(s => isSameDay(parseISO(s.createdAt), date));
    return {
      name: format(date, 'EEE'),
      date: format(date, 'dd MMM'),
      sales: daySales.reduce((sum, s) => sum + s.total, 0),
      bills: daySales.length,
    };
  });

  // Category-wise pie chart
  const catMap: Record<string, number> = {};
  sales.forEach(s => s.items.forEach(i => {
    catMap[i.product.category] = (catMap[i.product.category] || 0) + i.lineTotal;
  }));
  const categoryData = Object.entries(catMap).map(([name, value]) => ({ name, value }));

  // Brand-wise bar chart
  const brandMap: Record<string, number> = {};
  sales.forEach(s => s.items.forEach(i => {
    brandMap[i.product.brand] = (brandMap[i.product.brand] || 0) + i.lineTotal;
  }));
  const brandData = Object.entries(brandMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, revenue]) => ({ name, revenue }));

  // Top selling items
  const itemSalesMap: Record<string, { name: string; brand: string; qty: number }> = {};
  sales.forEach(s => {
    s.items.forEach(item => {
      const key = item.productId;
      if (!itemSalesMap[key]) {
        itemSalesMap[key] = { name: item.product.article, brand: item.product.brand, qty: 0 };
      }
      itemSalesMap[key].qty += item.quantity;
    });
  });
  const topItems = Object.values(itemSalesMap).sort((a, b) => b.qty - a.qty).slice(0, 5);

  // Credit summary pie
  const totalCreditPaid = credits.reduce((sum, c) => sum + c.paidAmount, 0);
  const creditPieData = [
    { name: 'Paid', value: totalCreditPaid },
    { name: 'Remaining', value: totalCreditDue },
  ];

  const StatCard = ({ title, value, icon: Icon, color, subtitle }: { title: string; value: string; icon: any; color: string; subtitle?: string }) => (
    <div className="bg-card rounded-2xl p-5 border border-border shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{title}</span>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="text-2xl font-extrabold text-foreground tracking-tight">{value}</p>
      {subtitle && <p className="text-[11px] text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">{settings.storeName} — {format(new Date(), 'EEEE, dd MMM yyyy')}</p>
        </div>
        {settings.logoUrl && (
          <img src={settings.logoUrl} alt="Logo" style={{ width: Math.min(settings.logoWidth, 100), height: 'auto' }} className="opacity-80" />
        )}
      </div>

      {/* Stats Row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Today's Sales" value={`${settings.currency} ${todayTotal.toLocaleString()}`} icon={DollarSign} color="bg-primary/10 text-primary" subtitle={`${todaySales.length} bills today`} />
        <StatCard title="Weekly Sales" value={`${settings.currency} ${weekTotal.toLocaleString()}`} icon={TrendingUp} color="bg-info/10 text-info" subtitle={`${weekSales.length} bills this week`} />
        <StatCard title="Monthly Sales" value={`${settings.currency} ${monthTotal.toLocaleString()}`} icon={BarChart3} color="bg-success/10 text-success" subtitle={`${monthSales.length} bills this month`} />
        <StatCard title="Credit Due (Udhar)" value={`${settings.currency} ${totalCreditDue.toLocaleString()}`} icon={CreditCard} color="bg-warning/10 text-warning" subtitle={`${credits.filter(c => !c.fullyPaid).length} pending`} />
      </div>

      {/* Stats Row 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Today's Bills" value={String(todaySales.length)} icon={ShoppingCart} color="bg-primary/10 text-primary" />
        <StatCard title="Total Products" value={String(products.filter(p => p.active).length)} icon={Package} color="bg-info/10 text-info" />
        <StatCard title="Low Stock Alerts" value={String(lowStockProducts.length)} icon={AlertTriangle} color="bg-destructive/10 text-destructive" />
        <StatCard title="Total Bills" value={String(sales.length)} icon={Users} color="bg-success/10 text-success" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Sales Trend */}
        <div className="lg:col-span-2 bg-card rounded-2xl border border-border p-5">
          <h3 className="font-bold text-foreground mb-4 text-sm">📊 Daily Sales Trend (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={dailyData}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(160, 60%, 28%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(160, 60%, 28%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 15%, 89%)" />
              <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${settings.currency}${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: '1px solid hsl(40, 15%, 89%)', fontSize: '12px' }}
                formatter={(value: number) => [`${settings.currency} ${value.toLocaleString()}`, 'Sales']}
                labelFormatter={(label, payload) => payload?.[0]?.payload?.date || label}
              />
              <Area type="monotone" dataKey="sales" stroke="hsl(160, 60%, 28%)" strokeWidth={2.5} fill="url(#salesGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Category Split */}
        <div className="bg-card rounded-2xl border border-border p-5">
          <h3 className="font-bold text-foreground mb-4 text-sm">🧥 Category Sales Split</h3>
          {categoryData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No sales data</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} fontSize={11}>
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [`${settings.currency} ${value.toLocaleString()}`, 'Revenue']} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Brand-wise Revenue */}
        <div className="bg-card rounded-2xl border border-border p-5">
          <h3 className="font-bold text-foreground mb-4 text-sm">🏷️ Top Brands by Revenue</h3>
          {brandData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No sales data</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={brandData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 15%, 89%)" horizontal={false} />
                <XAxis type="number" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" fontSize={11} tickLine={false} axisLine={false} width={90} />
                <Tooltip formatter={(value: number) => [`${settings.currency} ${value.toLocaleString()}`, 'Revenue']} contentStyle={{ borderRadius: '12px', border: '1px solid hsl(40, 15%, 89%)', fontSize: '12px' }} />
                <Bar dataKey="revenue" fill="hsl(38, 90%, 55%)" radius={[0, 6, 6, 0]} barSize={22} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Credit Summary */}
        <div className="bg-card rounded-2xl border border-border p-5">
          <h3 className="font-bold text-foreground mb-4 text-sm">💰 Udhar / Credit Summary</h3>
          {totalCreditDue + totalCreditPaid === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No credit data</p>
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie data={creditPieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={4} dataKey="value">
                    <Cell fill="hsl(145, 60%, 40%)" />
                    <Cell fill="hsl(38, 90%, 55%)" />
                  </Pie>
                  <Tooltip formatter={(value: number) => [`${settings.currency} ${value.toLocaleString()}`]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-success" />
                  <span className="text-muted-foreground">Paid:</span>
                  <span className="font-bold">{settings.currency} {totalCreditPaid.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-warning" />
                  <span className="text-muted-foreground">Remaining:</span>
                  <span className="font-bold">{settings.currency} {totalCreditDue.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Sales */}
        <div className="bg-card rounded-2xl border border-border p-5">
          <h3 className="font-bold text-foreground mb-4 text-sm">🧾 Recent Sales</h3>
          {sales.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales yet</p>
          ) : (
            <div className="space-y-3">
              {sales.slice(-5).reverse().map(s => (
                <div key={s.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-semibold">{s.invoiceNumber}</p>
                    <p className="text-[11px] text-muted-foreground">{s.customerName || 'Walk-in'} · {format(parseISO(s.createdAt), 'dd MMM, hh:mm a')}</p>
                  </div>
                  <span className="font-bold text-sm font-mono">{settings.currency} {s.total.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Selling */}
        <div className="bg-card rounded-2xl border border-border p-5">
          <h3 className="font-bold text-foreground mb-4 text-sm">🔥 Top Selling Items</h3>
          {topItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales data</p>
          ) : (
            <div className="space-y-3">
              {topItems.map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">#{i + 1}</span>
                    <div>
                      <p className="text-sm font-semibold">{item.name}</p>
                      <p className="text-[11px] text-muted-foreground">{item.brand}</p>
                    </div>
                  </div>
                  <span className="text-sm font-mono font-bold">{item.qty} sold</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-card rounded-2xl border border-border p-5">
          <h3 className="font-bold text-foreground mb-4 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" /> Low Stock Alerts
          </h3>
          {lowStockProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">All stock levels are healthy ✅</p>
          ) : (
            <div className="space-y-3">
              {lowStockProducts.slice(0, 5).map(p => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-semibold">{p.brand} — {p.article}</p>
                    <p className="text-[11px] text-muted-foreground">{p.stockMode.includes('meter') ? 'Meters' : 'Pieces'}</p>
                  </div>
                  <span className="text-sm font-mono font-bold text-destructive">{p.stockQty} left</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}