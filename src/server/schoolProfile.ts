import { SchoolProfile } from '../types.js';

const MAX_LOGO_BYTES = 1024 * 1024;
const MAX_LOGO_DATA_URL_LENGTH = Math.ceil(MAX_LOGO_BYTES * 4 / 3) + 32;

export function validateSchoolProfile(input: unknown): SchoolProfile | null {
  if (!input || typeof input !== 'object') return null;
  const profile = input as Record<string, unknown>;
  const textFields = [
    ['schoolName', 160, true],
    ['city', 160, true],
    ['address', 240, false],
    ['phone', 60, false],
    ['email', 160, false],
    ['motto', 160, false],
    ['principalName', 120, false],
    ['directorOfStudiesName', 120, false],
  ] as const;

  for (const [field, maxLength, required] of textFields) {
    const value = profile[field];
    if (typeof value !== 'string' || value.length > maxLength || (required && !value.trim())) return null;
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value)) return null;
  }
  if (
    profile.email &&
    (typeof profile.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email))
  ) return null;

  const colors = ['primaryColor', 'secondaryColor', 'accentColor'] as const;
  for (const color of colors) {
    if (typeof profile[color] !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(profile[color] as string)) return null;
  }

  let logoDataUrl: string | null = null;
  if (profile.logoDataUrl !== null && profile.logoDataUrl !== undefined && profile.logoDataUrl !== '') {
    if (typeof profile.logoDataUrl !== 'string' || profile.logoDataUrl.length > MAX_LOGO_DATA_URL_LENGTH) return null;
    const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(profile.logoDataUrl);
    if (!match) return null;
    const imageBytes = Buffer.from(match[2], 'base64');
    if (!imageBytes.length || imageBytes.length > MAX_LOGO_BYTES) return null;
    const isPng = match[1] === 'png' &&
      imageBytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const isJpeg = match[1] === 'jpeg' &&
      imageBytes[0] === 0xff && imageBytes[1] === 0xd8 && imageBytes[2] === 0xff;
    if (!isPng && !isJpeg) return null;
    logoDataUrl = profile.logoDataUrl;
  }

  return {
    schoolName: (profile.schoolName as string).trim(),
    city: (profile.city as string).trim(),
    address: (profile.address as string).trim(),
    phone: (profile.phone as string).trim(),
    email: (profile.email as string).trim(),
    motto: (profile.motto as string).trim(),
    principalName: (profile.principalName as string).trim(),
    directorOfStudiesName: (profile.directorOfStudiesName as string).trim(),
    primaryColor: profile.primaryColor as string,
    secondaryColor: profile.secondaryColor as string,
    accentColor: profile.accentColor as string,
    logoDataUrl,
  };
}
