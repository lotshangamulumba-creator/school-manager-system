import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

function initializeSchoolDatabase(databasePath: string, schoolName?: string) {
  const source = `
    const { db } = await import('./src/server/db.ts');
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
