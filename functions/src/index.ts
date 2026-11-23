/**
 * Cloud Functions – the only trusted code that touches licenses.
 *
 * Shop devices:   activateDevice, refreshLicense, deactivateDevice
 * Super admin:    adminCreateBusiness, adminIssueLicense, adminUpdateLicense, adminRevokeDevice,
 *                 adminOfflineToken, adminSetAppVersion, adminSendNotification, adminSetUserRole
 * Scheduled:      dailyLicenseMaintenance (expire licenses, warn before expiry via FCM)
 *
 * Firestore layout (written only here, read by admin panel):
 *   licenses/{KEY} {businessId,businessName,plan,status,maxDevices,expiresAt,offlineGraceDays,refreshDays,ownerEmail}
 *   licenses/{KEY}/devices/{deviceId} {platform,deviceName,appVersion,status,activatedAt,lastSeenAt,uid}
 *   businesses/{bid} {name,status,ownerEmail,createdAt}   businesses/{bid}/members/{uid} {role,email}
 *   activations/{id}  auditLogs/{id}  systemLogs/{id}  appVersions/{windows|android}  notifications/{id}
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { setGlobalOptions } from 'firebase-functions/v2';
import { CallableRequest, HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { formatLicenseKey, generateLicenseKey, isWellFormedLicenseKey, signLicense, type LicensePayload, type LicenseStatus } from './license';

initializeApp();
setGlobalOptions({ region: process.env.FUNCTIONS_REGION || 'asia-south1', maxInstances: 20 });
const db = getFirestore();
const LICENSE_PRIVATE_KEY = defineSecret('LICENSE_PRIVATE_KEY');
const DAY = 86_400_000;

type Platform = 'windows' | 'android' | 'web';
interface LicenseDoc {
  businessId: string; businessName: string; plan: string; status: LicenseStatus; maxDevices: number;
  expiresAt: Timestamp; offlineGraceDays: number; refreshDays: number; ownerEmail?: string; features?: string[];
  createdAt?: Timestamp; notes?: string;
}

// ---------------------------------------------------------------- helpers
const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const keyId = (k: unknown) => {
  const s = str(k, 40);
  if (!isWellFormedLicenseKey(s)) throw new HttpsError('invalid-argument', 'License key is not valid.');
  return formatLicenseKey(s);
};
const platformOf = (p: unknown): Platform => (p === 'android' || p === 'windows' ? p : 'web');

function requireAuth(req: CallableRequest) {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  return req.auth;
}
function requireSuperAdmin(req: CallableRequest) {
  const a = requireAuth(req);
  if (a.token.superAdmin !== true) throw new HttpsError('permission-denied', 'Super admin only.');
  return a;
}

async function audit(action: string, actor: string, data: Record<string, unknown>) {
  await db.collection('auditLogs').add({ action, actor, ...data, at: FieldValue.serverTimestamp() });
}

function effectiveStatus(lic: LicenseDoc): LicenseStatus {
  if (lic.status === 'active' && lic.expiresAt.toMillis() <= Date.now()) return 'expired';
  return lic.status;
}

function buildToken(key: string, lic: LicenseDoc, deviceId: string, platform: Platform, deviceStatus: string): string {
  const now = Date.now();
  const status: LicenseStatus = deviceStatus === 'revoked' ? 'revoked' : effectiveStatus(lic);
  const payload: LicensePayload = {
    v: 1, licenseKey: key, businessId: lic.businessId, businessName: lic.businessName, plan: lic.plan, status,
    maxDevices: lic.maxDevices, issuedAt: new Date(now).toISOString(), expiresAt: lic.expiresAt.toDate().toISOString(),
    refreshBy: new Date(Math.min(now + (lic.refreshDays || 7) * DAY, lic.expiresAt.toMillis())).toISOString(),
    offlineGraceDays: lic.offlineGraceDays ?? 7, deviceId, platform, features: lic.features || [],
  };
  return signLicense(payload, LICENSE_PRIVATE_KEY.value());
}

async function ensureMembership(uid: string, email: string | undefined, bid: string) {
  await db.doc(`businesses/${bid}/members/${uid}`).set({ role: 'owner', email: email || null, joinedAt: FieldValue.serverTimestamp() }, { merge: true });
  const user = await getAuth().getUser(uid);
  if (user.customClaims?.bid !== bid) await getAuth().setCustomUserClaims(uid, { ...(user.customClaims || {}), bid });
}

// ---------------------------------------------------------------- device functions
export const activateDevice = onCall({ secrets: [LICENSE_PRIVATE_KEY] }, async req => {
  const auth = requireAuth(req);
  const key = keyId(req.data?.licenseKey);
  const deviceId = str(req.data?.deviceId, 80);
  const platform = platformOf(req.data?.platform);
  if (!deviceId) throw new HttpsError('invalid-argument', 'deviceId missing');

  const result = await db.runTransaction(async tx => {
    const licRef = db.doc(`licenses/${key}`);
    const snap = await tx.get(licRef);
    if (!snap.exists) throw new HttpsError('not-found', 'License key not found.');
    const lic = snap.data() as LicenseDoc;
    const status = effectiveStatus(lic);
    if (status !== 'active') throw new HttpsError('failed-precondition', `License is ${status}.`);
    if (lic.ownerEmail && lic.ownerEmail.toLowerCase() !== String(auth.token.email || '').toLowerCase()) {
      throw new HttpsError('permission-denied', 'This license is registered to a different account email.');
    }
    const devRef = licRef.collection('devices').doc(deviceId);
    const devSnap = await tx.get(devRef);
    if (devSnap.exists && devSnap.data()!.status === 'revoked') throw new HttpsError('permission-denied', 'This device was revoked by the administrator.');
    if (!devSnap.exists) {
      const active = await tx.get(licRef.collection('devices').where('status', '==', 'active'));
      if (active.size >= lic.maxDevices) throw new HttpsError('resource-exhausted', `Device limit reached (${lic.maxDevices}). Deactivate another device or ask for more devices.`);
    }
    tx.set(devRef, {
      platform, deviceName: str(req.data?.deviceName), appVersion: str(req.data?.appVersion, 20), status: 'active', uid: auth.uid,
      lastSeenAt: FieldValue.serverTimestamp(), ...(devSnap.exists ? {} : { activatedAt: FieldValue.serverTimestamp() }),
    }, { merge: true });
    tx.set(db.collection('activations').doc(), { licenseKey: key, businessId: lic.businessId, deviceId, platform, uid: auth.uid, type: devSnap.exists ? 'reactivate' : 'activate', at: FieldValue.serverTimestamp() });
    return { lic, token: buildToken(key, lic, deviceId, platform, 'active') };
  });
  await ensureMembership(auth.uid, auth.token.email, result.lic.businessId);
  return { token: result.token, businessId: result.lic.businessId, businessName: result.lic.businessName };
});

export const refreshLicense = onCall({ secrets: [LICENSE_PRIVATE_KEY] }, async req => {
  const auth = requireAuth(req);
  const key = keyId(req.data?.licenseKey);
  const deviceId = str(req.data?.deviceId, 80);
  const licRef = db.doc(`licenses/${key}`);
  const [snap, dev] = await Promise.all([licRef.get(), licRef.collection('devices').doc(deviceId).get()]);
  if (!snap.exists) throw new HttpsError('not-found', 'License not found.');
  if (!dev.exists) throw new HttpsError('not-found', 'Device is not activated.');
  const lic = snap.data() as LicenseDoc;
  const d = dev.data()!;
  await dev.ref.update({ lastSeenAt: FieldValue.serverTimestamp(), appVersion: str(req.data?.appVersion, 20) || d.appVersion || '' });
  if (d.status === 'active' && effectiveStatus(lic) === 'active') await ensureMembership(auth.uid, auth.token.email, lic.businessId);
  // suspended / expired / revoked devices receive a signed token carrying that status, so they lock reliably
  return { token: buildToken(key, lic, deviceId, d.platform as Platform, d.status), businessId: lic.businessId, businessName: lic.businessName };
});

export const deactivateDevice = onCall(async req => {
  const auth = requireAuth(req);
  const key = keyId(req.data?.licenseKey);
  const deviceId = str(req.data?.deviceId, 80);
  const ref = db.doc(`licenses/${key}/devices/${deviceId}`);
  const d = await ref.get();
  if (!d.exists) return { ok: true };
  if (d.data()!.uid !== auth.uid && auth.token.superAdmin !== true) throw new HttpsError('permission-denied', 'Not your device.');
  await ref.update({ status: 'deactivated', deactivatedAt: FieldValue.serverTimestamp() });
  await db.collection('activations').add({ licenseKey: key, deviceId, type: 'deactivate', uid: auth.uid, at: FieldValue.serverTimestamp() });
  return { ok: true };
});

// ---------------------------------------------------------------- super admin
export const adminCreateBusiness = onCall(async req => {
  const a = requireSuperAdmin(req);
  const name = str(req.data?.name);
  if (!name) throw new HttpsError('invalid-argument', 'Business name required');
  const bid = `biz-${db.collection('_').doc().id}`;
  await db.doc(`businesses/${bid}`).set({
    name, status: 'active', ownerEmail: str(req.data?.ownerEmail).toLowerCase() || null, phone: str(req.data?.phone), city: str(req.data?.city),
    createdAt: FieldValue.serverTimestamp(),
  });
  await audit('business.create', a.uid, { businessId: bid, name });
  return { businessId: bid };
});

export const adminIssueLicense = onCall(async req => {
  const a = requireSuperAdmin(req);
  const businessId = str(req.data?.businessId, 80);
  const biz = await db.doc(`businesses/${businessId}`).get();
  if (!biz.exists) throw new HttpsError('not-found', 'Business not found');
  const days = Math.max(1, Math.min(3660, Number(req.data?.days) || 365));
  const key = generateLicenseKey();
  const doc: LicenseDoc = {
    businessId, businessName: biz.data()!.name, plan: str(req.data?.plan) || 'standard', status: 'active',
    maxDevices: Math.max(1, Math.min(100, Number(req.data?.maxDevices) || 2)),
    expiresAt: Timestamp.fromMillis(Date.now() + days * DAY), offlineGraceDays: Math.max(0, Math.min(60, Number(req.data?.offlineGraceDays) ?? 7)),
    refreshDays: Math.max(1, Math.min(60, Number(req.data?.refreshDays) || 7)), ownerEmail: biz.data()!.ownerEmail || undefined,
    createdAt: Timestamp.now(), notes: str(req.data?.notes, 500),
  };
  await db.doc(`licenses/${key}`).set(JSON.parse(JSON.stringify({ ...doc, expiresAt: null, createdAt: null })));
  await db.doc(`licenses/${key}`).update({ expiresAt: doc.expiresAt, createdAt: doc.createdAt });
  await audit('license.issue', a.uid, { licenseKey: key, businessId, days, maxDevices: doc.maxDevices });
  return { licenseKey: key };
});

export const adminUpdateLicense = onCall(async req => {
  const a = requireSuperAdmin(req);
  const key = keyId(req.data?.licenseKey);
  const ref = db.doc(`licenses/${key}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'License not found');
  const lic = snap.data() as LicenseDoc;
  const patch: Record<string, unknown> = {};
  const action = str(req.data?.action, 20);
  if (action === 'suspend') patch.status = 'suspended';
  else if (action === 'activate') patch.status = 'active';
  else if (action === 'renew') {
    const days = Math.max(1, Math.min(3660, Number(req.data?.days) || 365));
    patch.expiresAt = Timestamp.fromMillis(Math.max(Date.now(), lic.expiresAt.toMillis()) + days * DAY);
    patch.status = 'active';
  } else if (action === 'setMaxDevices') patch.maxDevices = Math.max(1, Math.min(100, Number(req.data?.maxDevices) || lic.maxDevices));
  else if (action === 'setGrace') patch.offlineGraceDays = Math.max(0, Math.min(60, Number(req.data?.offlineGraceDays) || 0));
  else throw new HttpsError('invalid-argument', 'Unknown action');
  await ref.update(patch);
  // keep business status in step (rules block writes for suspended businesses)
  if (patch.status) await db.doc(`businesses/${lic.businessId}`).update({ status: patch.status === 'active' ? 'active' : 'suspended' });
  await audit(`license.${action}`, a.uid, { licenseKey: key, businessId: lic.businessId, patch: JSON.parse(JSON.stringify(patch)) });
  return { ok: true };
});

export const adminRevokeDevice = onCall(async req => {
  const a = requireSuperAdmin(req);
  const key = keyId(req.data?.licenseKey);
  const deviceId = str(req.data?.deviceId, 80);
  const restore = req.data?.restore === true;
  await db.doc(`licenses/${key}/devices/${deviceId}`).update({ status: restore ? 'active' : 'revoked', revokedAt: restore ? null : FieldValue.serverTimestamp() });
  await db.collection('activations').add({ licenseKey: key, deviceId, type: restore ? 'restore' : 'revoke', uid: a.uid, at: FieldValue.serverTimestamp() });
  await audit(restore ? 'device.restore' : 'device.revoke', a.uid, { licenseKey: key, deviceId });
  return { ok: true };
});

/** Offline activation for shops without internet: token bound to the device id the shop sends. */
export const adminOfflineToken = onCall({ secrets: [LICENSE_PRIVATE_KEY] }, async req => {
  const a = requireSuperAdmin(req);
  const key = keyId(req.data?.licenseKey);
  const deviceId = str(req.data?.deviceId, 80);
  const platform = platformOf(req.data?.platform || (deviceId.startsWith('and') ? 'android' : deviceId.startsWith('win') ? 'windows' : 'web'));
  const licRef = db.doc(`licenses/${key}`);
  const snap = await licRef.get();
  if (!snap.exists) throw new HttpsError('not-found', 'License not found');
  const lic = snap.data() as LicenseDoc;
  const devRef = licRef.collection('devices').doc(deviceId);
  const dev = await devRef.get();
  if (!dev.exists) {
    const active = await licRef.collection('devices').where('status', '==', 'active').get();
    if (active.size >= lic.maxDevices) throw new HttpsError('resource-exhausted', 'Device limit reached');
    await devRef.set({ platform, deviceName: 'Offline activation', status: 'active', activatedAt: FieldValue.serverTimestamp(), offline: true });
  }
  // offline devices can't refresh, so give them a long refresh window up to expiry
  const longLic = { ...lic, refreshDays: Math.max(lic.refreshDays || 7, Number(req.data?.refreshDays) || 90) };
  await audit('license.offlineToken', a.uid, { licenseKey: key, deviceId });
  return { token: buildToken(key, longLic, deviceId, platform, dev.exists ? dev.data()!.status : 'active') };
});

export const adminSetAppVersion = onCall(async req => {
  const a = requireSuperAdmin(req);
  const platform = req.data?.platform === 'android' ? 'android' : 'windows';
  const data = {
    latestVersion: str(req.data?.latestVersion, 20), minVersion: str(req.data?.minVersion, 20),
    downloadUrl: str(req.data?.downloadUrl, 500), notes: str(req.data?.notes, 2000), updatedAt: FieldValue.serverTimestamp(),
  };
  if (data.downloadUrl && !/^https:\/\//.test(data.downloadUrl)) throw new HttpsError('invalid-argument', 'Download URL must be https');
  await db.doc(`appVersions/${platform}`).set(data, { merge: true });
  await audit('appVersion.set', a.uid, { platform, latestVersion: data.latestVersion });
  return { ok: true };
});

export const adminSetUserRole = onCall(async req => {
  const a = requireSuperAdmin(req);
  const email = str(req.data?.email).toLowerCase();
  const user = await getAuth().getUserByEmail(email).catch(() => null);
  if (!user) throw new HttpsError('not-found', 'No user with that email');
  const claims = { ...(user.customClaims || {}), superAdmin: req.data?.superAdmin === true };
  if (user.uid === a.uid && !claims.superAdmin) throw new HttpsError('failed-precondition', 'You cannot remove your own super admin role');
  await getAuth().setCustomUserClaims(user.uid, claims);
  if (req.data?.disabled !== undefined) await getAuth().updateUser(user.uid, { disabled: req.data.disabled === true });
  await audit('user.role', a.uid, { email, superAdmin: claims.superAdmin, disabled: req.data?.disabled });
  return { ok: true };
});

async function pushToBusiness(businessId: string, title: string, body: string) {
  const devs = await db.collection(`businesses/${businessId}/devices`).get();
  const tokens = devs.docs.map(d => d.data().fcmToken).filter(Boolean) as string[];
  if (!tokens.length) return 0;
  const r = await getMessaging().sendEachForMulticast({ tokens, notification: { title, body }, android: { priority: 'high' } });
  return r.successCount;
}

export const adminSendNotification = onCall(async req => {
  const a = requireSuperAdmin(req);
  const title = str(req.data?.title, 80);
  const body = str(req.data?.body, 500);
  if (!title || !body) throw new HttpsError('invalid-argument', 'Title and message required');
  const target = str(req.data?.businessId, 80);
  const ids = target ? [target] : (await db.collection('businesses').where('status', '==', 'active').get()).docs.map(d => d.id);
  let delivered = 0;
  for (const id of ids) delivered += await pushToBusiness(id, title, body).catch(() => 0);
  await db.collection('notifications').add({ title, body, businessId: target || 'all', sentBy: a.uid, delivered, at: FieldValue.serverTimestamp() });
  return { delivered, businesses: ids.length };
});

// ---------------------------------------------------------------- scheduled
export const dailyLicenseMaintenance = onSchedule({ schedule: 'every day 03:17', timeZone: 'Asia/Karachi' }, async () => {
  const now = Date.now();
  const snaps = await db.collection('licenses').where('status', '==', 'active').get();
  let expired = 0, warned = 0;
  for (const d of snaps.docs) {
    const lic = d.data() as LicenseDoc;
    const left = Math.ceil((lic.expiresAt.toMillis() - now) / DAY);
    if (left <= 0) {
      await d.ref.update({ status: 'expired' });
      await db.doc(`businesses/${lic.businessId}`).update({ status: 'suspended' }).catch(() => undefined);
      expired++;
    } else if ([14, 7, 3, 1].includes(left)) {
      warned += (await pushToBusiness(lic.businessId, 'License expiring', `Your license expires in ${left} day(s). Contact Digital Target to renew.`).catch(() => 0)) > 0 ? 1 : 0;
    }
  }
  await db.collection('systemLogs').add({ job: 'dailyLicenseMaintenance', checked: snaps.size, expired, warned, at: FieldValue.serverTimestamp() });
});
