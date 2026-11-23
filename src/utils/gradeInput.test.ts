import assert from 'node:assert/strict';
import test from 'node:test';
import { parseBatchGradeInput } from './gradeInput';

test('empty batch-grade rows do not create a grade', () => {
  assert.equal(parseBatchGradeInput({ evalNote: '', dev1: ' ', dev2: '', comp: '' }), null);
});

test('partially completed batch-grade rows are rejected', () => {
  assert.throws(
    () => parseBatchGradeInput({ evalNote: '12', dev1: '', dev2: '10', comp: '14' }),
    /renseignez les quatre notes/
  );
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
