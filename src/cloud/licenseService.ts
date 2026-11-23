/**
 * Device-side license handling: activation, periodic re-validation, offline grace,
 * offline activation token install, device deactivation.
 */
import { verifyLicense, type LicenseCheck, type LicensePayload } from '@/core/license';
import { getDeviceId, getDeviceName, getPlatform } from '@/platform/device';
import { APP_VERSION } from '@/core/defaults';
import { callFunction, isFirebaseConfigured } from './firebase';
import { useCloudStatus, useDeviceConfig } from './status';

export const LICENSE_PUBLIC_KEY = (import.meta.env.VITE_LICENSE_PUBLIC_KEY as string | undefined)?.trim() || '';
/** Enforcement needs a public key; can be disabled explicitly for internal builds. */
export const licenseEnforced = () => !!LICENSE_PUBLIC_KEY && import.meta.env.VITE_LICENSE_ENFORCED !== 'false';
export const TRIAL_DAYS = Number(import.meta.env.VITE_TRIAL_DAYS || 14);

export function trialDaysLeft(): number {
  const start = Date.parse(useDeviceConfig.getState().trialStartedAt);
  return Math.max(0, Math.ceil((start + TRIAL_DAYS * 86_400_000 - Date.now()) / 86_400_000));
}

export function checkLicense(): LicenseCheck | null {
  if (!licenseEnforced()) { useCloudStatus.getState().set({ license: null }); return null; }
  const token = useDeviceConfig.getState().licenseToken;
  const r = verifyLicense(token, LICENSE_PUBLIC_KEY, getDeviceId());
  useCloudStatus.getState().set({ license: r });
  return r;
}

export interface ActivateResponse { token: string; businessId: string; businessName: string }

export async function activateLicense(licenseKey: string): Promise<LicensePayload> {
  const res = await callFunction<Record<string, string>, ActivateResponse>('activateDevice', {
    licenseKey: licenseKey.trim().toUpperCase(), deviceId: getDeviceId(), platform: getPlatform(),
    deviceName: getDeviceName(), appVersion: APP_VERSION,
  });
  return installToken(res.token, licenseKey);
}

export function installToken(token: string, licenseKey?: string): LicensePayload {
  const r = verifyLicense(token, LICENSE_PUBLIC_KEY, getDeviceId());
  if (r.state === 'invalid') throw new Error(r.reason);
  useDeviceConfig.getState().setConfig({ licenseToken: token.trim(), licenseKey: licenseKey || r.payload.licenseKey });
  checkLicense();
  return r.payload;
}

/** Re-validate online (picks up renewals, suspensions, revocations). Silent when offline. */
export async function refreshLicense(force = false): Promise<void> {
  if (!licenseEnforced() || !isFirebaseConfigured() || !navigator.onLine) return;
  const cfg = useDeviceConfig.getState();
  if (!cfg.licenseToken) return;
  const current = checkLicense();
  if (!force && current?.state === 'valid' && !current.needsRefresh) return;
  try {
    const res = await callFunction<Record<string, string>, ActivateResponse>('refreshLicense', { deviceId: getDeviceId(), licenseKey: cfg.licenseKey, appVersion: APP_VERSION });
    useDeviceConfig.getState().setConfig({ licenseToken: res.token });
  } catch (e) {
    const code = (e as { code?: string }).code || '';
    // server says this device/license is no longer allowed → drop token immediately
    if (/permission-denied|not-found|failed-precondition/.test(code)) useDeviceConfig.getState().setConfig({ licenseToken: '' });
  }
  checkLicense();
}

export async function deactivateThisDevice(): Promise<void> {
  const cfg = useDeviceConfig.getState();
  if (isFirebaseConfigured() && cfg.licenseKey) {
    await callFunction('deactivateDevice', { licenseKey: cfg.licenseKey, deviceId: getDeviceId() });
  }
  useDeviceConfig.getState().setConfig({ licenseToken: '' });
  checkLicense();
}
