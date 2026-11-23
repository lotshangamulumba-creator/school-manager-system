import {
  Student,
  Subject,
  StudentGrades,
  StudentTrimesterResult,
  SubjectResult,
  SchoolLevel,
  ClassSpecialtyStat,
  LevelSpecialtyStat,
  EstablishmentSpecialtyStat,
} from '../types';
import { getCeminaceMention, CEMINACE_LEVELS } from '../data/ceminaceDefaults';

export function isValidStudentGrade(grades: Partial<StudentGrades> | undefined): boolean {
  if (!grades) return false;

  const evaluations =
    grades.evaluations ??
    (grades.eval1 !== undefined || grades.eval2 !== undefined
      ? ((grades.eval1 ?? 0) + (grades.eval2 ?? grades.eval1 ?? 0)) / 2
      : undefined);
  const values = [evaluations, grades.dev1, grades.dev2, grades.composition ?? grades.dev3];

  return values.every(
    (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 20
  );
}

export function calculateClassAverages(
  students: Student[],
  subjects: Subject[],
  gradesMap: Record<string, StudentGrades>,
  currentClass: string,
  trimester: string = '1er Trimestre'
): StudentTrimesterResult[] {
  const classStudents = students.filter((s) => s.className === currentClass);
  if (classStudents.length === 0 || subjects.length === 0) return [];

  type SubjectCalculation = {
    evalAvg: number;
    dev1: number;
    dev2: number;
    devAvg: number;
    composition: number;
    subjectAvg: number;
    points: number;
  };
  const studentSubjectMap: Record<string, Record<string, SubjectCalculation>> = {};

  classStudents.forEach((student) => {
    studentSubjectMap[student.id] = {};
    subjects.forEach((sub) => {
      const g =
        gradesMap[`${student.id}_${sub.name}_${trimester}`] ||
        (trimester === '1er Trimestre' ? gradesMap[`${student.id}_${sub.name}`] : undefined);
      if (!g || !isValidStudentGrade(g)) return;

      const evalAvg =
        g.evaluations !== undefined
          ? g.evaluations
          : Number((((g.eval1 ?? 0) + (g.eval2 ?? 0)) / 2).toFixed(2));

      const d1 = g.dev1 !== undefined ? g.dev1 : 0;
      const d2 = g.dev2 !== undefined ? g.dev2 : 0;
      const devAvg = Number(((d1 + d2) / 2).toFixed(2));

      const comp =
        g.composition !== undefined ? g.composition : g.dev3 !== undefined ? g.dev3 : 0;

      // Formule Officielle CEMINACE (Congo Brazzaville) :
      // - Contrôle Continu (CC) = (Note Évaluations + Devoir 1 + Devoir 2) / 3
      // - Moyenne Trimestrielle = (CC + 2 * COMPOSITION) / 3
      const cc = (evalAvg + d1 + d2) / 3;
      const subjectAvg = Number(((cc + 2 * comp) / 3).toFixed(2));
      const points = Number((subjectAvg * sub.coeff).toFixed(2));

      studentSubjectMap[student.id][sub.name] = {
        evalAvg,
        dev1: d1,
        dev2: d2,
        devAvg,
        composition: comp,
        subjectAvg,
        points,
      };
    });
  });

  const subjectRanks: Record<string, Record<string, number>> = {};
  const subjectCohorts: Record<string, number> = {};
  subjects.forEach((sub) => {
    const gradedStudents = classStudents.filter((student) => studentSubjectMap[student.id]?.[sub.name]);
    const sorted = gradedStudents.sort((a, b) => {
      const avgA = studentSubjectMap[a.id][sub.name].subjectAvg;
      const avgB = studentSubjectMap[b.id][sub.name].subjectAvg;
      return avgB - avgA;
    });

    subjectRanks[sub.name] = {};
    subjectCohorts[sub.name] = sorted.length;
    sorted.forEach((student, index) => {
      subjectRanks[sub.name][student.id] = index + 1;
    });
  });

  const interimResults: Array<{
    student: Student;
    subjectResults: SubjectResult[];
    totalPoints: number;
    totalCoeff: number;
    generalAvg: number;
    sciencesAvg: number | null;
    literatureAvg: number | null;
    epsAvg: number | null;
  }> = classStudents.flatMap((student) => {
    let totalPoints = 0;
    let totalCoeff = 0;

    let sciPoints = 0;
    let sciCoeff = 0;

    let litPoints = 0;
    let litCoeff = 0;

    let epsPoints = 0;
    let epsCoeff = 0;

    const subjectResults: SubjectResult[] = subjects.flatMap((sub) => {
      const calc = studentSubjectMap[student.id][sub.name];
      if (!calc) return [];

      totalPoints += calc.points;
      totalCoeff += sub.coeff;

      if (sub.specialty === 'Sciences') {
        sciPoints += calc.points;
        sciCoeff += sub.coeff;
      } else if (sub.specialty === 'Littérature') {
        litPoints += calc.points;
        litCoeff += sub.coeff;
      } else if (sub.specialty === 'EPS') {
        epsPoints += calc.points;
        epsCoeff += sub.coeff;
      }

      let appreciation = 'Passable';
      if (calc.subjectAvg >= 16) appreciation = 'Très Bien';
      else if (calc.subjectAvg >= 14) appreciation = 'Bien';
      else if (calc.subjectAvg >= 12) appreciation = 'Assez Bien';
      else if (calc.subjectAvg >= 10) appreciation = 'Passable';
      else if (calc.subjectAvg >= 8) appreciation = 'Insuffisant';
      else appreciation = 'Faible';

      return {
        subjectName: sub.name,
        coeff: sub.coeff,
        specialty: sub.specialty,
        evalAvg: calc.evalAvg,
        dev1: calc.dev1,
        dev2: calc.dev2,
        devAvg: calc.devAvg,
        composition: calc.composition,
        subjectAvg: calc.subjectAvg,
        points: calc.points,
        rank: subjectRanks[sub.name][student.id],
        rankedStudentCount: subjectCohorts[sub.name],
        appreciation,
      };
    });

    if (subjectResults.length === 0) return [];

    const generalAvg = totalCoeff > 0 ? Number((totalPoints / totalCoeff).toFixed(2)) : 0;
    const sciencesAvg = sciCoeff > 0 ? Number((sciPoints / sciCoeff).toFixed(2)) : null;
    const literatureAvg = litCoeff > 0 ? Number((litPoints / litCoeff).toFixed(2)) : null;
    const epsAvg = epsCoeff > 0 ? Number((epsPoints / epsCoeff).toFixed(2)) : null;

    return {
      student,
      subjectResults,
      totalPoints: Number(totalPoints.toFixed(2)),
      totalCoeff,
      generalAvg,
      sciencesAvg,
      literatureAvg,
      epsAvg,
    };
  });

  const specialtyRanks = (getAverage: (item: (typeof interimResults)[number]) => number | null) => {
    const ranks: Record<string, number> = {};
    interimResults
      .filter((item) => getAverage(item) !== null)
      .sort((a, b) => (getAverage(b) ?? 0) - (getAverage(a) ?? 0))
      .forEach((item, index) => {
        ranks[item.student.id] = index + 1;
      });
    return ranks;
  };
  const sciRanks = specialtyRanks((item) => item.sciencesAvg);
  const litRanks = specialtyRanks((item) => item.literatureAvg);
  const epsRanks = specialtyRanks((item) => item.epsAvg);

  const sortedGeneral = [...interimResults].sort((a, b) => b.generalAvg - a.generalAvg);
  const genRanks: Record<string, number> = {};
  sortedGeneral.forEach((item, idx) => {
    genRanks[item.student.id] = idx + 1;
  });

  // Build final result array sorted by general rank
  return sortedGeneral.map((item) => {
    const sId = item.student.id;
    return {
      student: item.student,
      subjectResults: item.subjectResults,
      totalPoints: item.totalPoints,
      totalCoeff: item.totalCoeff,
      generalAvg: item.generalAvg,
      generalRank: genRanks[sId],
      sciencesAvg: item.sciencesAvg,
      sciencesRank: sciRanks[sId] ?? null,
      sciencesStudentCount: Object.keys(sciRanks).length,
      literatureAvg: item.literatureAvg,
      literatureRank: litRanks[sId] ?? null,
      literatureStudentCount: Object.keys(litRanks).length,
      epsAvg: item.epsAvg,
      epsRank: epsRanks[sId] ?? null,
      epsStudentCount: Object.keys(epsRanks).length,
      mention: getCeminaceMention(item.generalAvg),
    };
  });
}

/**
 * Calcule le TOTAL GÉNÉRAL consolidé par niveau et par spécialité pour chaque classe
 */
export function calculateEstablishmentSpecialtySummary(
  allStudents: Student[],
  gradesMap: Record<string, StudentGrades>,
  currentClass: string,
  currentLevel: SchoolLevel,
  currentSubjects: Subject[],
  trimester: string
): EstablishmentSpecialtyStat {
  const levelsOrder: SchoolLevel[] = ['Primaire', 'Collège', 'Lycée'];

  const levelStats: LevelSpecialtyStat[] = levelsOrder.map((lvl) => {
    const levelConf = CEMINACE_LEVELS[lvl];
    const lvlSubjects = lvl === currentLevel ? currentSubjects : levelConf.defaultSubjects;

    const classStats: ClassSpecialtyStat[] = levelConf.classes.map((cls) => {
      const results = calculateClassAverages(allStudents, lvlSubjects, gradesMap, cls, trimester);
      const count = results.length;
      const average = (select: (result: StudentTrimesterResult) => number | null) => {
        const values = results.map(select).filter((value): value is number => value !== null);
        return {
          average:
            values.length > 0
              ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2))
              : null,
          studentCount: values.length,
        };
      };
      const sciences = average((result) => result.sciencesAvg);
      const literature = average((result) => result.literatureAvg);
      const eps = average((result) => result.epsAvg);
      const best = results[0];

      return {
        level: lvl,
        className: cls,
        studentCount: count,
        sciencesAvg: sciences.average,
        sciencesStudentCount: sciences.studentCount,
        literatureAvg: literature.average,
        literatureStudentCount: literature.studentCount,
        epsAvg: eps.average,
        epsStudentCount: eps.studentCount,
        generalAvg: average((result) => result.generalAvg).average ?? 0,
        bestStudentName: best ? `${best.student.lastName.toUpperCase()} ${best.student.firstName}` : '-',
        bestStudentAvg: best ? best.generalAvg : 0,
      };
    });

    const totalStudents = classStats.reduce((acc, c) => acc + c.studentCount, 0);
    const weightedSpecialty = (
      averageKey: 'sciencesAvg' | 'literatureAvg' | 'epsAvg',
      countKey: 'sciencesStudentCount' | 'literatureStudentCount' | 'epsStudentCount'
    ) => {
      const studentCount = classStats.reduce((sum, cls) => sum + cls[countKey], 0);
      const points = classStats.reduce(
        (sum, cls) => sum + (cls[averageKey] ?? 0) * cls[countKey],
        0
      );
      return {
        average: studentCount > 0 ? Number((points / studentCount).toFixed(2)) : null,
        studentCount,
      };
    };
    const sciences = weightedSpecialty('sciencesAvg', 'sciencesStudentCount');
    const literature = weightedSpecialty('literatureAvg', 'literatureStudentCount');
    const eps = weightedSpecialty('epsAvg', 'epsStudentCount');
    const weightedGen = classStats.reduce((acc, c) => acc + c.generalAvg * c.studentCount, 0);

    return {
      level: lvl,
      totalStudents,
      classesCount: classStats.length,
      sciencesAvg: sciences.average,
      sciencesStudentCount: sciences.studentCount,
      literatureAvg: literature.average,
      literatureStudentCount: literature.studentCount,
      epsAvg: eps.average,
      epsStudentCount: eps.studentCount,
      generalAvg: totalStudents > 0 ? Number((weightedGen / totalStudents).toFixed(2)) : 0,
      classes: classStats,
    };
  });

  const grandTotalStudents = levelStats.reduce((acc, l) => acc + l.totalStudents, 0);
  const grandTotalClasses = levelStats.reduce((acc, l) => acc + l.classesCount, 0);
  const grandWeightedSpecialty = (
    averageKey: 'sciencesAvg' | 'literatureAvg' | 'epsAvg',
    countKey: 'sciencesStudentCount' | 'literatureStudentCount' | 'epsStudentCount'
  ) => {
    const studentCount = levelStats.reduce((sum, level) => sum + level[countKey], 0);
    const points = levelStats.reduce(
      (sum, level) => sum + (level[averageKey] ?? 0) * level[countKey],
      0
    );
    return {
      average: studentCount > 0 ? Number((points / studentCount).toFixed(2)) : null,
      studentCount,
    };
  };
  const sciences = grandWeightedSpecialty('sciencesAvg', 'sciencesStudentCount');
  const literature = grandWeightedSpecialty('literatureAvg', 'literatureStudentCount');
  const eps = grandWeightedSpecialty('epsAvg', 'epsStudentCount');
  const grandWeightedGen = levelStats.reduce((acc, l) => acc + l.generalAvg * l.totalStudents, 0);

  return {
    trimester,
    totalStudents: grandTotalStudents,
    totalClasses: grandTotalClasses,
    sciencesAvg: sciences.average,
    sciencesStudentCount: sciences.studentCount,
    literatureAvg: literature.average,
    literatureStudentCount: literature.studentCount,
    epsAvg: eps.average,
    epsStudentCount: eps.studentCount,
    generalAvg: grandTotalStudents > 0 ? Number((grandWeightedGen / grandTotalStudents).toFixed(2)) : 0,
    levels: levelStats,
  };
}
