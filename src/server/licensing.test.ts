import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { getLicenseStatus, SignedSchoolLicense, verifyInstallableLicense } from './licensing.js';

const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const now = new Date('2026-01-15T12:00:00.000Z');

function createLicense(overrides: Partial<SignedSchoolLicense['payload']> = {}): SignedSchoolLicense {
  const payload: SignedSchoolLicense['payload'] = {
    schemaVersion: 1,
    licenseId: 'lic-test-1',
    schoolId: 'school-test-1',
    schoolName: 'École de test',
    plan: 'monthly',
    startsAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2026-02-01T00:00:00.000Z',
    issuedAt: '2025-12-20T10:00:00.000Z',
    ...overrides,
  };
  const signature = crypto.sign(null, Buffer.from(JSON.stringify(payload)), privateKey).toString('base64');
  return { payload, signature };
}

test('accepts a signed license only for its school and active dates', () => {
  const status = getLicenseStatus(createLicense(), 'school-test-1', 'École de test', publicKeyPem, now);
  assert.equal(status.state, 'active');
  assert.equal(status.license?.licenseId, 'lic-test-1');
});

test('rejects tampered payloads and licenses for another school', () => {
  const license = createLicense();
  license.payload.schoolName = 'Autre école';
  assert.equal(getLicenseStatus(license, 'school-test-1', 'École de test', publicKeyPem, now).state, 'invalid');
  assert.equal(getLicenseStatus(createLicense(), 'school-other', 'Autre école', publicKeyPem, now).state, 'invalid');
});

test('requires signed subscription dates to match the selected monthly or annual plan', () => {
  const annualLicense = createLicense({
    plan: 'annual',
    startsAt: '2026-01-31T00:00:00.000Z',
    expiresAt: '2027-01-31T00:00:00.000Z',
  });
  assert.equal(
    getLicenseStatus(annualLicense, 'school-test-1', 'École de test', publicKeyPem, new Date('2026-02-15T12:00:00.000Z')).state,
    'active'
  );
  const mismatchedPlan = createLicense({ expiresAt: '2026-03-01T00:00:00.000Z' });
  assert.equal(getLicenseStatus(mismatchedPlan, 'school-test-1', 'École de test', publicKeyPem, now).state, 'invalid');
});

test('blocks missing, expired, and not-yet-active licenses', () => {
  assert.equal(getLicenseStatus(null, 'school-test-1', 'École de test', publicKeyPem, now).state, 'missing');
  assert.equal(
    getLicenseStatus(
      createLicense({
        startsAt: '2025-12-15T12:00:00.000Z',
        expiresAt: '2026-01-15T12:00:00.000Z',
      }),
      'school-test-1',
      'École de test',
      publicKeyPem,
      now
    ).state,
    'expired'
  );
  const futureLicense = createLicense({ startsAt: '2026-02-01T00:00:00.000Z', expiresAt: '2026-03-01T00:00:00.000Z' });
  assert.equal(getLicenseStatus(futureLicense, 'school-test-1', 'École de test', publicKeyPem, now).state, 'not_started');
  assert.equal(verifyInstallableLicense(futureLicense, 'school-test-1', publicKeyPem, now), true);
  assert.equal(verifyInstallableLicense(createLicense(), 'school-test-1', publicKeyPem, now), true);
  assert.equal(verifyInstallableLicense(null, 'school-test-1', publicKeyPem, now), false);
});

test('fails closed when the verifier key is not configured', () => {
  assert.equal(getLicenseStatus(createLicense(), 'school-test-1', 'École de test', undefined, now).state, 'unconfigured');
});
