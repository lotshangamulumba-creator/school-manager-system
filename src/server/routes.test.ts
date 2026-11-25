import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monpilot-routes-'));
process.env.DATABASE_FILE = path.join(directory, 'school.json');
process.env.JWT_SECRET = 'route-integration-tests-secret-32-characters';
process.env.NODE_ENV = 'test';
process.env.SEED_ADMIN_EMAIL = 'admin@routes.test';
process.env.SEED_ADMIN_PASSWORD = 'SchoolAdminTest-2026!';
process.env.SEED_DEMO_DATA = 'false';

const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
process.env.LICENSE_PUBLIC_KEY = publicKey.export({ type: 'spki', format: 'pem' }).toString();

const { db } = await import('./db.js');
await db.ready;
const { apiRouter } = await import('./routes.js');

const app = express();
app.use(express.json({ limit: '20mb' }));
app.use('/api', apiRouter);
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address();
assert.ok(address && typeof address !== 'string');
const apiBase = `http://127.0.0.1:${address.port}/api`;
const initialAdmin = db.getData().users.find(user => user.role === 'ADMIN')!;

function signedLicense(startsAt: string, expiresAt: string, licenseId: string) {
  const payload = {
    schemaVersion: 1 as const,
    licenseId,
    schoolId: db.getData().schoolId,
    schoolName: db.getData().establishmentName,
    plan: 'monthly' as const,
    startsAt,
    expiresAt,
    issuedAt: startsAt,
  };
  return {
    payload,
    signature: crypto.sign(null, Buffer.from(JSON.stringify(payload)), privateKey).toString('base64'),
  };
}

function installActiveLicense() {
  const now = new Date();
  const startsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const expires = new Date(startsAt);
  expires.setUTCMonth(expires.getUTCMonth() + 1);
  db.getData().license = signedLicense(startsAt, expires.toISOString(), 'routes-active');
  db.persist();
}

async function request(pathname: string, options: { method?: string; body?: unknown; token?: string } = {}) {
  const response = await fetch(`${apiBase}${pathname}`, {
    method: options.method || 'GET',
    headers: {
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  return { response, text, data: text ? JSON.parse(text) : null };
}

async function login(email = initialAdmin.email, password = 'SchoolAdminTest-2026!') {
  return request('/auth/login', { method: 'POST', body: { email, password } });
}

let adminToken = '';
let exportedBackup: Record<string, any>;
let integrationClassId = '';
let integrationStudentId = '';
let integrationSubjectId = '';

test.after(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  fs.rmSync(directory, { recursive: true, force: true });
});

test('login errors are generic for unknown users and wrong passwords', async () => {
  const unknown = await login('missing@routes.test', 'wrong-password');
  const wrongPassword = await login(initialAdmin.email, 'wrong-password');
  assert.equal(unknown.response.status, 401);
  assert.equal(wrongPassword.response.status, 401);
  assert.deepEqual(unknown.data, wrongPassword.data);
  assert.equal(unknown.data.error, 'Identifiants invalides');
});

test('login is rate-limited to five attempts per IP and email', async () => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const result = await login('rate-limit@routes.test', 'invalid');
    assert.equal(result.response.status, 401);
  }
  const limited = await login('rate-limit@routes.test', 'invalid');
  assert.equal(limited.response.status, 429);
});

test('authenticated password changes require the old password and a strong new password', async () => {
  installActiveLicense();
  const authenticated = await login();
  assert.equal(authenticated.response.status, 200);
  adminToken = authenticated.data.token;

  const missingOld = await request('/auth/change-password', {
    method: 'POST',
    token: adminToken,
    body: { newPassword: 'DifferentStrong2026!' },
  });
  assert.equal(missingOld.response.status, 400);

  const incorrectOld = await request('/auth/change-password', {
    method: 'POST',
    token: adminToken,
    body: { oldPassword: 'wrong-password', newPassword: 'DifferentStrong2026!' },
  });
  assert.equal(incorrectOld.response.status, 401);

  const weakNew = await request('/auth/change-password', {
    method: 'POST',
    token: adminToken,
    body: { oldPassword: 'SchoolAdminTest-2026!', newPassword: 'password' },
  });
  assert.equal(weakNew.response.status, 400);

  const changed = await request('/auth/change-password', {
    method: 'POST',
    token: adminToken,
    body: { oldPassword: 'SchoolAdminTest-2026!', newPassword: 'DifferentStrong2026!' },
  });
  assert.equal(changed.response.status, 200);
  const loginAudit = db.getData().auditLogs.filter(entry => entry.action === 'LOGIN_FAILURE' || entry.action === 'USER_LOGIN');
  assert.ok(loginAudit.some(entry => entry.action === 'LOGIN_FAILURE'));
  assert.ok(loginAudit.some(entry => entry.action === 'USER_LOGIN'));
  assert.ok(loginAudit.every(entry => !/wrong-password|SchoolAdminTest|DifferentStrong/i.test(entry.details)));
});

test('user writes normalize emails and never expose password hashes or allow self-demotion', async () => {
  const created = await request('/users', {
    method: 'POST',
    token: adminToken,
    body: {
      email: ' New.Teacher@Routes.Test ',
      password: 'StrongTeacher2026!',
      nom: 'Teacher',
      prenom: 'New',
      role: 'TEACHER',
    },
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.data.email, 'new.teacher@routes.test');
  assert.equal('passwordHash' in created.data, false);

  const invalidRole = await request('/users', {
    method: 'POST',
    token: adminToken,
    body: { email: 'bad-role@routes.test', password: 'StrongTeacher2026!', nom: 'Bad', prenom: 'Role', role: 'SUPERADMIN' },
  });
  assert.equal(invalidRole.response.status, 400);

  const demoteSelf = await request(`/users/${initialAdmin.id}`, {
    method: 'PUT',
    token: adminToken,
    body: { role: 'TEACHER' },
  });
  assert.equal(demoteSelf.response.status, 400);

  const deactivateSelf = await request(`/users/${initialAdmin.id}`, {
    method: 'PUT',
    token: adminToken,
    body: { actif: false },
  });
  assert.equal(deactivateSelf.response.status, 400);

  const listed = await request('/users', { token: adminToken });
  assert.ok(listed.data.every((user: Record<string, unknown>) => !('passwordHash' in user)));
});

test('student records use UUIDs, configurable matricules, and real birth-date validation', async () => {
  const profileResponse = await request('/school-profile');
  const profile = { ...profileResponse.data, matriculePrefix: 'TEST' };
  const profileUpdate = await request('/school-profile', {
    method: 'PUT',
    token: adminToken,
    body: { profile },
  });
  assert.equal(profileUpdate.response.status, 200, JSON.stringify(profileUpdate.data));

  const createdClass = await request('/classes', {
    method: 'POST',
    token: adminToken,
    body: { nom: 'Classe intégration', niveau: 'Collège' },
  });
  assert.equal(createdClass.response.status, 201);
  integrationClassId = createdClass.data.id;

  const classInput = {
    nom: 'Élève',
    prenom: 'Test',
    sexe: 'M',
    dateNaissance: '01/01/2010',
    classId: integrationClassId,
    className: 'Classe intégration',
  };
  const invalidDate = await request('/students', {
    method: 'POST',
    token: adminToken,
    body: { ...classInput, dateNaissance: '31/02/2010' },
  });
  assert.equal(invalidDate.response.status, 400);

  const future = new Date();
  future.setDate(future.getDate() + 1);
  const futureDate = `${String(future.getUTCDate()).padStart(2, '0')}/${String(future.getUTCMonth() + 1).padStart(2, '0')}/${future.getUTCFullYear()}`;
  const futureBirthDate = await request('/students', {
    method: 'POST',
    token: adminToken,
    body: { ...classInput, dateNaissance: futureDate },
  });
  assert.equal(futureBirthDate.response.status, 400);

  const createdStudent = await request('/students', {
    method: 'POST',
    token: adminToken,
    body: classInput,
  });
  assert.equal(createdStudent.response.status, 201);
  assert.match(createdStudent.data.id, /^[0-9a-f-]{36}$/i);
  assert.equal(createdStudent.data.matricule, 'TEST-001');
  assert.notEqual(createdStudent.data.id, createdStudent.data.matricule);
  integrationStudentId = createdStudent.data.id;

  const duplicateMatricule = await request('/students', {
    method: 'POST',
    token: adminToken,
    body: { ...classInput, matricule: 'DUPLICATE-1' },
  });
  assert.equal(duplicateMatricule.response.status, 201);
  const duplicateRejected = await request('/students', {
    method: 'POST',
    token: adminToken,
    body: { ...classInput, matricule: 'DUPLICATE-1' },
  });
  assert.equal(duplicateRejected.response.status, 409);

  const imported = await request('/students/batch-import', {
    method: 'POST',
    token: adminToken,
    body: {
      targetClassId: integrationClassId,
      targetClassName: 'Classe intégration',
      students: [{ lastName: 'Imported', firstName: 'Student', gender: 'F', dob: '02/02/2011' }],
    },
  });
  assert.equal(imported.response.status, 200);
  const importedStudent = db.getData().students.find(student => student.prenom === 'Student');
  assert.equal(importedStudent?.matricule, 'TEST-002');

  const countBeforeDuplicateImport = db.getData().students.length;
  const duplicateImport = await request('/students/batch-import', {
    method: 'POST',
    token: adminToken,
    body: {
      targetClassId: integrationClassId,
      targetClassName: 'Classe intégration',
      students: [
        { nom: 'First', prenom: 'Duplicate', matricule: 'DUPLICATE-BATCH', dateNaissance: '01/01/2010' },
        { nom: 'Second', prenom: 'Duplicate', matricule: 'duplicate-batch', dateNaissance: '01/01/2010' },
      ],
    },
  });
  assert.equal(duplicateImport.response.status, 409);
  assert.equal(db.getData().students.length, countBeforeDuplicateImport);
});

test('grade writes preserve missing marks and reject out-of-range values', async () => {
  const subjects = await request('/subjects', { token: adminToken });
  const subject = subjects.data.find((item: { niveau: string; statut: boolean }) => item.niveau === 'Collège' && item.statut);
  assert.ok(subject);
  integrationSubjectId = subject.id;
  const baseGrade = {
    studentId: integrationStudentId,
    subjectId: subject.id,
    subjectName: subject.nom,
  };
  const emptyRow = await request('/grades/batch', {
    method: 'POST',
    token: adminToken,
    body: {
      classId: integrationClassId,
      className: 'Classe intégration',
      term: '1er Trimestre',
      grades: [{ ...baseGrade, evaluations: null, dev1: '', dev2: null, composition: undefined }],
    },
  });
  assert.equal(emptyRow.response.status, 200);
  let grades = await request(`/grades?classId=${integrationClassId}&term=1er%20Trimestre`, { token: adminToken });
  assert.equal(grades.data.length, 0);

  const invalidGrade = await request('/grades/batch', {
    method: 'POST',
    token: adminToken,
    body: {
      classId: integrationClassId,
      className: 'Classe intégration',
      term: '1er Trimestre',
      grades: [{ ...baseGrade, evaluations: 99, dev1: null, dev2: null, composition: 12 }],
    },
  });
  assert.equal(invalidGrade.response.status, 400);

  const progressiveGrade = await request('/grades/batch', {
    method: 'POST',
    token: adminToken,
    body: {
      classId: integrationClassId,
      className: 'Classe intégration',
      term: '1er Trimestre',
      grades: [{ ...baseGrade, evaluations: null, dev1: null, composition: 12 }],
    },
  });
  assert.equal(progressiveGrade.response.status, 200);
  grades = await request(`/grades?classId=${integrationClassId}&term=1er%20Trimestre`, { token: adminToken });
  assert.equal(grades.data.length, 1);
  assert.equal(grades.data[0].evaluations, null);
  assert.equal(grades.data[0].dev1, null);
  assert.equal(grades.data[0].dev2, null);
  assert.equal(grades.data[0].composition, 12);

  const results = await request(`/results/class/${integrationClassId}?term=1er%20Trimestre`, { token: adminToken });
  const studentResult = results.data.results.find((result: { student: { id: string } }) => result.student.id === integrationStudentId);
  assert.equal(studentResult.generalAvg, null);
  assert.equal(studentResult.isProvisional, true);
});

test('academic-year administration allows only one active year and closes years', async () => {
  const createdYear = await request('/academic-years', {
    method: 'POST',
    token: adminToken,
    body: { label: 'Integration 2030-2031', startDate: '2030-09-01', endDate: '2031-06-30' },
  });
  assert.equal(createdYear.response.status, 201);
  const duplicate = await request('/academic-years', {
    method: 'POST',
    token: adminToken,
    body: { label: 'Integration 2030-2031', startDate: '2030-09-01', endDate: '2031-06-30' },
  });
  assert.equal(duplicate.response.status, 409);

  const activated = await request(`/academic-years/${createdYear.data.id}/activate`, {
    method: 'POST',
    token: adminToken,
  });
  assert.equal(activated.response.status, 200);
  const years = await request('/academic-years', { token: adminToken });
  assert.equal(years.data.filter((year: { status: string }) => year.status === 'active').length, 1);

  const closed = await request(`/academic-years/${createdYear.data.id}/close`, {
    method: 'POST',
    token: adminToken,
  });
  assert.equal(closed.response.status, 200);
  assert.equal(closed.data.status, 'closed');
  const lockedGradeWrite = await request('/grades/batch', {
    method: 'POST',
    token: adminToken,
    body: {
      classId: integrationClassId,
      className: 'Classe intégration',
      grades: [{
        studentId: integrationStudentId,
        subjectId: integrationSubjectId,
        evaluations: 10,
        composition: 10,
      }],
      term: '1er Trimestre',
    },
  });
  assert.equal(lockedGradeWrite.response.status, 409);
});

test('backup export is sanitized and expired-license reads remain available', async () => {
  const missingLicense = await request('/license/status', { token: adminToken });
  assert.equal(missingLicense.data.state, 'active');
  db.getData().license = null;
  db.persist();
  const noLicenseStatus = await request('/license/status', { token: adminToken });
  assert.equal(noLicenseStatus.data.state, 'missing');
  const exported = await request('/backup/export', { token: adminToken });
  assert.equal(exported.response.status, 200);
  exportedBackup = exported.data;
  assert.equal('license' in exportedBackup, false);
  assert.equal('licenseRenewals' in exportedBackup, false);
  assert.ok(exportedBackup.users.every((user: Record<string, unknown>) => !('passwordHash' in user)));

  db.getData().license = signedLicense(
    '2020-01-01T00:00:00.000Z',
    '2020-02-01T00:00:00.000Z',
    'routes-expired'
  );
  db.persist();
  const status = await request('/license/status', { token: adminToken });
  assert.equal(status.data.state, 'expired');
  const readOnlyExport = await request('/backup/export', { token: adminToken });
  assert.equal(readOnlyExport.response.status, 200);
  const blockedWrite = await request('/academic-years', {
    method: 'POST',
    token: adminToken,
    body: { label: 'New year', startDate: '2027-01-01', endDate: '2027-12-31' },
  });
  assert.equal(blockedWrite.response.status, 402);
});

test('backup dry-run validates all records and restore preserves users, license, and school identity', async () => {
  installActiveLicense();
  const stateBefore = db.getData();
  const invalidBackup = structuredClone(exportedBackup);
  invalidBackup.users.push({
    id: 'injected-admin',
    email: 'attacker@routes.test',
    nom: 'Injected',
    prenom: 'Admin',
    role: 'SUPERADMIN',
    actif: true,
  });
  invalidBackup.grades.push({
    id: 'invalid-grade',
    studentId: 'missing-student',
    subjectId: 'missing-subject',
    subjectName: 'Unknown',
    classId: 'missing-class',
    className: 'Unknown',
    term: '1er Trimestre',
    evaluations: 99,
  });
  const dryRun = await request('/backup/restore', {
    method: 'POST',
    token: adminToken,
    body: { backupData: invalidBackup, dryRun: true },
  });
  assert.equal(dryRun.response.status, 200);
  assert.equal(dryRun.data.valid, false);
  assert.ok(dryRun.data.errors.length >= 2);
  assert.ok(dryRun.data.errors.some((error: string) => error.includes('users')));
  assert.ok(dryRun.data.errors.some((error: string) => error.includes('grades')));
  assert.equal(db.getData().users.length, stateBefore.users.length);

  const brokenReferences = structuredClone(exportedBackup);
  const yearId = brokenReferences.academicYears[0].id;
  brokenReferences.students.push({
    id: 'broken-reference-student',
    matricule: 'BROKEN-1',
    nom: 'Broken',
    prenom: 'Reference',
    sexe: 'M',
    dateNaissance: '01/01/2010',
    statut: true,
    classId: 'missing-class',
    className: 'Missing class',
    academicYearId: yearId,
  });
  brokenReferences.grades.push({
    id: 'broken-reference-grade',
    studentId: 'missing-student',
    subjectId: 'missing-subject',
    subjectName: 'Unknown',
    classId: 'missing-class',
    className: 'Missing class',
    academicYearId: yearId,
    term: '1er Trimestre',
    evaluations: 12,
  });
  const brokenReferenceReport = await request('/backup/restore', {
    method: 'POST',
    token: adminToken,
    body: { backupData: brokenReferences, dryRun: true },
  });
  assert.equal(brokenReferenceReport.data.valid, false);
  assert.ok(brokenReferenceReport.data.errors.some((error: string) => error.includes('classId')));
  assert.ok(brokenReferenceReport.data.errors.some((error: string) => error.includes('studentId')));
  assert.ok(brokenReferenceReport.data.errors.some((error: string) => error.includes('subjectId')));

  const restoreInput = structuredClone(exportedBackup);
  restoreInput.users.push({
    id: 'injected-admin',
    email: 'attacker@routes.test',
    nom: 'Injected',
    prenom: 'Admin',
    role: 'ADMIN',
    actif: true,
  });
  const restore = await request('/backup/restore', {
    method: 'POST',
    token: adminToken,
    body: { backupData: restoreInput },
  });
  assert.equal(restore.response.status, 200);
  assert.equal(db.getData().users.length, stateBefore.users.length);
  assert.equal(db.getData().users.some(user => user.id === 'injected-admin'), false);
  assert.equal(db.getData().license?.payload.licenseId, 'routes-active');
  assert.equal(db.getData().schoolId, stateBefore.schoolId);
});

test('failed restore rolls the in-memory database back', async () => {
  const before = JSON.stringify(db.getData());
  const originalPersist = db.persist.bind(db);
  db.persist = () => { throw new Error('forced persistence failure'); };
  try {
    const response = await request('/backup/restore', {
      method: 'POST',
      token: adminToken,
      body: { backupData: exportedBackup },
    });
    assert.equal(response.response.status, 500);
    assert.equal(JSON.stringify(db.getData()), before);
  } finally {
    db.persist = originalPersist;
  }
});
