import assert from 'node:assert/strict';
import test from 'node:test';
import { computeCeminaceGrades } from './gradeCalculations';

test('every combination of missing marks keeps the average null and marks results provisional', () => {
  const completeMarks: number[] = [5, 10, 15, 20];
  for (let mask = 0; mask < 16; mask += 1) {
    const marks = completeMarks.map((mark, index) => mask & (1 << index) ? null : mark);
    const result = computeCeminaceGrades(marks[0], marks[1], marks[2], marks[3]);
    const continuous = marks.slice(0, 3).filter((mark): mark is number => mark !== null);
    const expectedAverage = marks[3] === null || continuous.length === 0
      ? null
      : Math.round((((continuous.reduce((sum, mark) => sum + mark, 0) / continuous.length) + 2 * marks[3]) / 3) * 100) / 100;
    assert.equal(result.subjectAvg, expectedAverage, `mask ${mask}`);
    assert.equal(result.isProvisional, mask !== 0, `mask ${mask}`);
  }
});

test('a complete subject grade is final and zero remains a valid mark', () => {
  assert.deepEqual(computeCeminaceGrades(0, 0, 0, 0), {
    cc: 0,
    subjectAvg: 0,
    isProvisional: false,
  });
});
