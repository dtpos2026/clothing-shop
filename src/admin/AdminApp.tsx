import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Shield, Building2, KeyRound, MonitorSmartphone, History, Package, Users, Bell, ScrollText, LayoutDashboard, LogOut, RefreshCw, Copy, Loader2, Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getFirebase, isFirebaseConfigured, firebaseConfig } from '@/cloud/firebase';
import { admin, getAppVersions, listAll, listDevices, type Business, type Device, type License, type LogRow } from './data';
import { cn } from '@/lib/utils';

type Tab = 'dashboard' | 'businesses' | 'licenses' | 'devices' | 'activations' | 'versions' | 'users' | 'notifications' | 'logs';
const TABS: { id: Tab; label: string; icon: typeof Shield }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }, { id: 'businesses', label: 'Businesses', icon: Building2 },
  { id: 'licenses', label: 'Licenses', icon: KeyRound }, { id: 'devices', label: 'Devices', icon: MonitorSmartphone },
  { id: 'activations', label: 'Activation history', icon: History }, { id: 'versions', label: 'App versions', icon: Package },
  { id: 'users', label: 'Users & roles', icon: Users }, { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'logs', label: 'Audit & system logs', icon: ScrollText },
];
const fmt = (d?: Date) => (d ? format(d, 'dd MMM yyyy HH:mm') : '-');
const daysLeft = (d: Date) => Math.ceil((d.getTime() - Date.now()) / 86_400_000);

function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const reload = useCallback(async () => {
    setLoading(true);
    try { setData(await fn()); } catch (e) { toast.error(String((e as Error).message || e)); } finally { setLoading(false); }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void reload(); }, [reload]);
  return { data, loading, reload };
}

const act = async (fn: () => Promise<unknown>, ok: string, after?: () => void) => {
  try { await fn(); toast.success(ok); after?.(); } catch (e) { toast.error(String((e as Error).message || e)); }
};

export default function AdminApp() {
  const [user, setUser] = useState<{ email: string | null; superAdmin: boolean } | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>('dashboard');

  useEffect(() => {
    if (!isFirebaseConfigured()) { setUser(null); return; }
    let unsub: (() => void) | undefined;
    getFirebase().then(async ({ auth }) => {
      const { onIdTokenChanged } = await import('firebase/auth');
      unsub = onIdTokenChanged(auth, async u => {
        if (!u) { setUser(null); return; }
        const t = await u.getIdTokenResult();
        setUser({ email: u.email, superAdmin: t.claims.superAdmin === true });
      });
    });
    return () => unsub?.();
  }, []);

  if (!isFirebaseConfigured()) return <Center><Shield className="w-10 h-10 mx-auto text-destructive" /><p>Firebase is not configured for this admin build. Set the VITE_FIREBASE_* variables (docs/FIREBASE_SETUP.md).</p></Center>;
  if (user === undefined) return <Center><Loader2 className="w-6 h-6 animate-spin mx-auto" /></Center>;
  if (!user) return <SignIn />;
  if (!user.superAdmin) return <Center><Shield className="w-10 h-10 mx-auto text-destructive" /><p><b>{user.email}</b> is not a Super Admin. Shop users cannot access this panel.</p><Button variant="outline" onClick={signOut}>Sign out</Button></Center>;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      <aside className="md:w-60 flex-shrink-0 text-white" style={{ background: 'hsl(var(--sidebar-bg))' }}>
        <div className="p-4 border-b border-white/10"><p className="font-extrabold flex items-center gap-2"><Shield className="w-5 h-5" />Super Admin</p><p className="text-[11px] opacity-60">{firebaseConfig.projectId}</p></div>
        <nav className="p-2 flex md:block overflow-x-auto gap-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={cn('flex items-center gap-2 px-3 py-2 rounded-lg text-sm w-full whitespace-nowrap', tab === t.id ? 'bg-white/15 font-bold' : 'opacity-75 hover:bg-white/10')}><t.icon className="w-4 h-4" />{t.label}</button>
          ))}
        </nav>
        <div className="p-3 text-xs opacity-70 hidden md:block">{user.email}<button className="ms-2 underline" onClick={signOut}>sign out</button></div>
      </aside>
      <main className="flex-1 p-4 md:p-6 min-w-0">
        {tab === 'dashboard' && <DashboardTab />}
        {tab === 'businesses' && <BusinessesTab />}
        {tab === 'licenses' && <LicensesTab />}
        {tab === 'devices' && <DevicesTab />}
        {tab === 'activations' && <LogTab path="activations" title="Activation history" cols={['type', 'licenseKey', 'deviceId', 'platform', 'businessId']} />}
        {tab === 'versions' && <VersionsTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'notifications' && <NotificationsTab />}
        {tab === 'logs' && <><LogTab path="auditLogs" title="Audit log" cols={['action', 'actor', 'licenseKey', 'businessId', 'deviceId']} /><div className="h-6" /><LogTab path="systemLogs" title="System / Firebase jobs" cols={['job', 'checked', 'expired', 'warned']} /></>}
      </main>
    </div>
  );
}

async function signOut() {
  const { auth } = await getFirebase();
  await (await import('firebase/auth')).signOut(auth);
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center p-6"><div className="max-w-sm text-center space-y-3 bg-card border border-border rounded-2xl p-6">{children}</div></div>;
}

function SignIn() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Center>
      <Shield className="w-10 h-10 mx-auto text-primary" />
      <h1 className="text-xl font-bold">Digital Target Super Admin</h1>
      <form className="space-y-2 text-start" onSubmit={async e => {
        e.preventDefault(); setBusy(true);
        try { const { auth } = await getFirebase(); await (await import('firebase/auth')).signInWithEmailAndPassword(auth, email, pw); }
        catch (err) { toast.error(String((err as Error).message).replace('Firebase: ', '')); } finally { setBusy(false); }
      }}>
        <Input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" />
        <Input type="password" placeholder="Password" value={pw} onChange={e => setPw(e.target.value)} autoComplete="current-password" />
        <Button className="w-full" disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign in'}</Button>
      </form>
    </Center>
  );
}

function Header({ title, onReload, loading, children }: { title: string; onReload?: () => void; loading?: boolean; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
      <h1 className="text-2xl font-bold">{title}</h1>
      <div className="flex gap-2">{children}{onReload && <Button variant="outline" size="sm" onClick={onReload}>{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}</Button>}</div>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted"><tr>{head.map(h => <th key={h} className="p-2.5 text-start font-semibold whitespace-nowrap">{h}</th>)}</tr></thead>
        <tbody>{rows.length ? rows.map((r, i) => <tr key={i} className="border-t border-border align-top">{r.map((c, j) => <td key={j} className="p-2.5">{c}</td>)}</tr>) : <tr><td colSpan={head.length} className="p-6 text-center text-muted-foreground">Nothing yet</td></tr>}</tbody>
      </table>
    </div>
  );
}

const Badge = ({ s }: { s: string }) => (
  <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold capitalize', s === 'active' ? 'bg-success/15 text-success' : s === 'suspended' || s === 'revoked' || s === 'expired' ? 'bg-destructive/15 text-destructive' : 'bg-muted text-muted-foreground')}>{s}</span>
);

function DashboardTab() {
  const { data, loading, reload } = useAsync(async () => {
    const [biz, lic] = await Promise.all([listAll<Business>('businesses'), listAll<License>('licenses')]);
    const devices = await listDevices(lic.map(l => l.id));
    return { biz, lic, devices };
  }, []);
  const stats = useMemo(() => {
    if (!data) return null;
    const active = data.lic.filter(l => l.status === 'active');
    return {
      businesses: data.biz.length, activeLic: active.length, expiring: active.filter(l => daysLeft(l.expiresAt) <= 14).length,
      suspended: data.lic.filter(l => l.status !== 'active').length,
      windows: data.devices.filter(d => d.platform === 'windows' && d.status === 'active').length,
      android: data.devices.filter(d => d.platform === 'android' && d.status === 'active').length,
    };
  }, [data]);
  return (
    <>
      <Header title="Dashboard" onReload={reload} loading={loading} />
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
          {([['Businesses', stats.businesses], ['Active licenses', stats.activeLic], ['Expiring ≤14d', stats.expiring], ['Suspended / expired', stats.suspended], ['Windows devices', stats.windows], ['Android devices', stats.android]] as const).map(([l, v]) => (
            <div key={l} className="bg-card border border-border rounded-xl p-4"><p className="text-xs text-muted-foreground">{l}</p><p className="text-2xl font-extrabold">{v}</p></div>
          ))}
        </div>
      )}
      {data && <><h2 className="font-semibold mb-2 flex items-center gap-2"><Activity className="w-4 h-4" />Licenses expiring soon</h2>
        <Table head={['Business', 'Key', 'Expires', 'Days left']} rows={data.lic.filter(l => l.status === 'active').sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime()).slice(0, 15).map(l => [l.businessName, <code key="k">{l.id}</code>, fmt(l.expiresAt), daysLeft(l.expiresAt)])} /></>}
    </>
  );
}

function BusinessesTab() {
  const { data, loading, reload } = useAsync(() => listAll<Business>('businesses', 'createdAt'), []);
  const [form, setForm] = useState<{ name: string; ownerEmail: string; phone: string; city: string } | null>(null);
  const [issue, setIssue] = useState<Business | null>(null);
  return (
    <>
      <Header title="Businesses" onReload={reload} loading={loading}><Button size="sm" onClick={() => setForm({ name: '', ownerEmail: '', phone: '', city: '' })}>New business</Button></Header>
      <Table head={['Business', 'Owner email', 'Phone / city', 'Status', 'Created', '']} rows={(data || []).map(b => [
        <div key="n"><b>{b.name}</b><div className="text-xs font-mono text-muted-foreground">{b.id}</div></div>, b.ownerEmail || '-', `${b.phone || ''} ${b.city || ''}`, <Badge key="s" s={b.status} />, fmt(b.createdAt),
        <Button key="a" size="sm" variant="outline" onClick={() => setIssue(b)}>Issue license</Button>,
      ])} />
      <Dialog open={!!form} onOpenChange={v => !v && setForm(null)}>
        <DialogContent><DialogHeader><DialogTitle>New business</DialogTitle></DialogHeader>
          {form && <div className="space-y-2">
            <Input placeholder="Business name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <Input placeholder="Owner email (must match the shop's sign-in)" value={form.ownerEmail} onChange={e => setForm({ ...form, ownerEmail: e.target.value })} />
            <Input placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            <Input placeholder="City" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
            <Button className="w-full" disabled={!form.name} onClick={() => act(() => admin.createBusiness(form), 'Business created', () => { setForm(null); void reload(); })}>Create</Button>
          </div>}
        </DialogContent>
      </Dialog>
      <IssueDialog business={issue} onClose={() => setIssue(null)} />
    </>
  );
}

function IssueDialog({ business, onClose }: { business: Business | null; onClose: () => void }) {
  const [f, setF] = useState({ days: 365, maxDevices: 2, plan: 'standard', offlineGraceDays: 7, refreshDays: 7, notes: '' });
  const [key, setKey] = useState('');
  return (
    <Dialog open={!!business} onOpenChange={v => { if (!v) { onClose(); setKey(''); } }}>
      <DialogContent><DialogHeader><DialogTitle>Issue license – {business?.name}</DialogTitle></DialogHeader>
        {key ? (
          <div className="space-y-3 text-center"><p>License key (works on Windows and Android):</p><code className="text-lg font-bold">{key}</code>
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(key); toast.success('Copied'); }}><Copy className="w-4 h-4 me-1" />Copy</Button></div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Validity (days)</Label><Input type="number" value={f.days} onChange={e => setF({ ...f, days: +e.target.value })} /></div>
            <div><Label>Max devices (Win + Android)</Label><Input type="number" value={f.maxDevices} onChange={e => setF({ ...f, maxDevices: +e.target.value })} /></div>
            <div><Label>Plan</Label><Input value={f.plan} onChange={e => setF({ ...f, plan: e.target.value })} /></div>
            <div><Label>Offline grace (days)</Label><Input type="number" value={f.offlineGraceDays} onChange={e => setF({ ...f, offlineGraceDays: +e.target.value })} /></div>
            <div><Label>Re-validate every (days)</Label><Input type="number" value={f.refreshDays} onChange={e => setF({ ...f, refreshDays: +e.target.value })} /></div>
            <div><Label>Notes</Label><Input value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} /></div>
            <Button className="col-span-2" onClick={() => business && act(async () => setKey((await admin.issueLicense({ businessId: business.id, ...f })).licenseKey), 'License issued')}>Issue</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LicensesTab() {
  const { data, loading, reload } = useAsync(() => listAll<License>('licenses', 'createdAt'), []);
  const [offline, setOffline] = useState<License | null>(null);
  const [devId, setDevId] = useState('');
  const [token, setToken] = useState('');
  return (
    <>
      <Header title="Licenses" onReload={reload} loading={loading} />
      <Table head={['Key', 'Business', 'Plan', 'Devices', 'Expires', 'Status', 'Actions']} rows={(data || []).map(l => [
        <code key="k" className="text-xs">{l.id}</code>, l.businessName, l.plan, l.maxDevices, <span key="e">{fmt(l.expiresAt)}<div className="text-xs text-muted-foreground">{daysLeft(l.expiresAt)} days</div></span>, <Badge key="s" s={l.status} />,
        <div key="a" className="flex flex-wrap gap-1">
          {l.status === 'active'
            ? <Button size="sm" variant="outline" onClick={() => confirm(`Suspend ${l.businessName}? Their devices lock at next check and cloud writes stop.`) && act(() => admin.updateLicense({ licenseKey: l.id, action: 'suspend' }), 'Suspended', reload)}>Suspend</Button>
            : <Button size="sm" variant="outline" onClick={() => act(() => admin.updateLicense({ licenseKey: l.id, action: 'activate' }), 'Activated', reload)}>Activate</Button>}
          <Button size="sm" variant="outline" onClick={() => { const d = Number(prompt('Renew for how many days?', '365')); if (d > 0) void act(() => admin.updateLicense({ licenseKey: l.id, action: 'renew', days: d }), 'Renewed', reload); }}>Renew</Button>
          <Button size="sm" variant="outline" onClick={() => { const n = Number(prompt('Max devices', String(l.maxDevices))); if (n > 0) void act(() => admin.updateLicense({ licenseKey: l.id, action: 'setMaxDevices', maxDevices: n }), 'Updated', reload); }}>Devices</Button>
          <Button size="sm" variant="outline" onClick={() => { setOffline(l); setToken(''); setDevId(''); }}>Offline token</Button>
        </div>,
      ])} />
      <Dialog open={!!offline} onOpenChange={v => !v && setOffline(null)}>
        <DialogContent><DialogHeader><DialogTitle>Offline activation – {offline?.businessName}</DialogTitle></DialogHeader>
          <Input placeholder="Device ID sent by the shop (e.g. win-… / and-…)" value={devId} onChange={e => setDevId(e.target.value.trim())} />
          <Button disabled={!devId} onClick={() => offline && act(async () => setToken((await admin.offlineToken({ licenseKey: offline.id, deviceId: devId })).token), 'Token created')}>Generate token</Button>
          {token && <><Textarea readOnly rows={5} value={token} className="font-mono text-xs" /><Button variant="outline" onClick={() => { navigator.clipboard.writeText(token); toast.success('Copied'); }}>Copy token</Button></>}
        </DialogContent>
      </Dialog>
    </>
  );
}

function DevicesTab() {
  const { data, loading, reload } = useAsync(async () => {
    const lic = await listAll<License>('licenses');
    const devs = await listDevices(lic.map(l => l.id));
    return devs.map(d => ({ ...d, business: lic.find(l => l.id === d.licenseKey)?.businessName || '' }));
  }, []);
  return (
    <>
      <Header title="Devices" onReload={reload} loading={loading} />
      <Table head={['Device', 'Platform', 'Business', 'Version', 'Activated', 'Last seen', 'Status', '']} rows={(data || []).map((d: Device & { business: string }) => [
        <div key="d">{d.deviceName}<div className="text-[11px] font-mono text-muted-foreground">{d.id}</div></div>, <span key="p" className="capitalize">{d.platform}{d.offline ? ' (offline)' : ''}</span>, d.business, d.appVersion || '-', fmt(d.activatedAt), fmt(d.lastSeenAt), <Badge key="s" s={d.status} />,
        d.status === 'revoked'
          ? <Button key="a" size="sm" variant="outline" onClick={() => act(() => admin.revokeDevice({ licenseKey: d.licenseKey, deviceId: d.id, restore: true }), 'Restored', reload)}>Restore</Button>
          : <Button key="a" size="sm" variant="outline" className="text-destructive" onClick={() => confirm('Revoke this device? It locks at its next license check and frees a slot.') && act(() => admin.revokeDevice({ licenseKey: d.licenseKey, deviceId: d.id }), 'Revoked', reload)}>Revoke</Button>,
      ])} />
    </>
  );
}

function VersionsTab() {
  const { data, reload } = useAsync(getAppVersions, []);
  return (
    <>
      <Header title="Windows & Android versions" onReload={reload} />
      <div className="grid lg:grid-cols-2 gap-4">{(['windows', 'android'] as const).map(p => <VersionForm key={p + JSON.stringify(data?.[p] || {})} platform={p} initial={data?.[p] || {}} />)}</div>
    </>
  );
}
function VersionForm({ platform, initial }: { platform: 'windows' | 'android'; initial: Record<string, string> }) {
  const [f, setF] = useState({ latestVersion: initial.latestVersion || '', minVersion: initial.minVersion || '', downloadUrl: initial.downloadUrl || '', notes: initial.notes || '' });
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-2">
      <h3 className="font-semibold capitalize">{platform}</h3>
      <div className="grid grid-cols-2 gap-2">
        <div><Label>Latest version</Label><Input value={f.latestVersion} onChange={e => setF({ ...f, latestVersion: e.target.value })} placeholder="3.0.0" /></div>
        <div><Label>Minimum supported</Label><Input value={f.minVersion} onChange={e => setF({ ...f, minVersion: e.target.value })} /></div>
      </div>
      <div><Label>Download URL (https)</Label><Input value={f.downloadUrl} onChange={e => setF({ ...f, downloadUrl: e.target.value })} /></div>
      <div><Label>Release notes</Label><Textarea rows={3} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} /></div>
      <Button onClick={() => act(() => admin.setAppVersion({ platform, ...f }), 'Saved')}>Save</Button>
    </div>
  );
}

function UsersTab() {
  const [email, setEmail] = useState('');
  const { data, loading, reload } = useAsync(async () => {
    const biz = await listAll<Business>('businesses');
    const rows: { business: string; uid: string; email?: string; role?: string }[] = [];
    for (const b of biz) (await listAll<LogRow>(`businesses/${b.id}/members`)).forEach(m => rows.push({ business: b.name, uid: m.id, email: m.email as string, role: m.role as string }));
    return rows;
  }, []);
  return (
    <>
      <Header title="Users & roles" onReload={reload} loading={loading} />
      <div className="bg-card border border-border rounded-xl p-4 mb-4 flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[220px]"><Label>User email</Label><Input value={email} onChange={e => setEmail(e.target.value)} /></div>
        <Button onClick={() => act(() => admin.setUserRole({ email, superAdmin: true }), 'Granted super admin')}>Make super admin</Button>
        <Button variant="outline" onClick={() => act(() => admin.setUserRole({ email, superAdmin: false }), 'Super admin removed')}>Remove super admin</Button>
        <Button variant="outline" className="text-destructive" onClick={() => act(() => admin.setUserRole({ email, superAdmin: false, disabled: true }), 'Account disabled')}>Disable account</Button>
      </div>
      <p className="text-xs text-muted-foreground mb-2">Shop users (members of a business) never have access to this panel; super admin is a separate server-side claim.</p>
      <Table head={['Business', 'Email', 'Role', 'UID']} rows={(data || []).map(r => [r.business, r.email || '-', r.role || '-', <code key="u" className="text-xs">{r.uid}</code>])} />
    </>
  );
}

function NotificationsTab() {
  const { data, reload } = useAsync(() => listAll<LogRow>('notifications', 'at', 100), []);
  const biz = useAsync(() => listAll<Business>('businesses'), []);
  const [f, setF] = useState({ title: '', body: '', businessId: '' });
  return (
    <>
      <Header title="Push notifications" onReload={reload} />
      <div className="bg-card border border-border rounded-xl p-4 space-y-2 mb-4 max-w-xl">
        <select className="w-full h-10 rounded-md border border-input bg-background px-2 text-sm" value={f.businessId} onChange={e => setF({ ...f, businessId: e.target.value })}>
          <option value="">All active businesses</option>{(biz.data || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <Input placeholder="Title" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
        <Textarea placeholder="Message" value={f.body} onChange={e => setF({ ...f, body: e.target.value })} />
        <Button disabled={!f.title || !f.body} onClick={() => act(async () => { const r = await admin.sendNotification({ ...f, businessId: f.businessId || undefined }); toast.message(`Delivered to ${r.delivered} device(s) in ${r.businesses} business(es)`); }, 'Sent', reload)}>Send</Button>
      </div>
      <Table head={['When', 'Target', 'Title', 'Delivered']} rows={(data || []).map(n => [fmt(n.at), String(n.businessId), String(n.title), String(n.delivered)])} />
    </>
  );
}

function LogTab({ path, title, cols }: { path: string; title: string; cols: string[] }) {
  const { data, loading, reload } = useAsync(() => listAll<LogRow>(path, 'at', 300), [path]);
  return (
    <>
      <Header title={title} onReload={reload} loading={loading} />
      <Table head={['When', ...cols]} rows={(data || []).map(r => [fmt(r.at), ...cols.map(c => <span key={c} className="text-xs font-mono">{r[c] === undefined ? '' : String(r[c])}</span>)])} />
    </>
  );
}
