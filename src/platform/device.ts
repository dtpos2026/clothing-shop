/**
 * Platform detection and a stable per-installation device id.
 * The device id is NOT part of business data: it is never backed up, synced as data,
 * or restored, so a restored backup can't impersonate another registered device.
 */
import { Capacitor } from '@capacitor/core';

export type Platform = 'windows' | 'android' | 'web';

export const isElectron = () => typeof window !== 'undefined' && !!window.electronAPI;
export const isNative = () => Capacitor.isNativePlatform();
export const isAndroid = () => Capacitor.getPlatform() === 'android';

export function getPlatform(): Platform {
  if (isAndroid()) return 'android';
  if (isElectron()) return 'windows';
  return 'web';
}

const KEY = 'dt-device-id';
let cached: string | null = null;

export function getDeviceId(): string {
  if (cached) return cached;
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = `${getPlatform().slice(0, 3)}-${crypto.randomUUID()}`;
      localStorage.setItem(KEY, id);
    }
    cached = id;
  } catch {
    cached = `tmp-${crypto.randomUUID()}`;
  }
  return cached;
}

export function getDeviceName(): string {
  const p = getPlatform();
  if (typeof navigator === 'undefined') return p;
  const ua = navigator.userAgent;
  if (p === 'android') {
    const m = ua.match(/Android [\d.]+; ([^;)]+)/);
    return `Android – ${m ? m[1].trim() : 'device'}`;
  }
  if (p === 'windows') return `Windows PC – ${window.electronAPI?.hostname || 'desktop'}`;
  return `Browser – ${navigator.platform || 'web'}`;
}
