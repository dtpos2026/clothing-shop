/**
 * Local notifications (work offline) + push registration (FCM, optional).
 * Android: @capacitor/local-notifications (asks POST_NOTIFICATIONS on Android 13+ the first
 * time a notification is enabled). Windows/browser: HTML5 Notification API.
 */
import { Capacitor } from '@capacitor/core';
import type { NotificationPrefs } from '@/types';

export type NotifyKind = keyof NotificationPrefs;

const CHANNEL = 'dtpos-alerts';
let channelReady = false;

async function ensureChannel() {
  if (channelReady || !Capacitor.isNativePlatform()) return;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  try {
    await LocalNotifications.createChannel({ id: CHANNEL, name: 'Shop alerts', description: 'Stock, backup, license and sync alerts', importance: 4 });
  } catch { /* already exists */ }
  channelReady = true;
}

export async function notificationPermission(): Promise<'granted' | 'denied' | 'prompt'> {
  if (Capacitor.isNativePlatform()) {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const p = await LocalNotifications.checkPermissions();
    return p.display === 'granted' ? 'granted' : p.display === 'denied' ? 'denied' : 'prompt';
  }
  if (typeof Notification === 'undefined') return 'denied';
  return Notification.permission === 'default' ? 'prompt' : (Notification.permission as 'granted' | 'denied');
}

/** Ask only when the user turns notifications on (never at startup). */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const p = await LocalNotifications.requestPermissions();
    return p.display === 'granted';
  }
  if (typeof Notification === 'undefined') return false;
  return (await Notification.requestPermission()) === 'granted';
}

let nextId = Math.floor(Date.now() / 1000) % 100000;
const recent = new Map<string, number>();

/** Shows a notification unless the same key fired within `dedupeMs`. */
export async function notify(title: string, body: string, opts: { key?: string; dedupeMs?: number; at?: Date } = {}) {
  const key = opts.key || title + body;
  const last = recent.get(key) || 0;
  if (!opts.at && Date.now() - last < (opts.dedupeMs ?? 6 * 3600_000)) return;
  recent.set(key, Date.now());
  if ((await notificationPermission()) !== 'granted') return;
  if (Capacitor.isNativePlatform()) {
    await ensureChannel();
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.schedule({
      notifications: [{ id: ++nextId, title, body, channelId: CHANNEL, schedule: opts.at ? { at: opts.at, allowWhileIdle: true } : undefined }],
    });
    return;
  }
  if (opts.at) {
    const delay = opts.at.getTime() - Date.now();
    if (delay > 0 && delay < 2 ** 31 - 1) setTimeout(() => new Notification(title, { body }), delay);
    return;
  }
  new Notification(title, { body });
}

/** Schedules the next offline backup reminder (replaces any previous one on Android). */
export async function scheduleBackupReminder(days: number, lastBackupAt?: string) {
  if (!days) return;
  const base = lastBackupAt ? Date.parse(lastBackupAt) : Date.now();
  const at = new Date(Math.max(Date.now() + 60_000, base + days * 86_400_000));
  if (Capacitor.isNativePlatform()) {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    try { await LocalNotifications.cancel({ notifications: [{ id: 999001 }] }); } catch { /* none */ }
    if ((await notificationPermission()) !== 'granted') return;
    await ensureChannel();
    await LocalNotifications.schedule({
      notifications: [{ id: 999001, title: 'Backup reminder', body: `It has been ${days} days since your last backup. Open Backup to create one.`, channelId: CHANNEL, schedule: { at, allowWhileIdle: true } }],
    });
  } else {
    await notify('Backup reminder', `Last backup was more than ${days} days ago.`, { key: 'backup', at });
  }
}

/**
 * FCM registration for cloud notifications. Requires google-services.json in the Android
 * project (see docs/FIREBASE_SETUP.md); without it this is a no-op so the app never crashes.
 */
export async function registerPush(onToken: (token: string) => void, onMessage: (title: string, body: string) => void) {
  if (!Capacitor.isNativePlatform() || import.meta.env.VITE_ENABLE_PUSH !== 'true') return;
  const { PushNotifications } = await import('@capacitor/push-notifications');
  const perm = await PushNotifications.checkPermissions();
  if (perm.receive !== 'granted') {
    const r = await PushNotifications.requestPermissions();
    if (r.receive !== 'granted') return;
  }
  await PushNotifications.addListener('registration', t => onToken(t.value));
  await PushNotifications.addListener('pushNotificationReceived', n => onMessage(n.title || 'Notification', n.body || ''));
  await PushNotifications.register();
}
