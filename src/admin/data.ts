/** Data access for the Super Admin panel. Reads via Firestore (rules: superAdmin claim), writes via Cloud Functions. */
import { callFunction, getFirebase } from '@/cloud/firebase';

export interface Business { id: string; name: string; status: string; ownerEmail?: string; phone?: string; city?: string; createdAt?: Date }
export interface License { id: string; businessId: string; businessName: string; plan: string; status: string; maxDevices: number; expiresAt: Date; offlineGraceDays: number; refreshDays: number; ownerEmail?: string; notes?: string; createdAt?: Date }
export interface Device { id: string; licenseKey: string; platform: string; deviceName: string; appVersion?: string; status: string; activatedAt?: Date; lastSeenAt?: Date; offline?: boolean }
export interface LogRow { id: string; [k: string]: unknown; at?: Date }

const toDate = (v: unknown) => (v && typeof (v as { toDate?: () => Date }).toDate === 'function' ? (v as { toDate: () => Date }).toDate() : undefined);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const norm = (id: string, d: any) => { const o: any = { id, ...d }; for (const k of Object.keys(o)) { const t = toDate(o[k]); if (t) o[k] = t; } return o; };

export async function listAll<T>(path: string, orderField?: string, max = 500): Promise<T[]> {
  const { db } = await getFirebase();
  const { collection, getDocs, query, orderBy, limit } = await import('firebase/firestore');
  const q = orderField ? query(collection(db, path), orderBy(orderField, 'desc'), limit(max)) : query(collection(db, path), limit(max));
  const s = await getDocs(q);
  return s.docs.map(d => norm(d.id, d.data()) as T);
}

export async function listDevices(licenseKeys: string[]): Promise<Device[]> {
  const out: Device[] = [];
  for (const k of licenseKeys) {
    const rows = await listAll<Device>(`licenses/${k}/devices`);
    out.push(...rows.map(r => ({ ...r, licenseKey: k })));
  }
  return out;
}

export async function getAppVersions() {
  const { db } = await getFirebase();
  const { doc, getDoc } = await import('firebase/firestore');
  const [w, a] = await Promise.all([getDoc(doc(db, 'appVersions', 'windows')), getDoc(doc(db, 'appVersions', 'android'))]);
  return { windows: w.data() || {}, android: a.data() || {} } as Record<'windows' | 'android', Record<string, string>>;
}

export const admin = {
  createBusiness: (d: { name: string; ownerEmail?: string; phone?: string; city?: string }) => callFunction<typeof d, { businessId: string }>('adminCreateBusiness', d),
  issueLicense: (d: { businessId: string; days: number; maxDevices: number; plan: string; offlineGraceDays: number; refreshDays: number; notes?: string }) => callFunction<typeof d, { licenseKey: string }>('adminIssueLicense', d),
  updateLicense: (d: { licenseKey: string; action: 'suspend' | 'activate' | 'renew' | 'setMaxDevices' | 'setGrace'; days?: number; maxDevices?: number; offlineGraceDays?: number }) => callFunction('adminUpdateLicense', d),
  revokeDevice: (d: { licenseKey: string; deviceId: string; restore?: boolean }) => callFunction('adminRevokeDevice', d),
  offlineToken: (d: { licenseKey: string; deviceId: string; platform?: string }) => callFunction<typeof d, { token: string }>('adminOfflineToken', d),
  setAppVersion: (d: { platform: 'windows' | 'android'; latestVersion: string; minVersion: string; downloadUrl: string; notes: string }) => callFunction('adminSetAppVersion', d),
  setUserRole: (d: { email: string; superAdmin: boolean; disabled?: boolean }) => callFunction('adminSetUserRole', d),
  sendNotification: (d: { title: string; body: string; businessId?: string }) => callFunction<typeof d, { delivered: number; businesses: number }>('adminSendNotification', d),
};
