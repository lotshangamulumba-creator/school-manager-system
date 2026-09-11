export type SchoolLevel = 'Primaire' | 'Collège' | 'Lycée';

export type Specialty = 'Sciences' | 'Littérature' | 'EPS';

export interface Subject {
  id: string;
  name: string;
  coeff: number;
  specialty: Specialty;
}

export interface Student {
  id: string;
  classId?: string;
  firstName: string;
  lastName: string;
  dob: string; // DD/MM/YYYY
  gender: 'M' | 'F';
  parentPhone: string;
  className: string;
  // Aliases francophones & champs étendus
  matricule?: string;
  nom?: string;
  prenom?: string;
  sexe?: 'M' | 'F';
  dateNaissance?: string;
  lieuNaissance?: string;
  telephoneParent?: string;
}

export interface StudentGrades {
  evaluations: number; // Notes Evaluations (/20)
  dev1: number;        // Notes Devoir 1 (/20)
  dev2: number;        // Notes Devoir 2 (/20)
  composition: number; // Notes COMPOSITION par trimestre (/20)
  observation?: string;
  // Rétrocompatibilité
  eval1?: number;
  eval2?: number;
  dev3?: number;
}

export interface SubjectResult {
  subjectName: string;
  coeff: number;
  specialty: Specialty;
  evalAvg: number;
  dev1: number;
  dev2: number;
  devAvg: number;
  composition: number;
  subjectAvg: number;
  points: number;
  rank: number;
  appreciation: string;
}

export interface ClassSpecialtyStat {
  level: SchoolLevel;
  className: string;
  studentCount: number;
  sciencesAvg: number;
  literatureAvg: number;
  epsAvg: number;
  generalAvg: number;
  bestStudentName: string;
  bestStudentAvg: number;
}

export interface LevelSpecialtyStat {
  level: SchoolLevel;
  totalStudents: number;
  classesCount: number;
  sciencesAvg: number;
  literatureAvg: number;
  epsAvg: number;
  generalAvg: number;
  classes: ClassSpecialtyStat[];
}

export interface EstablishmentSpecialtyStat {
  trimester: string;
  totalStudents: number;
  totalClasses: number;
  sciencesAvg: number;
  literatureAvg: number;
  epsAvg: number;
  generalAvg: number;
  levels: LevelSpecialtyStat[];
}

export interface StudentTrimesterResult {
  student: Student;
  subjectResults: SubjectResult[];
  totalPoints: number;
  totalCoeff: number;
  generalAvg: number;
  generalRank: number;
  sciencesAvg: number;
  sciencesRank: number;
  literatureAvg: number;
  literatureRank: number;
  epsAvg: number;
  epsRank: number;
  mention: string;
}
