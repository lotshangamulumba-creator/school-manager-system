import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { SignedSchoolLicense } from './licensing.js';
import { BCRYPT_COST, validatePassword } from './passwordPolicy.js';
import { DEFAULT_SCHOOL_PROFILE } from '../data/schoolProfile.js';
import { CEMINACE_LEVELS } from '../data/ceminaceDefaults.js';
import { SchoolProfile } from '../types.js';

export interface DbUser {
  id: string;
  email: string;
  passwordHash: string;
  nom: string;
  prenom: string;
  telephone?: string;
  role: 'ADMIN' | 'DIRECTOR' | 'SECRETARY' | 'TEACHER' | 'PARENT' | 'STUDENT';
  actif: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DbTeacher {
  id: string;
  userId?: string;
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  specialite?: string;
  statut: boolean;
  createdAt: string;
}

export interface DbClass {
  id: string;
  nom: string;
  niveau: 'Primaire' | 'Collège' | 'Lycée';
  section?: string;
  capacite: number;
  statut: boolean;
  academicYearId: string;
  headTeacherId?: string;
  createdAt: string;
}

export interface DbSubject {
  id: string;
  nom: string;
  code: string;
  niveau: 'Primaire' | 'Collège' | 'Lycée';
  specialty: 'Sciences' | 'Littérature' | 'EPS' | 'Autre';
  coeff: number;
  statut: boolean;
  createdAt: string;
}

export interface DbStudent {
  id: string;
  matricule: string;
  nom: string;
  prenom: string;
  sexe: 'M' | 'F';
  dateNaissance: string;
  lieuNaissance?: string;
  adresse?: string;
  telephone?: string;
  parentPhone?: string;
  email?: string;
  photoUrl?: string;
  statut: boolean;
  classId: string;
  className: string;
  academicYearId: string;
  createdAt: string;
  updatedAt: string;
}

export interface DbGrade {
  id: string;
  studentId: string;
  subjectId: string;
  subjectName: string;
  classId: string;
  className: string;
  teacherId?: string;
  academicYearId: string;
  term: '1er Trimestre' | '2ème Trimestre' | '3ème Trimestre';
  evaluations: number | null;
  dev1: number | null;
  dev2: number | null;
  composition: number | null;
  observation?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DbAcademicYear {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  status: 'draft' | 'active' | 'closed';
  createdAt: string;
}

export interface DbAuditLog {
  id: string;
  userId?: string;
  userEmail?: string;
  action: string;
  details?: string;
  ipAddress?: string;
  createdAt: string;
}

export interface LicenseRenewal {
  id: string;
  licenseId: string;
  previousLicenseId?: string;
  plan: 'monthly' | 'annual';
  startsAt: string;
  expiresAt: string;
  actorUserId: string;
  actorEmail: string;
  createdAt: string;
}

export interface SchoolDatabase {
  version: number;
  schoolId: string;
  establishmentName: string;
  establishmentCity: string;
  schoolProfile: SchoolProfile;
  academicYears: DbAcademicYear[];
  users: DbUser[];
  teachers: DbTeacher[];
  classes: DbClass[];
  subjects: DbSubject[];
  students: DbStudent[];
  grades: DbGrade[];
  auditLogs: DbAuditLog[];
  license: SignedSchoolLicense | null;
  licenseRenewals: LicenseRenewal[];
}

const DB_FILE = path.resolve(process.cwd(), process.env.DATABASE_FILE || path.join('database', 'ceminace_data.json'));
const DATA_DIR = path.dirname(DB_FILE);

class DatabaseEngine {
  private data!: SchoolDatabase;
  public readonly ready: Promise<void>;

  private addDefaultSubjectsForMissingLevels(subjects: DbSubject[], createdAt: string): DbSubject[] {
    const levelCodes: Record<DbClass['niveau'], string> = {
      Primaire: 'PRI',
      Collège: 'COL',
      Lycée: 'LYC',
    };

    return (['Primaire', 'Collège', 'Lycée'] as const).reduce((result, niveau) => {
      if (result.some(subject => subject.niveau === niveau)) return result;

      const defaults = CEMINACE_LEVELS[niveau].defaultSubjects.map((subject, index): DbSubject => ({
        id: `sub-default-${subject.id}`,
        nom: subject.name,
        code: `${levelCodes[niveau]}-${index + 1}`,
        niveau,
        specialty: subject.specialty,
        coeff: subject.coeff,
        statut: true,
        createdAt,
      }));

      return [...result, ...defaults];
    }, [...subjects]);
  }

  constructor() {
    this.ensureDataDir();
    this.ready = this.loadOrInit().then(data => {
      this.data = data;
    });
  }

  private ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private async loadOrInit(): Promise<SchoolDatabase> {
    if (fs.existsSync(DB_FILE)) {
      let parsed: any;
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        parsed = JSON.parse(raw);
      } catch (err) {
        console.error('Error reading database file, rebuilding default seed:', err);
      }
      if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.students)) {
        let migrated = false;
        if (!Array.isArray(parsed.subjects)) {
          parsed.subjects = [];
          migrated = true;
        }
        if (typeof parsed.version !== 'number') {
          parsed.version = 1;
          migrated = true;
        }
        const requiresAcademicYearMigration = parsed.version < 3;
        if (parsed.version < 2) {
          parsed.subjects = this.addDefaultSubjectsForMissingLevels(
            parsed.subjects,
            new Date().toISOString()
          );
          parsed.version = 2;
          migrated = true;
        }
        if (typeof parsed.schoolId !== 'string' || parsed.schoolId.length === 0) {
          parsed.schoolId = crypto.randomUUID();
          migrated = true;
        }
        if (!Object.prototype.hasOwnProperty.call(parsed, 'license')) {
          parsed.license = null;
          migrated = true;
        }
        if (!Array.isArray(parsed.licenseRenewals)) {
          parsed.licenseRenewals = [];
          migrated = true;
        }
        if (!parsed.schoolProfile || typeof parsed.schoolProfile !== 'object') {
          parsed.schoolProfile = {
            ...DEFAULT_SCHOOL_PROFILE,
            schoolName: parsed.establishmentName || DEFAULT_SCHOOL_PROFILE.schoolName,
            city: parsed.establishmentCity || DEFAULT_SCHOOL_PROFILE.city,
          };
          migrated = true;
        } else {
          if (Object.keys(DEFAULT_SCHOOL_PROFILE).some((field) => !(field in parsed.schoolProfile))) {
            migrated = true;
          }
          parsed.schoolProfile = {
            ...DEFAULT_SCHOOL_PROFILE,
            ...parsed.schoolProfile,
            schoolName: typeof parsed.schoolProfile.schoolName === 'string'
              ? parsed.schoolProfile.schoolName
              : parsed.establishmentName || DEFAULT_SCHOOL_PROFILE.schoolName,
            city: typeof parsed.schoolProfile.city === 'string'
              ? parsed.schoolProfile.city
              : parsed.establishmentCity || DEFAULT_SCHOOL_PROFILE.city,
          };
          if (parsed.schoolProfile.logoDataUrl === undefined) {
            parsed.schoolProfile.logoDataUrl = null;
            migrated = true;
          }
        }
        if (parsed.establishmentName !== parsed.schoolProfile.schoolName) {
          parsed.establishmentName = parsed.schoolProfile.schoolName;
          migrated = true;
        }
        if (parsed.establishmentCity !== parsed.schoolProfile.city) {
          parsed.establishmentCity = parsed.schoolProfile.city;
          migrated = true;
        }
        if (parsed.version < 3) {
          const now = new Date().toISOString();
          const legacyYearId = crypto.randomUUID();
          parsed.academicYears = [
            {
              id: legacyYearId,
              label: '2025-2026',
              startDate: '2025-10-01',
              endDate: '2026-07-15',
              status: 'closed',
              createdAt: now,
            },
            {
              id: crypto.randomUUID(),
              label: '2026-2027',
              startDate: '2026-10-01',
              endDate: '2027-07-15',
              status: 'active',
              createdAt: now,
            },
          ] satisfies DbAcademicYear[];
          parsed.classes = parsed.classes.map((schoolClass: DbClass) => ({
            ...schoolClass,
            academicYearId: legacyYearId,
          }));
          parsed.students = parsed.students.map((student: DbStudent) => ({
            ...student,
            academicYearId: legacyYearId,
          }));
          parsed.grades = parsed.grades.map((grade: DbGrade) => ({
            ...grade,
            academicYearId: legacyYearId,
            evaluations: grade.evaluations ?? null,
            dev1: grade.dev1 ?? null,
            dev2: grade.dev2 ?? null,
            composition: grade.composition ?? null,
          }));
          parsed.version = 3;
          migrated = true;
        }
        if (migrated) {
          if (requiresAcademicYearMigration) {
            const migrationBackup = `${DB_FILE}.pre-academic-years-${crypto.randomUUID()}.bak`;
            fs.copyFileSync(DB_FILE, migrationBackup);
          }
          this.saveData(parsed);
        }
        return parsed;
      }
    }
    const seeded = await this.generateSeedData();
    this.saveData(seeded);
    return seeded;
  }

  private saveData(dataToSave: SchoolDatabase) {
    try {
      this.ensureDataDir();
      const tmpFile = `${DB_FILE}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(dataToSave, null, 2), 'utf-8');
      fs.renameSync(tmpFile, DB_FILE);
    } catch (err) {
      console.error('Failed to write database file:', err);
      throw new Error('Impossible de persister la base de données.');
    }
  }

  public persist() {
    this.saveData(this.data);
  }

  public getData(): SchoolDatabase {
    if (!this.data) throw new Error('La base de données n’est pas encore initialisée.');
    return this.data;
  }

  public createPreRestoreBackup(): string {
    const backupPath = `${DB_FILE}.pre-restore-${crypto.randomUUID()}.json`;
    fs.writeFileSync(backupPath, JSON.stringify(this.getData(), null, 2), {
      encoding: 'utf-8',
      flag: 'wx',
      mode: 0o600,
    });
    return backupPath;
  }

  public logAudit(action: string, details?: string, userId?: string, userEmail?: string, ipAddress?: string) {
    const entry: DbAuditLog = {
      id: crypto.randomUUID(),
      userId,
      userEmail,
      action,
      details,
      ipAddress,
      createdAt: new Date().toISOString()
    };
    this.data.auditLogs.unshift(entry);
    if (this.data.auditLogs.length > 500) {
      this.data.auditLogs = this.data.auditLogs.slice(0, 500);
    }
    this.persist();
  }

  private async generateSeedData(): Promise<SchoolDatabase> {
    const now = new Date().toISOString();
    const seedDemoData = process.env.SEED_DEMO_DATA === 'true';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || crypto.randomBytes(24).toString('base64url');
    const teacherPassword = process.env.SEED_TEACHER_PASSWORD || crypto.randomBytes(24).toString('base64url');
    if (process.env.NODE_ENV === 'production' && (!process.env.SEED_ADMIN_PASSWORD || (seedDemoData && !process.env.SEED_TEACHER_PASSWORD))) {
      throw new Error('SEED_ADMIN_PASSWORD est obligatoire; SEED_TEACHER_PASSWORD l’est aussi si SEED_DEMO_DATA=true.');
    }
    if (process.env.NODE_ENV !== 'production' && (!process.env.SEED_ADMIN_PASSWORD || (seedDemoData && !process.env.SEED_TEACHER_PASSWORD))) {
      console.warn('[MonPilot] Base initialisée avec des mots de passe de développement générés. Définissez les mots de passe seed correspondants pour les contrôler.');
      console.warn(`[MonPilot] Compte admin: ${adminPassword}`);
      if (seedDemoData) console.warn(`[MonPilot] Compte enseignant: ${teacherPassword}`);
    }
    const adminPasswordError = validatePassword(adminPassword);
    const teacherPasswordError = seedDemoData ? validatePassword(teacherPassword) : null;
    if (adminPasswordError || teacherPasswordError) {
      throw new Error(adminPasswordError || teacherPasswordError || 'Mot de passe seed invalide.');
    }
    const adminHash = await bcrypt.hash(adminPassword, BCRYPT_COST);
    const teacherHash = await bcrypt.hash(teacherPassword, BCRYPT_COST);

    const users: DbUser[] = [
      {
        id: 'usr-admin-01',
        email: process.env.SEED_ADMIN_EMAIL || 'admin@ecole.cg',
        passwordHash: adminHash,
        nom: 'NGOUABI',
        prenom: 'Alphonse',
        telephone: '+242 06 654 32 10',
        role: 'ADMIN',
        actif: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'usr-prof-01',
        email: 'prof.math@ecole.cg',
        passwordHash: teacherHash,
        nom: 'KOUMBA',
        prenom: 'Jean-Pierre',
        telephone: '+242 05 512 88 44',
        role: 'TEACHER',
        actif: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'usr-prof-02',
        email: 'prof.francais@ecole.cg',
        passwordHash: teacherHash,
        nom: 'MABIALA',
        prenom: 'Véronique',
        telephone: '+242 06 901 22 77',
        role: 'TEACHER',
        actif: true,
        createdAt: now,
        updatedAt: now
      }
    ];

    const teachers: DbTeacher[] = [
      {
        id: 'tch-01',
        userId: 'usr-prof-01',
        nom: 'KOUMBA',
        prenom: 'Jean-Pierre',
        email: 'prof.math@ecole.cg',
        telephone: '+242 05 512 88 44',
        specialite: 'Mathématiques & Informatique',
        statut: true,
        createdAt: now
      },
      {
        id: 'tch-02',
        userId: 'usr-prof-02',
        nom: 'MABIALA',
        prenom: 'Véronique',
        email: 'prof.francais@ecole.cg',
        telephone: '+242 06 901 22 77',
        specialite: 'Français & Philosophie',
        statut: true,
        createdAt: now
      }
    ];
    if (!seedDemoData) teachers.length = 0;
    if (!seedDemoData) users.splice(1);

    const closedYearId = crypto.randomUUID();
    const academicYearId = crypto.randomUUID();
    const academicYears: DbAcademicYear[] = [
      {
        id: closedYearId,
        label: '2025-2026',
        startDate: '2025-10-01',
        endDate: '2026-07-15',
        status: 'closed',
        createdAt: now,
      },
      {
        id: academicYearId,
        label: '2026-2027',
        startDate: '2026-10-01',
        endDate: '2027-07-15',
        status: 'active',
        createdAt: now,
      }
    ];

    const classes: DbClass[] = [
      // Primaire
      { id: 'cls-cp1', nom: 'CP1', niveau: 'Primaire', capacite: 35, statut: true, academicYearId: closedYearId, createdAt: now },
      { id: 'cls-cm2', nom: 'CM2', niveau: 'Primaire', capacite: 40, statut: true, academicYearId: closedYearId, createdAt: now },
      // Collège
      { id: 'cls-6a', nom: '6ème A', niveau: 'Collège', section: 'Générale', capacite: 45, statut: true, academicYearId: closedYearId, headTeacherId: 'tch-01', createdAt: now },
      { id: 'cls-5a', nom: '5ème A', niveau: 'Collège', section: 'Générale', capacite: 45, statut: true, academicYearId: closedYearId, createdAt: now },
      { id: 'cls-4a', nom: '4ème A', niveau: 'Collège', section: 'Générale', capacite: 45, statut: true, academicYearId: closedYearId, createdAt: now },
      { id: 'cls-3a', nom: '3ème A', niveau: 'Collège', section: 'Générale', capacite: 45, statut: true, academicYearId: closedYearId, createdAt: now },
      // Lycée
      { id: 'cls-2nde-c', nom: '2nde C', niveau: 'Lycée', section: 'Scientifique', capacite: 40, statut: true, academicYearId: closedYearId, createdAt: now },
      { id: 'cls-term-c', nom: 'Terminale C', niveau: 'Lycée', section: 'Mathématiques & Physique', capacite: 35, statut: true, academicYearId: closedYearId, createdAt: now },
      { id: 'cls-term-d', nom: 'Terminale D', niveau: 'Lycée', section: 'Sciences Naturelles & Biologie', capacite: 40, statut: true, academicYearId: closedYearId, createdAt: now },
      { id: 'cls-term-a', nom: 'Terminale A', niveau: 'Lycée', section: 'Lettres & Philosophie', capacite: 45, statut: true, academicYearId: closedYearId, headTeacherId: 'tch-02', createdAt: now }
    ];
    if (!seedDemoData) classes.forEach((schoolClass) => { delete schoolClass.headTeacherId; });

    const subjects: DbSubject[] = [
      { id: 'sub-math', nom: 'Mathématiques', code: 'MATH', niveau: 'Collège', specialty: 'Sciences', coeff: 4, statut: true, createdAt: now },
      { id: 'sub-fr', nom: 'Français', code: 'FRAN', niveau: 'Collège', specialty: 'Littérature', coeff: 4, statut: true, createdAt: now },
      { id: 'sub-hg', nom: 'Histoire-Géographie & ECM', code: 'HG', niveau: 'Collège', specialty: 'Littérature', coeff: 2, statut: true, createdAt: now },
      { id: 'sub-pc', nom: 'Sciences Physiques', code: 'PC', niveau: 'Collège', specialty: 'Sciences', coeff: 3, statut: true, createdAt: now },
      { id: 'sub-svt', nom: 'SVT (Sciences de la Vie et de la Terre)', code: 'SVT', niveau: 'Collège', specialty: 'Sciences', coeff: 2, statut: true, createdAt: now },
      { id: 'sub-ang', nom: 'Anglais', code: 'ANG', niveau: 'Collège', specialty: 'Littérature', coeff: 2, statut: true, createdAt: now },
      { id: 'sub-eps', nom: 'Éducation Physique et Sportive (EPS)', code: 'EPS', niveau: 'Collège', specialty: 'EPS', coeff: 2, statut: true, createdAt: now }
    ];
    const allLevelSubjects = this.addDefaultSubjectsForMissingLevels(subjects, now);

    const sampleStudents: Omit<DbStudent, 'id' | 'matricule'>[] = [
      { nom: 'MOUKOKO', prenom: 'Grace', sexe: 'F', dateNaissance: '12/04/2010', lieuNaissance: 'Brazzaville', parentPhone: '+242 06 654 32 10', classId: 'cls-6a', className: '6ème A', academicYearId: closedYearId, statut: true, createdAt: now, updatedAt: now },
      { nom: 'NGOMA', prenom: 'Christian', sexe: 'M', dateNaissance: '25/08/2009', lieuNaissance: 'Pointe-Noire', parentPhone: '+242 05 512 88 44', classId: 'cls-6a', className: '6ème A', academicYearId: closedYearId, statut: true, createdAt: now, updatedAt: now },
      { nom: 'MAKOSSO', prenom: 'Aurelie', sexe: 'F', dateNaissance: '03/11/2010', lieuNaissance: 'Brazzaville', parentPhone: '+242 06 901 22 77', classId: 'cls-6a', className: '6ème A', academicYearId: closedYearId, statut: true, createdAt: now, updatedAt: now },
      { nom: 'SAMBA', prenom: 'Kevin', sexe: 'M', dateNaissance: '17/01/2009', lieuNaissance: 'Dolisie', parentPhone: '+242 04 433 19 80', classId: 'cls-6a', className: '6ème A', academicYearId: closedYearId, statut: true, createdAt: now, updatedAt: now },
      { nom: 'LOUBAKI', prenom: 'Priscille', sexe: 'F', dateNaissance: '09/06/2010', lieuNaissance: 'Brazzaville', parentPhone: '+242 06 720 11 05', classId: 'cls-6a', className: '6ème A', academicYearId: closedYearId, statut: true, createdAt: now, updatedAt: now },
      { nom: 'MPASSI', prenom: 'Arnaud', sexe: 'M', dateNaissance: '22/12/2009', lieuNaissance: 'Kinkala', parentPhone: '+242 05 609 45 33', classId: 'cls-6a', className: '6ème A', academicYearId: closedYearId, statut: true, createdAt: now, updatedAt: now },
    ];
    const students: DbStudent[] = seedDemoData
      ? sampleStudents.map((student, index) => ({
          ...student,
          id: crypto.randomUUID(),
          matricule: `${DEFAULT_SCHOOL_PROFILE.matriculePrefix}-${String(index + 1).padStart(3, '0')}`,
        }))
      : [];

    const grades: DbGrade[] = [];
    const sampleGradesMatrix = [
      { eval: 15.5, dev1: 14.0, dev2: 16.0, comp: 16.5 },
      { eval: 12.0, dev1: 11.5, dev2: 13.0, comp: 12.5 },
      { eval: 14.0, dev1: 13.5, dev2: 14.5, comp: 15.0 },
      { eval: 10.0, dev1: 9.5, dev2: 11.0, comp: 10.5 },
      { eval: 16.0, dev1: 15.5, dev2: 17.0, comp: 17.5 },
      { eval: 8.5, dev1: 9.0, dev2: 8.0, comp: 9.5 },
    ];

    for (const [studentIndex, student] of students.entries()) {
      for (const subject of subjects) {
        const base = sampleGradesMatrix[studentIndex] || { eval: 12, dev1: 12, dev2: 12, comp: 12 };
        const factor = subject.specialty === 'Sciences' ? (studentIndex === 4 ? 1.05 : 0.98) : 1.0;
        const ev = Math.min(20, Math.max(0, Math.round(base.eval * factor * 10) / 10));
        const d1 = Math.min(20, Math.max(0, Math.round(base.dev1 * factor * 10) / 10));
        const d2 = Math.min(20, Math.max(0, Math.round(base.dev2 * factor * 10) / 10));
        const cp = Math.min(20, Math.max(0, Math.round(base.comp * factor * 10) / 10));

        grades.push({
          id: crypto.randomUUID(),
          studentId: student.id,
          subjectId: subject.id,
          subjectName: subject.nom,
          classId: student.classId,
          className: student.className,
          academicYearId: closedYearId,
          term: '1er Trimestre',
          evaluations: ev,
          dev1: d1,
          dev2: d2,
          composition: cp,
          createdAt: now,
          updatedAt: now
        });
      }
    }

    const auditLogs: DbAuditLog[] = [
      {
        id: 'log-init-01',
        action: 'SYSTEM_INITIALIZATION',
        details: 'Initialisation de la base de données relationnelle MonPilot',
        createdAt: now
      }
    ];

    return {
      version: 3,
      schoolId: crypto.randomUUID(),
      establishmentName: DEFAULT_SCHOOL_PROFILE.schoolName,
      establishmentCity: DEFAULT_SCHOOL_PROFILE.city,
      schoolProfile: { ...DEFAULT_SCHOOL_PROFILE },
      academicYears,
      users,
      teachers,
      classes,
      subjects: allLevelSubjects,
      students,
      grades,
      auditLogs,
      license: null,
      licenseRenewals: []
    };
  }
}

export const db = new DatabaseEngine();
