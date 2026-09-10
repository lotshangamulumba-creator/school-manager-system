import { SchoolLevel, Subject, Student, StudentGrades } from '../types';

export const CEMINACE_LEVELS: Record<
  SchoolLevel,
  {
    classes: string[];
    defaultSubjects: Subject[];
  }
> = {
  Primaire: {
    classes: ['CP1', 'CP2', 'CE1', 'CE2', 'CM1', 'CM2'],
    defaultSubjects: [
      { id: 'p1', name: 'Français', coeff: 3, specialty: 'Littérature' },
      { id: 'p2', name: 'Mathématiques', coeff: 3, specialty: 'Sciences' },
      { id: 'p3', name: 'Éveil / Sciences', coeff: 2, specialty: 'Sciences' },
      { id: 'p4', name: 'Histoire-Géographie', coeff: 1, specialty: 'Littérature' },
      { id: 'p5', name: 'EPS', coeff: 1, specialty: 'EPS' },
    ],
  },
  Collège: {
    classes: ['6ème A', '6ème B', '5ème A', '5ème B', '4ème A', '4ème B', '3ème A', '3ème B'],
    defaultSubjects: [
      { id: 'c1', name: 'Français', coeff: 4, specialty: 'Littérature' },
      { id: 'c2', name: 'Mathématiques', coeff: 4, specialty: 'Sciences' },
      { id: 'c3', name: 'Sciences Physiques', coeff: 2, specialty: 'Sciences' },
      { id: 'c4', name: 'SVT', coeff: 2, specialty: 'Sciences' },
      { id: 'c5', name: 'Anglais', coeff: 2, specialty: 'Littérature' },
      { id: 'c6', name: 'Histoire-Géographie', coeff: 2, specialty: 'Littérature' },
      { id: 'c7', name: 'EPS', coeff: 1, specialty: 'EPS' },
    ],
  },
  Lycée: {
    classes: ['Seconde A', 'Seconde C', 'Première A4', 'Première D', 'Terminale A4', 'Terminale D', 'Terminale C'],
    defaultSubjects: [
      { id: 'l1', name: 'Français', coeff: 4, specialty: 'Littérature' },
      { id: 'l2', name: 'Philosophie', coeff: 3, specialty: 'Littérature' },
      { id: 'l3', name: 'Mathématiques', coeff: 5, specialty: 'Sciences' },
      { id: 'l4', name: 'Sciences Physiques', coeff: 4, specialty: 'Sciences' },
      { id: 'l5', name: 'SVT', coeff: 3, specialty: 'Sciences' },
      { id: 'l6', name: 'Anglais', coeff: 2, specialty: 'Littérature' },
      { id: 'l7', name: 'Histoire-Géographie', coeff: 2, specialty: 'Littérature' },
      { id: 'l8', name: 'EPS', coeff: 2, specialty: 'EPS' },
    ],
  },
};

export const INITIAL_STUDENTS: Student[] = [
  {
    id: 'CEM-001',
    firstName: 'Grace',
    lastName: 'Moukoko',
    dob: '12/04/2010',
    gender: 'F',
    parentPhone: '+242 06 654 32 10',
    className: '6ème A',
  },
  {
    id: 'CEM-002',
    firstName: 'Christian',
    lastName: 'Ngoma',
    dob: '25/08/2009',
    gender: 'M',
    parentPhone: '+242 05 512 88 44',
    className: '6ème A',
  },
  {
    id: 'CEM-003',
    firstName: 'Aurelie',
    lastName: 'Makosso',
    dob: '03/11/2010',
    gender: 'F',
    parentPhone: '+242 06 901 22 77',
    className: '6ème A',
  },
  {
    id: 'CEM-004',
    firstName: 'Kevin',
    lastName: 'Samba',
    dob: '17/01/2009',
    gender: 'M',
    parentPhone: '+242 04 433 19 80',
    className: '6ème A',
  },
  {
    id: 'CEM-005',
    firstName: 'Priscille',
    lastName: 'Loubaki',
    dob: '09/06/2010',
    gender: 'F',
    parentPhone: '+242 06 720 11 05',
    className: '6ème A',
  },
  {
    id: 'CEM-006',
    firstName: 'Arnaud',
    lastName: 'Mpassi',
    dob: '22/12/2009',
    gender: 'M',
    parentPhone: '+242 05 609 45 33',
    className: '6ème A',
  },
];

export function generateInitialGrades(
  students: Student[],
  subjects: Subject[]
): Record<string, StudentGrades> {
  const map: Record<string, StudentGrades> = {};
  const trimesters = ['1er Trimestre', '2ème Trimestre', '3ème Trimestre'];

  students.forEach((s, idx) => {
    subjects.forEach((sub) => {
      trimesters.forEach((trim, tIdx) => {
        // Variation réaliste par trimestre (progression ou fluctuation trimestrielle)
        const trimShift = (tIdx - 1) * 0.4;
        const base = 10.5 + ((idx * 1.7 + sub.name.length * 0.9 + tIdx * 1.3) % 7.8) + trimShift;
        const evaluations = Number(Math.min(20, Math.max(6, base - 0.5)).toFixed(2));
        const dev1 = Number(Math.min(20, Math.max(6, base - 0.8)).toFixed(2));
        const dev2 = Number(Math.min(20, Math.max(6, base + 0.6)).toFixed(2));
        const composition = Number(Math.min(20, Math.max(6, base + 1.2)).toFixed(2));

        const gradeObj: StudentGrades = {
          evaluations,
          dev1,
          dev2,
          composition,
          // Compatibilité
          eval1: evaluations,
          eval2: evaluations,
          dev3: composition,
        };

        // Clé spécifique par trimestre
        map[`${s.id}_${sub.name}_${trim}`] = gradeObj;
        // Clé par défaut (1er trimestre) pour compatibilité
        if (tIdx === 0) {
          map[`${s.id}_${sub.name}`] = gradeObj;
        }
      });
    });
  });

  return map;
}

export function getCeminaceMention(average: number): string {
  if (average >= 16.0) return 'Très Bien (Félicitations du Conseil)';
  if (average >= 14.0) return 'Bien (Tableau d’Honneur & Encouragements)';
  if (average >= 12.0) return 'Assez Bien (Tableau d’Honneur)';
  if (average >= 10.0) return 'Passable (Travail Moyen)';
  if (average >= 8.0) return 'Insuffisant (Avertissement Travail)';
  return 'Faible (Blâme de Travail)';
}
