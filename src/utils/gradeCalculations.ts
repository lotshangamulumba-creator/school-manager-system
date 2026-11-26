export interface GradeCalculation {
  cc: number | null;
  subjectAvg: number | null;
  isProvisional: boolean;
}

export function computeCeminaceGrades(
  evaluations: number | null,
  dev1: number | null,
  dev2: number | null,
  composition: number | null
): GradeCalculation {
  const continuousAssessment = [evaluations, dev1, dev2].filter((note): note is number => note !== null);
  const rawCc = continuousAssessment.length > 0
    ? continuousAssessment.reduce((sum, note) => sum + note, 0) / continuousAssessment.length
    : null;
  const subjectAvg = composition === null || rawCc === null ? null : (rawCc + 2.0 * composition) / 3.0;
  return {
    cc: rawCc === null ? null : Math.round(rawCc * 100) / 100,
    subjectAvg: subjectAvg === null ? null : Math.round(subjectAvg * 100) / 100,
    isProvisional: [evaluations, dev1, dev2, composition].some(note => note === null),
  };
}
