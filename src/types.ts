export type SchoolLevel = 'Primaire' | 'Collège' | 'Lycée';

export type Specialty = 'Sciences' | 'Littérature' | 'EPS';

export interface SchoolProfile {
  schoolName: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  motto: string;
  principalName: string;
  directorOfStudiesName: string;
  matriculePrefix: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoDataUrl: string | null;
}

export interface Subject {
  id: string;
  name: string;
  coeff: number;
  specialty: Specialty;
  level?: SchoolLevel;
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
  evaluations: number | null; // Notes Evaluations (/20)
  dev1: number | null;        // Notes Devoir 1 (/20)
  dev2: number | null;        // Notes Devoir 2 (/20)
  composition: number | null; // Notes COMPOSITION par trimestre (/20)
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
  evalAvg: number | null;
  dev1: number | null;
  dev2: number | null;
  devAvg: number | null;
  composition: number | null;
  subjectAvg: number | null;
  points: number | null;
  rank: number | null;
  rankedStudentCount: number;
  appreciation: string;
  isProvisional: boolean;
}

export interface ClassSpecialtyStat {
  level: SchoolLevel;
  className: string;
  studentCount: number;
  sciencesAvg: number | null;
  sciencesStudentCount: number;
  literatureAvg: number | null;
  literatureStudentCount: number;
  epsAvg: number | null;
  epsStudentCount: number;
  generalAvg: number;
  bestStudentName: string;
  bestStudentAvg: number;
}

export interface LevelSpecialtyStat {
  level: SchoolLevel;
  totalStudents: number;
  classesCount: number;
  sciencesAvg: number | null;
  sciencesStudentCount: number;
  literatureAvg: number | null;
  literatureStudentCount: number;
  epsAvg: number | null;
  epsStudentCount: number;
  generalAvg: number;
  classes: ClassSpecialtyStat[];
}

export interface EstablishmentSpecialtyStat {
  trimester: string;
  totalStudents: number;
  totalClasses: number;
  sciencesAvg: number | null;
  sciencesStudentCount: number;
  literatureAvg: number | null;
  literatureStudentCount: number;
  epsAvg: number | null;
  epsStudentCount: number;
  generalAvg: number;
  levels: LevelSpecialtyStat[];
}

export interface StudentTrimesterResult {
  student: Student;
  subjectResults: SubjectResult[];
  totalPoints: number;
  totalCoeff: number;
  generalAvg: number | null;
  generalRank: number | null;
  isProvisional: boolean;
  sciencesAvg: number | null;
  sciencesRank: number | null;
  sciencesStudentCount: number;
  literatureAvg: number | null;
  literatureRank: number | null;
  literatureStudentCount: number;
  epsAvg: number | null;
  epsRank: number | null;
  epsStudentCount: number;
  mention: string;
}
