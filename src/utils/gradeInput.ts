import { StudentGrades } from '../types';

export interface BatchGradeInput {
  evalNote: string;
  dev1: string;
  dev2: string;
  comp: string;
}

export function parseGradeInput(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 20) {
    throw new Error('les notes doivent être des nombres compris entre 0 et 20.');
  }
  return parsed;
}

export function parseBatchGradeInput(input: BatchGradeInput): StudentGrades | null {
  const [evaluations, dev1, dev2, composition] = [
    input.evalNote,
    input.dev1,
    input.dev2,
    input.comp,
  ].map(parseGradeInput);
  if ([evaluations, dev1, dev2, composition].every((value) => value === null)) return null;

  return {
    evaluations,
    dev1,
    dev2,
    composition,
    eval1: evaluations,
    eval2: evaluations,
    dev3: composition,
  };
}
