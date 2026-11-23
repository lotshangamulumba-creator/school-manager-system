import { StudentGrades } from '../types';

export interface BatchGradeInput {
  evalNote: string;
  dev1: string;
  dev2: string;
  comp: string;
}

export function parseBatchGradeInput(input: BatchGradeInput): StudentGrades | null {
  const rawValues = [input.evalNote, input.dev1, input.dev2, input.comp];
  const values = rawValues.map((value) => value.trim());

  if (values.every((value) => value === '')) return null;
  if (values.some((value) => value === '')) {
    throw new Error('renseignez les quatre notes ou laissez toute la ligne vide.');
  }

  const [evaluations, dev1, dev2, composition] = values.map(Number);
  if (
    [evaluations, dev1, dev2, composition].some(
      (value) => !Number.isFinite(value) || value < 0 || value > 20
    )
  ) {
    throw new Error('les notes doivent être des nombres compris entre 0 et 20.');
  }

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
