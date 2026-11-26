import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('backend rankings and dashboard stats omit students without valid term grades', (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'monpilot-academic-'));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const databasePath = path.join(directory, 'school.json');
  const source = `
    const { db } = await import('./src/server/db.ts');
    await db.ready;
    const { computeClassResults, computeEstablishmentStats } = await import('./src/server/academic.ts');
    const data = db.getData();
    const classId = data.classes.find(schoolClass => schoolClass.nom === '6ème A').id;
    const academicYearId = data.classes.find(schoolClass => schoolClass.id === classId).academicYearId;
    const now = new Date().toISOString();
    const students = [
      { id: 'TEST-EMPTY', nom: 'EMPTY', prenom: 'No', classId, className: '6ème A' },
      { id: 'TEST-ZERO', nom: 'ZERO', prenom: 'Real', classId, className: '6ème A' },
      { id: 'TEST-GRADED', nom: 'GRADED', prenom: 'Full', classId, className: '6ème A' },
      { id: 'TEST-INVALID', nom: 'INVALID', prenom: 'Invalid', classId, className: '6ème A' }
    ];
    data.students.push(...students.map(student => ({
      ...student,
      academicYearId,
      matricule: student.id,
      sexe: 'M',
      dateNaissance: '01/01/2010',
      statut: true,
      createdAt: now,
      updatedAt: now
    })));
    const makeGrade = (studentId, term, value, evaluations = value) => ({
      id: 'grade-' + studentId + '-' + term,
      studentId,
      subjectId: 'sub-math',
      subjectName: 'Mathématiques',
      classId,
      className: '6ème A',
      academicYearId,
      term,
      evaluations,
      dev1: value,
      dev2: value,
      composition: value,
      createdAt: now,
      updatedAt: now
    });
    data.grades.push(
      makeGrade('TEST-ZERO', '1er Trimestre', 0),
      makeGrade('TEST-GRADED', '1er Trimestre', 20),
      makeGrade('TEST-EMPTY', '2ème Trimestre', 18),
      makeGrade('TEST-INVALID', '1er Trimestre', 20, 21)
    );

    const results = computeClassResults(classId, '1er Trimestre').map(result => ({
      id: result.student.id,
      generalRank: result.generalRank,
      generalAvg: result.generalAvg,
      literatureAvg: result.literatureAvg,
      literatureRank: result.literatureRank,
      subjectCount: result.subjectResults.length
    }));
    const stats = computeEstablishmentStats('1er Trimestre');
    const classStats = stats.classes.find(schoolClass => schoolClass.classId === classId);
    console.log(JSON.stringify({
      results,
      totalStudents: stats.totalStudents,
      classStats,
      activeSubjectCount: data.subjects.filter(subject => subject.statut).length
    }));
  `;
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', source], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      DATABASE_FILE: databasePath,
      JWT_SECRET: 'academic-test-secret',
      NODE_ENV: 'test',
      SEED_ADMIN_EMAIL: 'admin@school.test',
      SEED_ADMIN_PASSWORD: 'SchoolAdminTest-2026!',
      SEED_DEMO_DATA: 'false',
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const computed = JSON.parse(result.stdout.trim()) as {
    results: Array<{
      id: string;
      generalRank: number;
      generalAvg: number;
      literatureAvg: number | null;
      literatureRank: number | null;
      subjectCount: number;
    }>;
    totalStudents: number;
    classStats: { studentCount: number; classAvg: number };
    activeSubjectCount: number;
  };
  assert.deepEqual(computed.results.map((student) => student.id), ['TEST-GRADED', 'TEST-ZERO']);
  assert.equal(computed.results[0].generalRank, 1);
  assert.equal(computed.results[0].generalAvg, 20);
  assert.equal(computed.results[0].literatureAvg, null);
  assert.equal(computed.results[0].literatureRank, null);
  assert.equal(computed.results[0].subjectCount, computed.activeSubjectCount);
  assert.equal(computed.results[1].generalAvg, 0);
  assert.equal(computed.totalStudents, 2);
  assert.equal(computed.classStats.studentCount, 2);
  assert.equal(computed.classStats.classAvg, 10);
});
