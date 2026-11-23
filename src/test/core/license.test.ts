import { describe, it, expect } from 'vitest';
import { ed25519 } from '@noble/curves/ed25519.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { signLicense, verifyLicense, generateLicenseKey, isWellFormedLicenseKey, b64url, type LicensePayload } from '@/core/license';

const priv = ed25519.utils.randomSecretKey();
const PRIV = bytesToHex(priv);
const PUB = bytesToHex(ed25519.getPublicKey(priv));
const now = new Date('2026-06-01T00:00:00Z');
const payload = (over: Partial<LicensePayload> = {}): LicensePayload => ({
  v: 1, licenseKey: 'DTFP-TEST', businessId: 'biz-1', businessName: 'Shop', plan: 'pro', status: 'active', maxDevices: 3,
  issuedAt: '2026-05-30T00:00:00Z', expiresAt: '2027-01-01T00:00:00Z', refreshBy: '2026-06-06T00:00:00Z',
  offlineGraceDays: 7, deviceId: 'win-1', platform: 'windows', ...over,
});

describe('license tokens', () => {
  it('accepts a valid token on the right device (windows and android use the same license)', () => {
    expect(verifyLicense(signLicense(payload(), PRIV), PUB, 'win-1', now).state).toBe('valid');
    expect(verifyLicense(signLicense(payload({ deviceId: 'and-1', platform: 'android' }), PRIV), PUB, 'and-1', now).state).toBe('valid');
  });
  it('rejects a token copied to another device', () => {
    const r = verifyLicense(signLicense(payload(), PRIV), PUB, 'and-9', now);
    expect(r.state).toBe('invalid');
  });
  it('rejects tampered payloads (e.g. extended expiry)', () => {
    const tok = signLicense(payload(), PRIV);
    const [, sig] = tok.split('.');
    const forged = b64url.encode(new TextEncoder().encode(JSON.stringify(payload({ expiresAt: '2099-01-01T00:00:00Z' })))) + '.' + sig;
    expect(verifyLicense(forged, PUB, 'win-1', now)).toMatchObject({ state: 'invalid', reason: 'License signature is not valid' });
  });
  it('rejects tokens signed with a different key', () => {
    const other = bytesToHex(ed25519.utils.randomSecretKey());
    expect(verifyLicense(signLicense(payload(), other), PUB, 'win-1', now).state).toBe('invalid');
  });
  it('offline grace then lock-out', () => {
    const tok = signLicense(payload(), PRIV);
    expect(verifyLicense(tok, PUB, 'win-1', new Date('2026-06-08T00:00:00Z')).state).toBe('grace');
    expect(verifyLicense(tok, PUB, 'win-1', new Date('2026-06-20T00:00:00Z')).state).toBe('invalid');
  });
  it('expired and suspended', () => {
    expect(verifyLicense(signLicense(payload({ expiresAt: '2026-05-31T00:00:00Z' }), PRIV), PUB, 'win-1', now).state).toBe('invalid');
    expect(verifyLicense(signLicense(payload({ status: 'suspended' }), PRIV), PUB, 'win-1', now).state).toBe('invalid');
  });
  it('license keys have a check character', () => {
    const k = generateLicenseKey();
    expect(k).toMatch(/^DTFP-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    expect(isWellFormedLicenseKey(k)).toBe(true);
    const bad = k.slice(0, -1) + (k.endsWith('0') ? '1' : '0');
    expect(isWellFormedLicenseKey(bad)).toBe(false);
  });
});
