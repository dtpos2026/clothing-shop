/**
 * License token signing (server side). Format must match src/core/license.ts in the apps:
 *   base64url(JSON payload) "." base64url(Ed25519 signature over the payload bytes)
 * Uses Node's built-in Ed25519 – the private key is a 32-byte seed (hex) kept in a secret.
 */
import { createPrivateKey, createPublicKey, sign, verify, randomBytes } from 'node:crypto';

export type LicenseStatus = 'active' | 'suspended' | 'expired' | 'revoked';

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
  refreshBy: string;
  offlineGraceDays: number;
  deviceId: string;
  platform: 'windows' | 'android' | 'web';
  features?: string[];
}

const b64url = (b: Buffer) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');
const SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

export function privateKeyFromSeedHex(seedHex: string) {
  const seed = Buffer.from(seedHex.trim(), 'hex');
  if (seed.length !== 32) throw new Error('LICENSE_PRIVATE_KEY must be 32 bytes hex');
  return createPrivateKey({ key: Buffer.concat([PKCS8_PREFIX, seed]), format: 'der', type: 'pkcs8' });
}

export function publicKeyHexFromSeedHex(seedHex: string): string {
  const der = createPublicKey(privateKeyFromSeedHex(seedHex)).export({ format: 'der', type: 'spki' }) as Buffer;
  return der.subarray(SPKI_PREFIX.length).toString('hex');
}

export function signLicense(payload: LicensePayload, seedHex: string): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  const sig = sign(null, body, privateKeyFromSeedHex(seedHex));
  return `${b64url(body)}.${b64url(sig)}`;
}

export function verifyToken(token: string, publicKeyHex: string): boolean {
  const [b, s] = token.split('.');
  const pub = createPublicKey({ key: Buffer.concat([SPKI_PREFIX, Buffer.from(publicKeyHex, 'hex')]), format: 'der', type: 'spki' });
  return verify(null, Buffer.from(b, 'base64url'), pub, Buffer.from(s, 'base64url'));
}

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function licenseKeyCheckChar(core: string): string {
  let sum = 0;
  for (let i = 0; i < core.length; i++) sum = (sum * 31 + ALPHABET.indexOf(core[i])) % 32;
  return ALPHABET[sum];
}
export function normalizeLicenseKey(k: string) {
  return String(k || '').toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/^DTFP/, '');
}
export function formatLicenseKey(k: string) {
  return `DTFP-${normalizeLicenseKey(k).match(/.{1,4}/g)!.join('-')}`;
}
export function isWellFormedLicenseKey(k: string) {
  const core = normalizeLicenseKey(k);
  return core.length === 16 && [...core].every(c => ALPHABET.includes(c)) && licenseKeyCheckChar(core.slice(0, 15)) === core[15];
}
export function generateLicenseKey(): string {
  const core = [...randomBytes(15)].map(b => ALPHABET[b % 32]).join('');
  return formatLicenseKey(core + licenseKeyCheckChar(core));
}
