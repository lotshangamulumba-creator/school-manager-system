import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_SCHOOL_PROFILE } from '../data/schoolProfile.js';
import { validateSchoolProfile } from './schoolProfile.js';

function validProfile(overrides: Record<string, unknown> = {}) {
  return { ...DEFAULT_SCHOOL_PROFILE, ...overrides };
}

test('normalizes and trims school identity fields', () => {
  const profile = validateSchoolProfile(validProfile({
    schoolName: '  École Exemple  ',
    city: '  Pointe-Noire  ',
    address: '  Avenue 1  ',
  }));
  assert.equal(profile?.schoolName, 'École Exemple');
  assert.equal(profile?.city, 'Pointe-Noire');
  assert.equal(profile?.address, 'Avenue 1');
});

test('rejects invalid required fields, contact details, and colors', () => {
  assert.equal(validateSchoolProfile(validProfile({ schoolName: '  ' })), null);
  assert.equal(validateSchoolProfile(validProfile({ email: 'not-an-email' })), null);
  assert.equal(validateSchoolProfile(validProfile({ primaryColor: 'blue' })), null);
  assert.equal(validateSchoolProfile(validProfile({ address: 'invalid\u0000text' })), null);
});

test('accepts PNG logos with a real PNG signature and rejects SVG or malformed image data', () => {
  const pngBytes = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    Buffer.from('image-payload'),
  ]);
  const pngDataUrl = `data:image/png;base64,${pngBytes.toString('base64')}`;
  assert.equal(validateSchoolProfile(validProfile({ logoDataUrl: pngDataUrl }))?.logoDataUrl, pngDataUrl);
  assert.equal(validateSchoolProfile(validProfile({ logoDataUrl: 'data:image/svg+xml;base64,PHN2Zy8+' })), null);
  assert.equal(validateSchoolProfile(validProfile({ logoDataUrl: 'data:image/png;base64,SGVsbG8=' })), null);
});

test('rejects logos larger than the one-megabyte limit', () => {
  const oversized = Buffer.alloc(1024 * 1024 + 1);
  oversized.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
  const dataUrl = `data:image/png;base64,${oversized.toString('base64')}`;
  assert.equal(validateSchoolProfile(validProfile({ logoDataUrl: dataUrl })), null);
});
