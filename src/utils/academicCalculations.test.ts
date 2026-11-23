import assert from 'node:assert/strict';
import test from 'node:test';
import { Student, StudentGrades, Subject } from '../types';
import {
  calculateClassAverages,
  calculateEstablishmentSpecialtySummary,
  isValidStudentGrade,
} from './academicCalculations';

const students: Student[] = [
  {
    id: 'ungraded',
    firstName: 'No',
    lastName: 'Grades',
    dob: '01/01/2010',
    gender: 'F',
    parentPhone: '',
    className: '6ème A',
  },
  {
    id: 'zero',
    firstName: 'Zero',
    lastName: 'Score',
    dob: '01/01/2010',
    gender: 'M',
    parentPhone: '',
    className: '6ème A',
  },
  {
    id: 'graded',
    firstName: 'Graded',
    lastName: 'Student',
    dob: '01/01/2010',
    gender: 'F',
    parentPhone: '',
    className: '6ème A',
  },
  {
    id: 'literature-only',
    firstName: 'Literature',
    lastName: 'Only',
    dob: '01/01/2010',
    gender: 'F',
    parentPhone: '',
    className: '6ème A',
  },
];

const subjects: Subject[] = [
  { id: 'math', name: 'Mathématiques', coeff: 4, specialty: 'Sciences' },
  { id: 'french', name: 'Français', coeff: 4, specialty: 'Littérature' },
  { id: 'pe', name: 'EPS', coeff: 1, specialty: 'EPS' },
];

function grade(value: number): StudentGrades {
  return {
    evaluations: value,
    dev1: value,
    dev2: value,
    composition: value,
  };
}

const grades = {
  'zero_Mathématiques_1er Trimestre': grade(0),
  'graded_Mathématiques_1er Trimestre': grade(20),
  'literature-only_Français_1er Trimestre': grade(10),
};

test('only students with valid grades in the selected trimester are ranked', () => {
  const results = calculateClassAverages(students, subjects, grades, '6ème A');

  assert.deepEqual(results.map((result) => result.student.id), ['graded', 'literature-only', 'zero']);
  assert.equal(results[0].generalRank, 1);
  assert.equal(results[1].generalRank, 2);
  assert.equal(results[1].generalAvg, 10);
  assert.equal(results[0].literatureAvg, null);
  assert.equal(results[0].literatureRank, null);
  assert.equal(results[0].epsAvg, null);
  assert.equal(results[0].subjectResults.length, 1);
  assert.equal(results[1].sciencesAvg, null);
  assert.equal(results[1].sciencesRank, null);
  assert.equal(results[1].literatureAvg, 10);
  assert.equal(results[1].literatureRank, 1);
  assert.equal(results[2].generalAvg, 0);
  assert.match(results[2].mention, /Faible/);
});

test('zero is a valid grade and grades from another trimester are not carried forward', () => {
  assert.equal(isValidStudentGrade(grade(0)), true);
  assert.equal(isValidStudentGrade(grade(21)), false);
  assert.deepEqual(
    calculateClassAverages(
      students,
      subjects,
      { 'graded_Mathématiques': grade(18) },
      '6ème A',
      '2ème Trimestre'
    ),
    []
  );
});

test('establishment specialty statistics count only students with real grades', () => {
  const stats = calculateEstablishmentSpecialtySummary(
    students,
    grades,
    '6ème A',
    'Collège',
    subjects,
    '1er Trimestre'
  );
  const classStats = stats.levels
    .find((level) => level.level === 'Collège')!
    .classes.find((schoolClass) => schoolClass.className === '6ème A')!;

  assert.equal(stats.totalStudents, 3);
  assert.equal(classStats.studentCount, 3);
  assert.equal(stats.sciencesStudentCount, 2);
  assert.equal(stats.sciencesAvg, 10);
  assert.equal(stats.literatureStudentCount, 1);
  assert.equal(stats.literatureAvg, 10);

  const noGrades = calculateEstablishmentSpecialtySummary(
    students,
    {},
    '6ème A',
    'Collège',
    subjects,
    '1er Trimestre'
  );
  assert.equal(noGrades.totalStudents, 0);
  assert.equal(noGrades.levels.flatMap((level) => level.classes).every((item) => item.studentCount === 0), true);
});
