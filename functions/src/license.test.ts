import { test } from 'node:test';
import assert from 'node:assert';
import { randomBytes } from 'node:crypto';
import { signLicense, verifyToken, publicKeyHexFromSeedHex, generateLicenseKey, isWellFormedLicenseKey, type LicensePayload } from './license';

test('server-signed token verifies and key format matches app', () => {
  const seed = randomBytes(32).toString('hex');
  const payload: LicensePayload = {
    v: 1, licenseKey: generateLicenseKey(), businessId: 'biz-1', businessName: 'Shop', plan: 'pro', status: 'active',
    maxDevices: 2, issuedAt: new Date().toISOString(), expiresAt: '2030-01-01T00:00:00Z', refreshBy: '2030-01-01T00:00:00Z',
    offlineGraceDays: 7, deviceId: 'win-1', platform: 'windows',
  };
  const tok = signLicense(payload, seed);
  assert.ok(verifyToken(tok, publicKeyHexFromSeedHex(seed)));
  assert.ok(isWellFormedLicenseKey(payload.licenseKey));
});
