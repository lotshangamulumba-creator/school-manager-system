import { db, DbStudent, DbSubject, DbGrade } from './db.js';
import { computeCeminaceGrades } from '../utils/gradeCalculations.js';
export { computeCeminaceGrades } from '../utils/gradeCalculations.js';

export interface ComputedSubjectResult {
  subjectId: string;
  subjectName: string;
  coeff: number;
  specialty: string;
  evaluations: number | null;
  dev1: number | null;
  dev2: number | null;
  composition: number | null;
  cc: number | null;
  subjectAvg: number | null;
  points: number | null;
  rank: number | null;
  isProvisional: boolean;
  appreciation: string;
}

export interface ComputedStudentResult {
  student: DbStudent;
  subjectResults: ComputedSubjectResult[];
  totalPoints: number;
  totalCoeff: number;
  generalAvg: number | null;
  generalRank: number | null;
  isProvisional: boolean;
  isExAequo?: boolean;
  sciencesAvg: number | null;
  sciencesRank: number | null;
  literatureAvg: number | null;
  literatureRank: number | null;
  epsAvg: number | null;
  epsRank: number | null;
  mention: string;
  decision: string;
}

export function getMention(avg: number | null): { mention: string; decision: string } {
  if (avg === null) return { mention: 'Provisoire', decision: 'Résultats en attente de notes' };
  if (avg >= 16) return { mention: 'Très Bien', decision: 'Félicitations du Conseil de Classe' };
  if (avg >= 14) return { mention: 'Bien', decision: 'Tableau d’Honneur' };
  if (avg >= 12) return { mention: 'Assez Bien', decision: 'Encouragements' };
  if (avg >= 10) return { mention: 'Passable', decision: 'Admis(e) / Poursuivre les efforts' };
  if (avg >= 8) return { mention: 'Insuffisant', decision: 'Avertissement Travail' };
  return { mention: 'Médiocre', decision: 'Blâme Travail / Risque de redoublement' };
}

export function computeClassResults(
  classId: string,
  term: '1er Trimestre' | '2ème Trimestre' | '3ème Trimestre' = '1er Trimestre'
): ComputedStudentResult[] {
  const data = db.getData();
  const schoolClass = data.classes.find(candidate => candidate.id === classId);
  if (!schoolClass) return [];
  const students = data.students.filter(
    student => student.classId === classId && student.academicYearId === schoolClass.academicYearId && student.statut
  );
  const subjects = data.subjects.filter(s => s.statut);

  if (students.length === 0) return [];

  // Map des notes pour recherche rapide : [studentId][subjectId] -> DbGrade valide.
  const gradeMap = new Map<string, DbGrade>();
  data.grades
    .filter(g =>
      g.classId === classId &&
      g.academicYearId === schoolClass.academicYearId &&
      g.term === term &&
      [g.evaluations, g.dev1, g.dev2, g.composition].every(
        note => note === null || (Number.isFinite(note) && note >= 0 && note <= 20)
      )
    )
    .forEach(g => {
      gradeMap.set(`${g.studentId}_${g.subjectId}`, g);
    });

  const studentResults: ComputedStudentResult[] = students.flatMap(student => {
    let totalPoints = 0;
    let totalCoeff = 0;
    let sciencesPoints = 0;
    let sciencesCoeff = 0;
    let litPoints = 0;
    let litCoeff = 0;
    let epsPoints = 0;
    let epsCoeff = 0;

    let hasAnyGrade = false;
    let isProvisional = false;
    const subjectResults: ComputedSubjectResult[] = subjects.map(subject => {
      const g = gradeMap.get(`${student.id}_${subject.id}`);
      const ev = g?.evaluations ?? null;
      const d1 = g?.dev1 ?? null;
      const d2 = g?.dev2 ?? null;
      const comp = g?.composition ?? null;
      if (ev !== null || d1 !== null || d2 !== null || comp !== null) hasAnyGrade = true;
      const { cc, subjectAvg, isProvisional: isSubjectProvisional } = computeCeminaceGrades(ev, d1, d2, comp);
      isProvisional ||= isSubjectProvisional;
      const points = subjectAvg === null ? null : Math.round(subjectAvg * subject.coeff * 100) / 100;

      if (points !== null) {
        totalPoints += points;
        totalCoeff += subject.coeff;

        if (subject.specialty === 'Sciences') {
          sciencesPoints += points;
          sciencesCoeff += subject.coeff;
        } else if (subject.specialty === 'Littérature') {
          litPoints += points;
          litCoeff += subject.coeff;
        } else if (subject.specialty === 'EPS') {
          epsPoints += points;
          epsCoeff += subject.coeff;
        }
      }

      let appreciation = 'Faible';
      if (subjectAvg === null) appreciation = 'Provisoire';
      else if (subjectAvg >= 16) appreciation = 'Excellent';
      else if (subjectAvg >= 14) appreciation = 'Très Bon';
      else if (subjectAvg >= 12) appreciation = 'Bon travail';
      else if (subjectAvg >= 10) appreciation = 'Passable';

      return {
        subjectId: subject.id,
        subjectName: subject.nom,
        coeff: subject.coeff,
        specialty: subject.specialty,
        evaluations: ev,
        dev1: d1,
        dev2: d2,
        composition: comp,
        cc,
        subjectAvg,
        points,
        rank: null,
        isProvisional: isSubjectProvisional,
        appreciation,
      };
    });

    if (!hasAnyGrade) return [];
    const generalAvg = totalCoeff > 0 ? Math.round((totalPoints / totalCoeff) * 100) / 100 : null;

    const sciencesAvg = sciencesCoeff > 0 ? Math.round((sciencesPoints / sciencesCoeff) * 100) / 100 : null;
    const literatureAvg = litCoeff > 0 ? Math.round((litPoints / litCoeff) * 100) / 100 : null;
    const epsAvg = epsCoeff > 0 ? Math.round((epsPoints / epsCoeff) * 100) / 100 : null;
    const { mention, decision } = getMention(generalAvg);

    return {
      student,
      subjectResults,
      totalPoints: Math.round(totalPoints * 100) / 100,
      totalCoeff,
      generalAvg,
      generalRank: null,
      isProvisional,
      sciencesAvg,
      sciencesRank: null,
      literatureAvg,
      literatureRank: null,
      epsAvg,
      epsRank: null,
      mention,
      decision
    };
  });

  // Calcul du classement général avec gestion rigoureuse des ex-aequo
  const rankableStudents = studentResults
    .filter(result => result.generalAvg !== null)
    .sort((a, b) => (b.generalAvg ?? 0) - (a.generalAvg ?? 0));
  rankableStudents.forEach((res, idx) => {
    if (idx === 0) {
      res.generalRank = 1;
    } else {
      const prev = rankableStudents[idx - 1];
      if (Math.abs((prev.generalAvg ?? 0) - (res.generalAvg ?? 0)) < 0.001) {
        res.generalRank = prev.generalRank;
        res.isExAequo = true;
        prev.isExAequo = true;
      } else {
        res.generalRank = idx + 1;
      }
    }
  });

  const assignSpecialtyRanks = (
    getAverage: (result: ComputedStudentResult) => number | null,
    setRank: (result: ComputedStudentResult, rank: number) => void
  ) => {
    studentResults
      .filter(result => getAverage(result) !== null)
      .sort((a, b) => (getAverage(b) ?? 0) - (getAverage(a) ?? 0))
      .forEach((result, index) => setRank(result, index + 1));
  };
  assignSpecialtyRanks((result) => result.sciencesAvg, (result, rank) => { result.sciencesRank = rank; });
  assignSpecialtyRanks((result) => result.literatureAvg, (result, rank) => { result.literatureRank = rank; });
  assignSpecialtyRanks((result) => result.epsAvg, (result, rank) => { result.epsRank = rank; });

  // Classement par matière
  subjects.forEach(subject => {
    const sortedForSubj = studentResults
      .filter(result => result.subjectResults.some(subjectResult => subjectResult.subjectId === subject.id && subjectResult.subjectAvg !== null))
      .sort((a, b) => {
      const aSub = a.subjectResults.find(s => s.subjectId === subject.id)?.subjectAvg ?? 0;
      const bSub = b.subjectResults.find(s => s.subjectId === subject.id)?.subjectAvg ?? 0;
      return bSub - aSub;
    });

    sortedForSubj.forEach((sr, idx) => {
      const subjRes = sr.subjectResults.find(s => s.subjectId === subject.id);
      if (subjRes) {
        if (idx === 0) {
          subjRes.rank = 1;
        } else {
          const prevSr = sortedForSubj[idx - 1];
          const prevSubj = prevSr.subjectResults.find(s => s.subjectId === subject.id);
          if (prevSubj && prevSubj.subjectAvg !== null && subjRes.subjectAvg !== null &&
              Math.abs(prevSubj.subjectAvg - subjRes.subjectAvg) < 0.001) {
            subjRes.rank = prevSubj.rank;
          } else {
            subjRes.rank = idx + 1;
          }
        }
      }
    });
  });

  return studentResults.sort((a, b) => {
    if (a.generalAvg === null) return b.generalAvg === null ? 0 : 1;
    if (b.generalAvg === null) return -1;
    return b.generalAvg - a.generalAvg;
  });
}

export function computeEstablishmentStats(term: '1er Trimestre' | '2ème Trimestre' | '3ème Trimestre' = '1er Trimestre') {
  const data = db.getData();
  const classes = data.classes.filter(c => c.statut);
  
  let totalStudents = 0;
  let totalScoreSum = 0;
  let totalCoeffSum = 0;
  const classStats: any[] = [];

  for (const cls of classes) {
    const results = computeClassResults(cls.id, term);
    const gradedResults = results.filter(result => result.generalAvg !== null);
    const count = gradedResults.length;
    totalStudents += count;

    let classAvg = 0;
    if (count > 0) {
      const sum = gradedResults.reduce((acc, result) => acc + (result.generalAvg ?? 0), 0);
      classAvg = Math.round((sum / count) * 100) / 100;
      totalScoreSum += sum;
      totalCoeffSum += count;
    }

    const bestStudent = gradedResults[0];
    classStats.push({
      classId: cls.id,
      className: cls.nom,
      niveau: cls.niveau,
      studentCount: count,
      classAvg,
      bestStudent: bestStudent ? `${bestStudent.student.prenom} ${bestStudent.student.nom} (${bestStudent.generalAvg}/20)` : '-'
    });
  }

  const globalAvg = totalCoeffSum > 0 ? Math.round((totalScoreSum / totalCoeffSum) * 100) / 100 : 0;

  return {
    term,
    establishmentName: data.establishmentName,
    city: data.establishmentCity,
    totalStudents,
    totalTeachers: data.teachers.length,
    totalClasses: classes.length,
    totalSubjects: data.subjects.length,
    globalAvg,
    classes: classStats
  };
}
