/**
 * Background services started once the store is hydrated:
 * connectivity, license checks, cloud sync, stock / backup / license notifications,
 * daily automatic local backup and push registration.
 */
import { useStore } from '@/store/useStore';
import { useCloudStatus, useDeviceConfig } from '@/cloud/status';
import { checkLicense, licenseEnforced, refreshLicense } from '@/cloud/licenseService';
import { isFirebaseConfigured } from '@/cloud/firebase';
import { getNotificationPrefs } from '@/core/defaults';
import { notify, registerPush, scheduleBackupReminder } from '@/platform/notifications';
import { autoBackupIfDue } from './backupService';
import type { Product } from '@/types';

export function startBackgroundServices(): () => void {
  const cleanups: (() => void)[] = [];
  const status = useCloudStatus.getState();

  // --- connectivity
  const setOnline = () => {
    useCloudStatus.getState().set({ online: navigator.onLine });
    if (navigator.onLine) {
      void refreshLicense();
      import('@/cloud/sync').then(m => m.syncNow());
    }
  };
  window.addEventListener('online', setOnline);
  window.addEventListener('offline', setOnline);
  cleanups.push(() => { window.removeEventListener('online', setOnline); window.removeEventListener('offline', setOnline); });
  status.set({ online: navigator.onLine });

  // --- license
  checkLicense();
  void refreshLicense();
  const licTimer = setInterval(() => { checkLicense(); void refreshLicense(); }, 6 * 3600_000);
  cleanups.push(() => clearInterval(licTimer));
  const lic = useCloudStatus.getState().license;
  const prefs = () => getNotificationPrefs(useStore.getState().settings);
  if (licenseEnforced() && prefs().license && lic) {
    if (lic.state === 'valid' && lic.daysLeft <= 7) void notify('License expiring soon', `Your license expires in ${lic.daysLeft} day(s). Contact your provider to renew.`, { key: 'license-exp', dedupeMs: 24 * 3600_000 });
    if (lic.state === 'grace') void notify('License needs internet', `Connect to the internet within ${lic.graceDaysLeft} day(s) to re-validate your license.`, { key: 'license-grace', dedupeMs: 24 * 3600_000 });
  }

  // --- cloud sync (only when configured, signed in and enabled on this device)
  if (isFirebaseConfigured() && useDeviceConfig.getState().syncEnabled) {
    import('@/cloud/firebase').then(async ({ getFirebase }) => {
      const { auth } = await getFirebase();
      const { onAuthStateChanged } = await import('firebase/auth');
      const unsub = onAuthStateChanged(auth, async user => {
        useCloudStatus.getState().set({ user: user ? { uid: user.uid, email: user.email } : undefined });
        const sync = await import('@/cloud/sync');
        if (user && useDeviceConfig.getState().syncEnabled) await sync.startSync();
        else sync.stopSync();
      });
      cleanups.push(unsub);
    }).catch(e => useCloudStatus.getState().set({ sync: 'error', syncError: String(e) }));
  }

  // --- push notifications (FCM) – no-op unless enabled in the build
  void registerPush(token => import('@/cloud/sync').then(m => m.saveDeviceToken(token)), (t, b) => void notify(t, b));

  // --- low / out of stock alerts when stock crosses the threshold
  let prevProducts = useStore.getState().products;
  const unsubStock = useStore.subscribe(s => {
    if (s.products === prevProducts) return;
    const before = new Map(prevProducts.map(p => [p.id, p]));
    prevProducts = s.products;
    const p = prefs();
    for (const prod of s.products) {
      const old = before.get(prod.id) as Product | undefined;
      if (!old || old === prod || !prod.active) continue;
      if (p.outOfStock && old.stockQty > 0 && prod.stockQty <= 0) void notify('Out of stock', `${prod.brand} ${prod.article} is out of stock.`, { key: `out-${prod.id}` });
      else if (p.lowStock && old.stockQty > prod.lowStockThreshold && prod.stockQty <= prod.lowStockThreshold) void notify('Low stock', `${prod.brand} ${prod.article}: only ${prod.stockQty} left.`, { key: `low-${prod.id}` });
    }
  });
  cleanups.push(unsubStock);

  // --- sales event notification (optional, off by default)
  let lastSales = useStore.getState().sales.length;
  const unsubSales = useStore.subscribe(s => {
    if (s.sales.length <= lastSales) { lastSales = s.sales.length; return; }
    const sale = s.sales[s.sales.length - 1];
    lastSales = s.sales.length;
    if (prefs().sales && sale.kind !== 'return' && sale.total >= 50000) void notify('Large sale', `${sale.invoiceNumber}: ${s.settings.currency} ${sale.total.toLocaleString()}`, { key: sale.id });
  });
  cleanups.push(unsubSales);

  // --- sync error notification
  let lastErr: string | undefined;
  const unsubErr = useCloudStatus.subscribe(st => {
    if (st.syncError && st.syncError !== lastErr && st.sync === 'error' && prefs().syncErrors) void notify('Sync problem', st.syncError, { key: 'sync-err', dedupeMs: 3600_000 });
    lastErr = st.syncError;
  });
  cleanups.push(unsubErr);

  // --- backups: daily automatic local copy + reminder
  const runBackup = () => autoBackupIfDue().catch(e => console.warn('auto backup failed', e));
  const t = setTimeout(runBackup, 20_000);
  const daily = setInterval(runBackup, 3 * 3600_000);
  cleanups.push(() => { clearTimeout(t); clearInterval(daily); });
  const st = useStore.getState().settings;
  if (prefs().backupReminder) void scheduleBackupReminder(st.backupReminderDays ?? 7, st.lastBackupAt);

  return () => cleanups.forEach(c => c());
}
