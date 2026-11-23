/**
 * Unified business license (Windows + Android share one license).
 *
 * Trust model
 * -----------
 * Only the server (Cloud Functions, holding the Ed25519 PRIVATE key as a secret) can
 * issue a license token. The apps embed only the PUBLIC key and verify signatures
 * offline, so a token can't be forged or edited (e.g. extending expiry) on a device.
 *
 * Token = base64url(JSON payload) + "." + base64url(signature over the payload bytes)
 *
 * Validity on a device requires all of:
 *   - valid signature
 *   - payload.deviceId === this device's id  (a copied token doesn't work elsewhere)
 *   - payload.status === 'active'
 *   - now < expiresAt (+ graceDays when offline past the refresh time)
 *   - now < refreshBy + offlineGraceDays (the app must check in periodically, so
 *     suspension/revocation done by the Super Admin reaches the device)
 */
import { ed25519 } from '@noble/curves/ed25519.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';

export type LicenseStatus = 'active' | 'suspended' | 'expired' | 'revoked';
export type LicensePlatform = 'windows' | 'android' | 'web';

export interface LicensePayload {
  v: 1;
  licenseKey: string;
  businessId: string;
  businessName: string;
  plan: string;
  status: LicenseStatus;
  maxDevices: number;
  issuedAt: string;
  expiresAt: string;
  /** Device must re-validate online before this time… */
  refreshBy: string;
  /** …but may keep working offline this many days after refreshBy. */
  offlineGraceDays: number;
  deviceId: string;
  platform: LicensePlatform;
  features?: string[];
}

export const b64url = {
  encode(bytes: Uint8Array): string {
    let bin = '';
    bytes.forEach(b => (bin += String.fromCharCode(b)));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  decode(s: string): Uint8Array {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },
};

const hexToBytes = (hex: string) => new Uint8Array((hex.match(/.{2}/g) || []).map(h => parseInt(h, 16)));

/** Used by the server (and tests). Never ship a private key in the apps. */
export function signLicense(payload: LicensePayload, privateKeyHex: string): string {
  const body = utf8ToBytes(JSON.stringify(payload));
  const sig = ed25519.sign(body, hexToBytes(privateKeyHex));
  return `${b64url.encode(body)}.${b64url.encode(sig)}`;
}

export function decodeLicense(token: string): LicensePayload | null {
  try {
    const [body] = token.trim().split('.');
    return JSON.parse(new TextDecoder().decode(b64url.decode(body)));
  } catch {
    return null;
  }
}

export type LicenseCheck =
  | { state: 'valid'; payload: LicensePayload; daysLeft: number; needsRefresh: boolean }
  | { state: 'grace'; payload: LicensePayload; graceDaysLeft: number; reason: string }
  | { state: 'invalid'; reason: string; payload?: LicensePayload };

const DAY = 86_400_000;

export function verifyLicense(token: string, publicKeyHex: string, deviceId: string, now: Date = new Date()): LicenseCheck {
  if (!token) return { state: 'invalid', reason: 'No license installed' };
  const parts = token.trim().split('.');
  if (parts.length !== 2) return { state: 'invalid', reason: 'Malformed license token' };
  let body: Uint8Array, sig: Uint8Array;
  try {
    body = b64url.decode(parts[0]);
    sig = b64url.decode(parts[1]);
  } catch {
    return { state: 'invalid', reason: 'Malformed license token' };
  }
  let ok = false;
  try {
    ok = ed25519.verify(sig, body, hexToBytes(publicKeyHex));
  } catch {
    ok = false;
  }
  if (!ok) return { state: 'invalid', reason: 'License signature is not valid' };
  const payload = decodeLicense(token)!;
  if (payload.deviceId !== deviceId) return { state: 'invalid', reason: 'License belongs to another device', payload };
  if (payload.status === 'suspended') return { state: 'invalid', reason: 'License suspended – contact your provider', payload };
  if (payload.status === 'revoked') return { state: 'invalid', reason: 'This device was deactivated', payload };

  const t = now.getTime();
  const expires = Date.parse(payload.expiresAt);
  const refreshBy = Date.parse(payload.refreshBy);
  const graceEnd = refreshBy + payload.offlineGraceDays * DAY;
  if (t >= expires) return { state: 'invalid', reason: 'License expired – please renew', payload };
  if (t >= graceEnd) return { state: 'invalid', reason: 'License must be re-validated online', payload };
  if (t >= refreshBy) {
    return {
      state: 'grace', payload, reason: 'Offline grace period – connect to the internet to re-validate',
      graceDaysLeft: Math.max(0, Math.ceil((graceEnd - t) / DAY)),
    };
  }
  return { state: 'valid', payload, daysLeft: Math.ceil((expires - t) / DAY), needsRefresh: refreshBy - t < 2 * DAY };
}

/** License keys look like DTFP-XXXX-XXXX-XXXX-XXXX (Crockford base32, last group has a check char). */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function licenseKeyCheckChar(core: string): string {
  let sum = 0;
  for (let i = 0; i < core.length; i++) sum = (sum * 31 + ALPHABET.indexOf(core[i])) % 32;
  return ALPHABET[sum];
}
export function normalizeLicenseKey(k: string) {
  return k.toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/^DTFP/, '');
}
export function isWellFormedLicenseKey(k: string): boolean {
  const core = normalizeLicenseKey(k);
  if (core.length !== 16 || [...core].some(c => !ALPHABET.includes(c))) return false;
  return licenseKeyCheckChar(core.slice(0, 15)) === core[15];
}
export function formatLicenseKey(k: string) {
  const core = normalizeLicenseKey(k);
  return `DTFP-${core.match(/.{1,4}/g)?.join('-')}`;
}
export function generateLicenseKey(random: (n: number) => Uint8Array = n => crypto.getRandomValues(new Uint8Array(n))): string {
  const bytes = random(15);
  const core = [...bytes].map(b => ALPHABET[b % 32]).join('');
  return formatLicenseKey(core + licenseKeyCheckChar(core));
}
