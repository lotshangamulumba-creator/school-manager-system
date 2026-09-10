import { db, DbStudent, DbSubject, DbGrade } from './db.js';

export interface ComputedSubjectResult {
  subjectId: string;
  subjectName: string;
  coeff: number;
  specialty: string;
  evaluations: number;
  dev1: number;
  dev2: number;
  composition: number;
  cc: number;
  subjectAvg: number;
  points: number;
  rank: number;
  appreciation: string;
}

export interface ComputedStudentResult {
  student: DbStudent;
  subjectResults: ComputedSubjectResult[];
  totalPoints: number;
  totalCoeff: number;
  generalAvg: number;
  generalRank: number;
  isExAequo?: boolean;
  sciencesAvg: number;
  sciencesRank: number;
  literatureAvg: number;
  literatureRank: number;
  epsAvg: number;
  epsRank: number;
  mention: string;
  decision: string;
}

export function computeCeminaceGrades(evaluations: number, dev1: number, dev2: number, composition: number) {
  const cc = (evaluations + dev1 + dev2) / 3.0;
  const subjectAvg = (cc + 2.0 * composition) / 3.0;
  return {
    cc: Math.round(cc * 100) / 100,
    subjectAvg: Math.round(subjectAvg * 100) / 100
  };
}

export function getMention(avg: number): { mention: string; decision: string } {
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
  const students = data.students.filter(s => s.classId === classId && s.statut);
  const subjects = data.subjects.filter(s => s.statut);

  if (students.length === 0) return [];

  // Map des notes pour recherche rapide : [studentId][subjectId] -> DbGrade
  const gradeMap = new Map<string, DbGrade>();
  data.grades
    .filter(g => g.classId === classId && g.term === term)
    .forEach(g => {
      gradeMap.set(`${g.studentId}_${g.subjectId}`, g);
    });

  // Calcul initial pour chaque élève
  const studentResults: ComputedStudentResult[] = students.map(student => {
    let totalPoints = 0;
    let totalCoeff = 0;
    let sciencesPoints = 0;
    let sciencesCoeff = 0;
    let litPoints = 0;
    let litCoeff = 0;
    let epsPoints = 0;
    let epsCoeff = 0;

    const subjectResults: ComputedSubjectResult[] = subjects.map(subject => {
      const g = gradeMap.get(`${student.id}_${subject.id}`);
      const ev = g ? g.evaluations : 0;
      const d1 = g ? g.dev1 : 0;
      const d2 = g ? g.dev2 : 0;
      const comp = g ? g.composition : 0;

      const { cc, subjectAvg } = computeCeminaceGrades(ev, d1, d2, comp);
      const points = Math.round(subjectAvg * subject.coeff * 100) / 100;

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

      let appreciation = 'Faible';
      if (subjectAvg >= 16) appreciation = 'Excellent';
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
        rank: 1, // sera recalculé
        appreciation
      };
    });

    const generalAvg = totalCoeff > 0 ? Math.round((totalPoints / totalCoeff) * 100) / 100 : 0;
    const sciencesAvg = sciencesCoeff > 0 ? Math.round((sciencesPoints / sciencesCoeff) * 100) / 100 : 0;
    const literatureAvg = litCoeff > 0 ? Math.round((litPoints / litCoeff) * 100) / 100 : 0;
    const epsAvg = epsCoeff > 0 ? Math.round((epsPoints / epsCoeff) * 100) / 100 : 0;
    const { mention, decision } = getMention(generalAvg);

    return {
      student,
      subjectResults,
      totalPoints: Math.round(totalPoints * 100) / 100,
      totalCoeff,
      generalAvg,
      generalRank: 1,
      sciencesAvg,
      sciencesRank: 1,
      literatureAvg,
      literatureRank: 1,
      epsAvg,
      epsRank: 1,
      mention,
      decision
    };
  });

  // Calcul du classement général avec gestion rigoureuse des ex-aequo
  studentResults.sort((a, b) => b.generalAvg - a.generalAvg);
  studentResults.forEach((res, idx) => {
    if (idx === 0) {
      res.generalRank = 1;
    } else {
      const prev = studentResults[idx - 1];
      if (Math.abs(prev.generalAvg - res.generalAvg) < 0.001) {
        res.generalRank = prev.generalRank;
        res.isExAequo = true;
        prev.isExAequo = true;
      } else {
        res.generalRank = idx + 1;
      }
    }
  });

  // Classement par matière
  subjects.forEach(subject => {
    const sortedForSubj = [...studentResults].sort((a, b) => {
      const aSub = a.subjectResults.find(s => s.subjectId === subject.id)?.subjectAvg || 0;
      const bSub = b.subjectResults.find(s => s.subjectId === subject.id)?.subjectAvg || 0;
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
          if (prevSubj && Math.abs(prevSubj.subjectAvg - subjRes.subjectAvg) < 0.001) {
            subjRes.rank = prevSubj.rank;
          } else {
            subjRes.rank = idx + 1;
          }
        }
      }
    });
  });

  return studentResults;
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
    const count = results.length;
    totalStudents += count;

    let classAvg = 0;
    if (count > 0) {
      const sum = results.reduce((acc, r) => acc + r.generalAvg, 0);
      classAvg = Math.round((sum / count) * 100) / 100;
      totalScoreSum += sum;
      totalCoeffSum += count;
    }

    const bestStudent = results[0];
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
