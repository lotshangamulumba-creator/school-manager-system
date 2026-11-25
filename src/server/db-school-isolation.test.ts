import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

function initializeSchoolDatabase(databasePath: string, schoolName?: string) {
  const source = `
    const { db } = await import('./src/server/db.ts');
    await db.ready;
    if (process.env.TEST_SCHOOL_NAME) {
      db.getData().schoolProfile.schoolName = process.env.TEST_SCHOOL_NAME;
      db.getData().establishmentName = process.env.TEST_SCHOOL_NAME;
      db.persist();
    }
    console.log(JSON.stringify({
      schoolId: db.getData().schoolId,
      schoolName: db.getData().schoolProfile.schoolName,
      students: db.getData().students.length,
      teachers: db.getData().teachers.length,
      users: db.getData().users.length
    }));
  `;
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', source], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      DATABASE_FILE: databasePath,
      JWT_SECRET: 'isolated-database-test-secret',
      NODE_ENV: 'test',
      SEED_ADMIN_EMAIL: 'admin@school.test',
      SEED_ADMIN_PASSWORD: 'SchoolAdminTest-2026!',
      SEED_DEMO_DATA: 'false',
      TEST_SCHOOL_NAME: schoolName || '',
    },
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout.trim()) as {
    schoolId: string;
    schoolName: string;
    students: number;
    teachers: number;
    users: number;
  };
}

test('new DATABASE_FILE installations receive independent, non-demo school data', (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monpilot-school-db-'));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  const schoolA = initializeSchoolDatabase(path.join(directory, 'school-a.json'), 'School A');
  const schoolB = initializeSchoolDatabase(path.join(directory, 'school-b.json'));

  assert.notEqual(schoolA.schoolId, schoolB.schoolId);
  assert.equal(schoolA.schoolName, 'School A');
  assert.equal(schoolB.schoolName, 'Complexe Scolaire Privé CEMINACE');
  assert.equal(schoolA.students, 0);
  assert.equal(schoolA.teachers, 0);
  assert.equal(schoolA.users, 1);
  assert.equal(schoolB.students, 0);
});

test('legacy databases receive server-backed subjects for levels missing them', (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monpilot-subject-migration-'));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const databasePath = path.join(directory, 'school.json');
  initializeSchoolDatabase(databasePath);

  const legacyData = JSON.parse(fs.readFileSync(databasePath, 'utf8'));
  legacyData.version = 1;
  legacyData.subjects = legacyData.subjects.filter((subject: { niveau: string }) => subject.niveau === 'Collège');
  fs.writeFileSync(databasePath, JSON.stringify(legacyData), 'utf8');

  const source = `
    const { db } = await import('./src/server/db.ts');
    await db.ready;
    const data = db.getData();
    console.log(JSON.stringify({
      version: data.version,
      lycee: data.subjects.filter(subject => subject.niveau === 'Lycée' && subject.statut),
      primaire: data.subjects.filter(subject => subject.niveau === 'Primaire' && subject.statut)
    }));
  `;
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', source], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      DATABASE_FILE: databasePath,
      JWT_SECRET: 'subject-migration-test-secret',
      NODE_ENV: 'test',
      SEED_ADMIN_EMAIL: 'admin@school.test',
      SEED_ADMIN_PASSWORD: 'SchoolAdminTest-2026!',
      SEED_DEMO_DATA: 'false',
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const migrated = JSON.parse(result.stdout.trim()) as {
    version: number;
    lycee: Array<{ id: string }>;
    primaire: Array<{ id: string }>;
  };
  assert.equal(migrated.version, 3);
  assert.ok(migrated.lycee.length > 0);
  assert.ok(migrated.primaire.length > 0);
  assert.ok(migrated.lycee.every((subject) => subject.id !== 'l1'));
});
