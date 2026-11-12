import crypto from 'crypto';

export type LicensePlan = 'monthly' | 'annual';
export type LicenseState = 'active' | 'missing' | 'invalid' | 'not_started' | 'expired' | 'unconfigured';

export interface SchoolLicensePayload {
  schemaVersion: 1;
  licenseId: string;
  schoolId: string;
  schoolName: string;
  plan: LicensePlan;
  startsAt: string;
  expiresAt: string;
  issuedAt: string;
}

export interface SignedSchoolLicense {
  payload: SchoolLicensePayload;
  signature: string;
}

export interface LicenseStatus {
  state: LicenseState;
  schoolId: string;
  schoolName: string;
  license: SchoolLicensePayload | null;
}

function isCanonicalDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function addPlanPeriod(startsAt: string, plan: LicensePlan): string {
  const start = new Date(startsAt);
  const day = start.getUTCDate();
  const expiration = new Date(start);
  expiration.setUTCDate(1);
  expiration.setUTCMonth(expiration.getUTCMonth() + (plan === 'annual' ? 12 : 1));
  const lastDay = new Date(Date.UTC(
    expiration.getUTCFullYear(),
    expiration.getUTCMonth() + 1,
    0
  )).getUTCDate();
  expiration.setUTCDate(Math.min(day, lastDay));
  return expiration.toISOString();
}

function isValidPayload(payload: unknown): payload is SchoolLicensePayload {
  if (!payload || typeof payload !== 'object') return false;
  const candidate = payload as Record<string, unknown>;
  return candidate.schemaVersion === 1 &&
    typeof candidate.licenseId === 'string' && candidate.licenseId.length > 0 && candidate.licenseId.length <= 128 &&
    typeof candidate.schoolId === 'string' && candidate.schoolId.length > 0 && candidate.schoolId.length <= 128 &&
    typeof candidate.schoolName === 'string' && candidate.schoolName.trim().length > 0 && candidate.schoolName.length <= 256 &&
    (candidate.plan === 'monthly' || candidate.plan === 'annual') &&
    isCanonicalDate(candidate.startsAt) &&
    isCanonicalDate(candidate.expiresAt) &&
    isCanonicalDate(candidate.issuedAt) &&
    candidate.expiresAt === addPlanPeriod(candidate.startsAt, candidate.plan);
}

export function getLicenseStatus(
  license: SignedSchoolLicense | null | undefined,
  schoolId: string,
  schoolName: string,
  publicKey: string | undefined,
  now: Date = new Date()
): LicenseStatus {
  const status: LicenseStatus = {
    state: 'missing',
    schoolId,
    schoolName,
    license: null,
  };
  if (!publicKey) return { ...status, state: 'unconfigured' };
  if (!license) return status;
  if (
    !isValidPayload(license.payload) ||
    typeof license.signature !== 'string' ||
    license.signature.length > 128 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(license.signature)
  ) {
    return { ...status, state: 'invalid' };
  }

  const payload = license.payload;
  if (payload.schoolId !== schoolId) return { ...status, state: 'invalid' };
  const signatureBytes = Buffer.from(license.signature, 'base64');
  if (signatureBytes.length !== 64) return { ...status, state: 'invalid' };

  let verifierKey: crypto.KeyObject;
  try {
    verifierKey = crypto.createPublicKey(publicKey.replace(/\\n/g, '\n'));
  } catch {
    return { ...status, state: 'unconfigured' };
  }
  let signatureIsValid = false;
  try {
    signatureIsValid = crypto.verify(
      null,
      Buffer.from(JSON.stringify(payload), 'utf8'),
      verifierKey,
      signatureBytes
    );
  } catch {
    return { ...status, state: 'invalid' };
  }
  if (!signatureIsValid) return { ...status, state: 'invalid' };

  const currentTime = now.getTime();
  const state: LicenseState = currentTime < new Date(payload.startsAt).getTime()
    ? 'not_started'
    : currentTime >= new Date(payload.expiresAt).getTime()
      ? 'expired'
      : 'active';
  return { ...status, state, license: payload };
}

export function verifyInstallableLicense(
  license: SignedSchoolLicense | null | undefined,
  schoolId: string,
  publicKey: string | undefined,
  now: Date = new Date()
): boolean {
  const status = getLicenseStatus(license, schoolId, license?.payload?.schoolName || '', publicKey, now);
  return status.state === 'active' || status.state === 'not_started';
}

export function getConfiguredLicensePublicKey(): string | undefined {
  const key = process.env.LICENSE_PUBLIC_KEY;
  return key ? key.replace(/\\n/g, '\n') : undefined;
}
