/**
 * Runtime status for cloud sync + license (not business data; not backed up).
 * Kept separate from firebase code so the UI can render it without loading Firebase.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LicenseCheck } from '@/core/license';

export type SyncState = 'disabled' | 'offline' | 'idle' | 'syncing' | 'error';

interface CloudStatus {
  online: boolean;
  sync: SyncState;
  lastSyncAt?: string;
  pending: number;
  syncError?: string;
  user?: { uid: string; email: string | null };
  license: LicenseCheck | null;
  set: (p: Partial<Omit<CloudStatus, 'set'>>) => void;
}

export const useCloudStatus = create<CloudStatus>()(set => ({
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  sync: 'disabled',
  pending: 0,
  license: null,
  set: p => set(p),
}));

/** Device-local license + cloud preferences (survive restarts, never part of backups). */
interface DeviceConfig {
  licenseToken: string;
  licenseKey: string;
  syncEnabled: boolean;
  trialStartedAt: string;
  /** Per-device invoice series (e.g. W1, A1) so offline devices never issue the same invoice number. */
  invoiceSeries: string;
  /** Last cloud revision pulled per collection (ms). */
  pulledRev: Record<string, number>;
  setConfig: (p: Partial<Omit<DeviceConfig, 'setConfig'>>) => void;
}

export const useDeviceConfig = create<DeviceConfig>()(
  persist(
    set => ({
      licenseToken: '',
      licenseKey: '',
      syncEnabled: false,
      trialStartedAt: new Date().toISOString(),
      invoiceSeries: '',
      pulledRev: {},
      setConfig: p => set(p),
    }),
    { name: 'dt-device-config' },
  ),
);
