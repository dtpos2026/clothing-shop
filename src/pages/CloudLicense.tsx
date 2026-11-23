import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { Cloud, KeyRound, ShieldCheck, ShieldAlert, LogIn, LogOut, RefreshCw, Smartphone, Monitor, Loader2, Info, Copy } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useCloudStatus, useDeviceConfig } from '@/cloud/status';
import { getFirebase, isFirebaseConfigured } from '@/cloud/firebase';
import { activateLicense, checkLicense, deactivateThisDevice, installToken, licenseEnforced, refreshLicense, trialDaysLeft, LICENSE_PUBLIC_KEY } from '@/cloud/licenseService';
import { decodeLicense, isWellFormedLicenseKey } from '@/core/license';
import { getDeviceId, getDeviceName, getPlatform } from '@/platform/device';
import { saveSafetyBackup } from '@/services/backupService';
import { APP_VERSION } from '@/core/defaults';

export default function CloudLicense() {
  const status = useCloudStatus();
  const cfg = useDeviceConfig();
  const businessId = useStore(s => s.businessId);
  const storeName = useStore(s => s.settings.storeName);
  const [busy, setBusy] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [key, setKey] = useState(cfg.licenseKey);
  const [offline, setOffline] = useState('');
  const [link, setLink] = useState<null | { businessId: string; businessName: string }>(null);
  const configured = isFirebaseConfigured();
  const lic = status.license;
  const payload = cfg.licenseToken ? decodeLicense(cfg.licenseToken) : null;

  useEffect(() => {
    if (!configured) return;
    let unsub: (() => void) | undefined;
    getFirebase().then(async ({ auth }) => {
      const { onAuthStateChanged } = await import('firebase/auth');
      unsub = onAuthStateChanged(auth, u => useCloudStatus.getState().set({ user: u ? { uid: u.uid, email: u.email } : undefined }));
    }).catch(() => undefined);
    return () => unsub?.();
  }, [configured]);

  const run = async (k: string, fn: () => Promise<void>) => {
    setBusy(k);
    try { await fn(); } catch (e) {
      const msg = (e as { message?: string }).message || String(e);
      toast.error(msg.replace(/^Firebase: /, ''));
    } finally { setBusy(null); }
  };

  const signIn = (create: boolean) => run('auth', async () => {
    const { auth } = await getFirebase();
    const a = await import('firebase/auth');
    if (create) await a.createUserWithEmailAndPassword(auth, email.trim(), password);
    else await a.signInWithEmailAndPassword(auth, email.trim(), password);
    toast.success('Signed in');
    setPassword('');
  });
  const signOut = () => run('auth', async () => {
    const { auth } = await getFirebase();
    (await import('@/cloud/sync')).stopSync();
    await (await import('firebase/auth')).signOut(auth);
  });
  const resetPw = () => run('auth', async () => {
    const { auth } = await getFirebase();
    await (await import('firebase/auth')).sendPasswordResetEmail(auth, email.trim());
    toast.success('Password reset email sent');
  });

  const afterActivate = (p: { businessId: string; businessName: string }) => {
    if (p.businessId !== useStore.getState().businessId) setLink(p); // device joins the licensed business workspace
    else toast.success('License active on this device');
  };

  const activate = () => run('activate', async () => {
    if (!isWellFormedLicenseKey(key)) throw new Error('License key format looks wrong (DTFP-XXXX-XXXX-XXXX-XXXX).');
    const p = await activateLicense(key);
    afterActivate(p);
  });

  const installOffline = () => run('offline', async () => {
    const p = installToken(offline);
    setOffline('');
    afterActivate(p);
  });

  const joinBusiness = (mode: 'merge' | 'replace') => run('link', async () => {
    if (!link) return;
    await saveSafetyBackup('before-link');
    useStore.setState({ businessId: link.businessId });
    if (link.businessName && mode === 'merge') useStore.getState().updateSettings({ storeName: useStore.getState().settings.storeName || link.businessName });
    setLink(null);
    if (cfg.syncEnabled || mode === 'replace') {
      useDeviceConfig.getState().setConfig({ syncEnabled: true, pulledRev: {} });
      const sync = await import('@/cloud/sync');
      sync.stopSync();
      await sync.startSync({ initialMode: mode });
    }
    toast.success(mode === 'replace' ? 'Downloading business data from the cloud…' : 'Device linked. Local data will be merged into the business workspace.');
  });

  const toggleSync = (on: boolean) => run('sync', async () => {
    const sync = await import('@/cloud/sync');
    if (!on) { sync.stopSync(); useDeviceConfig.getState().setConfig({ syncEnabled: false }); return; }
    if (!status.user) throw new Error('Sign in first.');
    if (!cfg.invoiceSeries) throw new Error('Set a device invoice series first (e.g. W1 for this PC, A1 for a phone) so invoice numbers never clash.');
    useDeviceConfig.getState().setConfig({ syncEnabled: true });
    const hasCloud = await sync.cloudHasData().catch(() => false);
    await sync.startSync({ initialMode: Object.keys(cfg.pulledRev).length ? undefined : hasCloud ? undefined : 'merge' });
    toast.success('Cloud sync on');
  });

  const platformIcon = getPlatform() === 'android' ? <Smartphone className="w-4 h-4" /> : <Monitor className="w-4 h-4" />;

  return (
    <div className="p-4 md:p-6 space-y-4 animate-fade-in max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Cloud className="w-6 h-6" /> Cloud & License</h1>
        <p className="text-sm text-muted-foreground">One business license and one data workspace shared by your Windows PCs and Android phones.</p>
      </div>

      <div className="bg-card rounded-xl border border-border p-4 grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
        <Row l="This device" v={<span className="flex items-center gap-1.5">{platformIcon}{getDeviceName()}</span>} />
        <Row l="Device ID" v={<span className="flex items-center gap-1 font-mono text-xs">{getDeviceId()}<button onClick={() => { navigator.clipboard?.writeText(getDeviceId()); toast.success('Copied'); }}><Copy className="w-3 h-3" /></button></span>} />
        <Row l="Business ID" v={<span className="font-mono text-xs">{businessId}</span>} />
        <Row l="App version" v={APP_VERSION} />
        <Row l="Cloud" v={configured ? 'Configured' : 'Not configured in this build'} />
        <Row l="Connection" v={status.online ? 'Online' : 'Offline – everything keeps working locally'} />
      </div>

      {!configured && (
        <div className="rounded-xl border border-info/40 bg-info/10 p-4 text-sm flex gap-3">
          <Info className="w-5 h-5 text-info flex-shrink-0" />
          <div>This build has no Firebase project configured, so the app runs fully offline (backups, exports and WhatsApp sharing all work). To enable cloud sync and online licensing, build with the <code>VITE_FIREBASE_*</code> settings from <code>docs/FIREBASE_SETUP.md</code>. Offline license tokens can still be installed below.</div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        {/* License */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <h3 className="font-semibold flex items-center gap-2"><KeyRound className="w-4 h-4" />License</h3>
          {!licenseEnforced() ? (
            <p className="text-sm text-muted-foreground">Licensing is not enforced in this build{LICENSE_PUBLIC_KEY ? ' (disabled by configuration)' : ' (no license public key configured)'}.</p>
          ) : (
            <div className={`rounded-lg p-3 text-sm flex gap-2 ${lic?.state === 'valid' ? 'bg-success/10 text-success' : lic?.state === 'grace' ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'}`}>
              {lic?.state === 'valid' ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
              <div>
                {lic?.state === 'valid' && <>Active · {lic.daysLeft} days left</>}
                {lic?.state === 'grace' && <>{lic.reason} ({lic.graceDaysLeft} days left)</>}
                {lic?.state === 'invalid' && <>{lic.reason}{lic.reason === 'No license installed' && trialDaysLeft() > 0 ? ` – trial: ${trialDaysLeft()} day(s) left` : ''}</>}
              </div>
            </div>
          )}
          {payload && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs rounded-lg bg-muted p-3">
              <span className="text-muted-foreground">Business</span><b>{payload.businessName}</b>
              <span className="text-muted-foreground">Key</span><span className="font-mono">{payload.licenseKey}</span>
              <span className="text-muted-foreground">Plan</span><span>{payload.plan}</span>
              <span className="text-muted-foreground">Devices allowed</span><span>{payload.maxDevices} (Windows + Android combined)</span>
              <span className="text-muted-foreground">Expires</span><span>{format(parseISO(payload.expiresAt), 'dd MMM yyyy')}</span>
              <span className="text-muted-foreground">Re-validate by</span><span>{format(parseISO(payload.refreshBy), 'dd MMM yyyy')} (+{payload.offlineGraceDays}d offline grace)</span>
            </div>
          )}
          <div className="flex gap-2">
            <Input placeholder="DTFP-XXXX-XXXX-XXXX-XXXX" value={key} onChange={e => setKey(e.target.value.toUpperCase())} className="font-mono" />
            <Button onClick={activate} disabled={!configured || !status.user || !!busy} title={!status.user ? 'Sign in first' : ''}>{busy === 'activate' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Activate'}</Button>
          </div>
          {configured && !status.user && <p className="text-xs text-muted-foreground">Sign in with the shop owner's account (right) before activating.</p>}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={!configured || !cfg.licenseToken || !!busy} onClick={() => run('refresh', async () => { await refreshLicense(true); toast.success('License re-validated'); })}><RefreshCw className="w-3.5 h-3.5 me-1" />Re-validate now</Button>
            <Button size="sm" variant="outline" disabled={!cfg.licenseToken || !!busy} onClick={() => { if (confirm('Deactivate this device? It frees one device slot on the license.')) void run('deact', async () => { await deactivateThisDevice(); toast.success('Device deactivated'); }); }}>Deactivate this device</Button>
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">Offline activation (no internet at the shop)</summary>
            <div className="space-y-2 mt-2">
              <p className="text-xs text-muted-foreground">Send your Device ID (above) to your provider. Paste the activation token you receive here.</p>
              <Textarea rows={3} value={offline} onChange={e => setOffline(e.target.value)} placeholder="Activation token" className="font-mono text-xs" />
              <Button size="sm" disabled={!offline.trim() || !!busy} onClick={installOffline}>Install token</Button>
            </div>
          </details>
          <Button size="sm" variant="ghost" onClick={() => checkLicense()}>Check again</Button>
        </div>

        {/* Account & sync */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <h3 className="font-semibold flex items-center gap-2"><LogIn className="w-4 h-4" />Account & sync</h3>
          {status.user ? (
            <div className="flex items-center justify-between text-sm rounded-lg bg-muted p-3">
              <span>Signed in as <b>{status.user.email}</b></span>
              <Button size="sm" variant="ghost" onClick={signOut} disabled={!!busy}><LogOut className="w-3.5 h-3.5 me-1" />Sign out</Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Input type="email" placeholder="Owner email" value={email} onChange={e => setEmail(e.target.value)} disabled={!configured} />
              <Input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} disabled={!configured} />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => signIn(false)} disabled={!configured || !email || !password || !!busy}>{busy === 'auth' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign in'}</Button>
                <Button size="sm" variant="outline" onClick={() => signIn(true)} disabled={!configured || !email || password.length < 6 || !!busy}>Create account</Button>
                <Button size="sm" variant="ghost" onClick={resetPw} disabled={!configured || !email || !!busy}>Forgot password</Button>
              </div>
            </div>
          )}

          <div className="space-y-2 pt-2 border-t border-border">
            <div>
              <Label className="text-xs">Device invoice series</Label>
              <div className="flex gap-2 items-center">
                <Input className="w-24 font-mono uppercase" maxLength={4} value={cfg.invoiceSeries} onChange={e => cfg.setConfig({ invoiceSeries: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} placeholder={getPlatform() === 'android' ? 'A1' : 'W1'} />
                <span className="text-xs text-muted-foreground">Next invoice: INV-{cfg.invoiceSeries ? `${cfg.invoiceSeries}-` : ''}{String(useStore.getState().invoiceCounter + 1).padStart(5, '0')}</span>
              </div>
            </div>
            <label className="flex items-center justify-between text-sm">
              <span>Cloud sync on this device</span>
              <Switch checked={cfg.syncEnabled} disabled={!configured || !!busy} onCheckedChange={toggleSync} />
            </label>
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>Status: <b className="capitalize">{status.sync}</b>{status.pending ? ` · ${status.pending} change(s) waiting` : ''}{status.lastSyncAt ? ` · last ${format(parseISO(status.lastSyncAt), 'HH:mm:ss')}` : ''}</p>
              {status.syncError && <p className="text-destructive">{status.syncError}</p>}
              <p>Works offline: sales are saved locally and uploaded automatically when the internet returns.</p>
            </div>
            <Button size="sm" variant="outline" disabled={!cfg.syncEnabled} onClick={() => import('@/cloud/sync').then(m => m.syncNow())}><RefreshCw className="w-3.5 h-3.5 me-1" />Sync now</Button>
          </div>
        </div>
      </div>

      <Dialog open={!!link} onOpenChange={v => !v && setLink(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link this device to “{link?.businessName}”</DialogTitle>
            <DialogDescription>This license belongs to a business workspace. Choose what happens to the data currently on this device ({storeName}). A safety backup is saved first either way.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {configured && status.user && <Button onClick={() => joinBusiness('replace')} disabled={!!busy}>Use the business's cloud data on this device (recommended for a 2nd device)</Button>}
            <Button variant="outline" onClick={() => joinBusiness('merge')} disabled={!!busy}>Keep my data and merge it into the business</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ l, v }: { l: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-3 py-1 border-b border-border/60 last:border-0"><span className="text-muted-foreground">{l}</span><span className="text-end min-w-0 truncate">{v}</span></div>;
}
