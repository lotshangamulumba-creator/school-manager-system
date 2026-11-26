import assert from 'node:assert/strict';
import test from 'node:test';
import { parseBatchGradeInput } from './gradeInput';

test('empty batch-grade rows do not create a grade', () => {
  assert.equal(parseBatchGradeInput({ evalNote: '', dev1: ' ', dev2: '', comp: '' }), null);
});

test('every combination of missing marks remains unset instead of becoming zero', () => {
  for (let mask = 1; mask < 15; mask += 1) {
    const values = [0, 1, 2, 3].map((index) => (mask & (1 << index) ? '' : '12'));
    const parsed = parseBatchGradeInput({
      evalNote: values[0],
      dev1: values[1],
      dev2: values[2],
      comp: values[3],
    });
    assert.ok(parsed);
    assert.deepEqual(
      [parsed.evaluations, parsed.dev1, parsed.dev2, parsed.composition],
      values.map((value) => value === '' ? null : 12)
    );
  }
});

test('zero is preserved as a valid batch grade', () => {
  assert.deepEqual(
    parseBatchGradeInput({ evalNote: '0', dev1: '0', dev2: '0', comp: '0' }),
    {
      evaluations: 0,
      dev1: 0,
      dev2: 0,
      composition: 0,
      eval1: 0,
      eval2: 0,
      dev3: 0,
    }
  );
});

test('out-of-range batch grades are rejected', () => {
  assert.throws(
    () => parseBatchGradeInput({ evalNote: '21', dev1: '10', dev2: '10', comp: '10' }),
    /compris entre 0 et 20/
  );
});
