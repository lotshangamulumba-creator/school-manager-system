import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { SignedSchoolLicense } from './licensing.js';
import { DEFAULT_SCHOOL_PROFILE } from '../data/schoolProfile.js';
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
  evaluations: number;
  dev1: number;
  dev2: number;
  composition: number;
  observation?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DbAcademicYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  active: boolean;
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
  private data: SchoolDatabase;

  constructor() {
    this.ensureDataDir();
    this.data = this.loadOrInit();
  }

  private ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private loadOrInit(): SchoolDatabase {
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
        if (migrated) this.saveData(parsed);
        return parsed;
      }
    }
    const seeded = this.generateSeedData();
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
    return this.data;
  }

  public logAudit(action: string, details?: string, userId?: string, userEmail?: string, ipAddress?: string) {
    const entry: DbAuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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

  private generateSeedData(): SchoolDatabase {
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
    const adminHash = bcrypt.hashSync(adminPassword, 12);
    const teacherHash = bcrypt.hashSync(teacherPassword, 12);

    const users: DbUser[] = [
      {
        id: 'usr-admin-01',
        email: process.env.SEED_ADMIN_EMAIL || 'admin@ceminace.cg',
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
        email: 'prof.math@ceminace.cg',
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
        email: 'prof.francais@ceminace.cg',
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
        email: 'prof.math@ceminace.cg',
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
        email: 'prof.francais@ceminace.cg',
        telephone: '+242 06 901 22 77',
        specialite: 'Français & Philosophie',
        statut: true,
        createdAt: now
      }
    ];
    if (!seedDemoData) teachers.length = 0;
    if (!seedDemoData) users.splice(1);

    const academicYears: DbAcademicYear[] = [
      {
        id: 'ay-2025-2026',
        name: '2025-2026',
        startDate: '2025-10-01',
        endDate: '2026-07-15',
        active: true,
        createdAt: now
      }
    ];

    const classes: DbClass[] = [
      // Primaire
      { id: 'cls-cp1', nom: 'CP1', niveau: 'Primaire', capacite: 35, statut: true, academicYearId: 'ay-2025-2026', createdAt: now },
      { id: 'cls-cm2', nom: 'CM2', niveau: 'Primaire', capacite: 40, statut: true, academicYearId: 'ay-2025-2026', createdAt: now },
      // Collège
      { id: 'cls-6a', nom: '6ème A', niveau: 'Collège', section: 'Générale', capacite: 45, statut: true, academicYearId: 'ay-2025-2026', headTeacherId: 'tch-01', createdAt: now },
      { id: 'cls-5a', nom: '5ème A', niveau: 'Collège', section: 'Générale', capacite: 45, statut: true, academicYearId: 'ay-2025-2026', createdAt: now },
      { id: 'cls-4a', nom: '4ème A', niveau: 'Collège', section: 'Générale', capacite: 45, statut: true, academicYearId: 'ay-2025-2026', createdAt: now },
      { id: 'cls-3a', nom: '3ème A', niveau: 'Collège', section: 'Générale', capacite: 45, statut: true, academicYearId: 'ay-2025-2026', createdAt: now },
      // Lycée
      { id: 'cls-2nde-c', nom: '2nde C', niveau: 'Lycée', section: 'Scientifique', capacite: 40, statut: true, academicYearId: 'ay-2025-2026', createdAt: now },
      { id: 'cls-term-c', nom: 'Terminale C', niveau: 'Lycée', section: 'Mathématiques & Physique', capacite: 35, statut: true, academicYearId: 'ay-2025-2026', createdAt: now },
      { id: 'cls-term-d', nom: 'Terminale D', niveau: 'Lycée', section: 'Sciences Naturelles & Biologie', capacite: 40, statut: true, academicYearId: 'ay-2025-2026', createdAt: now },
      { id: 'cls-term-a', nom: 'Terminale A', niveau: 'Lycée', section: 'Lettres & Philosophie', capacite: 45, statut: true, academicYearId: 'ay-2025-2026', headTeacherId: 'tch-02', createdAt: now }
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

    const students: DbStudent[] = seedDemoData ? [
      { id: 'CEM-001', matricule: 'CEM-001', nom: 'MOUKOKO', prenom: 'Grace', sexe: 'F', dateNaissance: '12/04/2010', lieuNaissance: 'Brazzaville', parentPhone: '+242 06 654 32 10', classId: 'cls-6a', className: '6ème A', statut: true, createdAt: now, updatedAt: now },
      { id: 'CEM-002', matricule: 'CEM-002', nom: 'NGOMA', prenom: 'Christian', sexe: 'M', dateNaissance: '25/08/2009', lieuNaissance: 'Pointe-Noire', parentPhone: '+242 05 512 88 44', classId: 'cls-6a', className: '6ème A', statut: true, createdAt: now, updatedAt: now },
      { id: 'CEM-003', matricule: 'CEM-003', nom: 'MAKOSSO', prenom: 'Aurelie', sexe: 'F', dateNaissance: '03/11/2010', lieuNaissance: 'Brazzaville', parentPhone: '+242 06 901 22 77', classId: 'cls-6a', className: '6ème A', statut: true, createdAt: now, updatedAt: now },
      { id: 'CEM-004', matricule: 'CEM-004', nom: 'SAMBA', prenom: 'Kevin', sexe: 'M', dateNaissance: '17/01/2009', lieuNaissance: 'Dolisie', parentPhone: '+242 04 433 19 80', classId: 'cls-6a', className: '6ème A', statut: true, createdAt: now, updatedAt: now },
      { id: 'CEM-005', matricule: 'CEM-005', nom: 'LOUBAKI', prenom: 'Priscille', sexe: 'F', dateNaissance: '09/06/2010', lieuNaissance: 'Brazzaville', parentPhone: '+242 06 720 11 05', classId: 'cls-6a', className: '6ème A', statut: true, createdAt: now, updatedAt: now },
      { id: 'CEM-006', matricule: 'CEM-006', nom: 'MPASSI', prenom: 'Arnaud', sexe: 'M', dateNaissance: '22/12/2009', lieuNaissance: 'Kinkala', parentPhone: '+242 05 609 45 33', classId: 'cls-6a', className: '6ème A', statut: true, createdAt: now, updatedAt: now }
    ] : [];

    const grades: DbGrade[] = [];
    const sampleGradesMatrix: Record<string, { eval: number; dev1: number; dev2: number; comp: number }> = {
      'CEM-001': { eval: 15.5, dev1: 14.0, dev2: 16.0, comp: 16.5 },
      'CEM-002': { eval: 12.0, dev1: 11.5, dev2: 13.0, comp: 12.5 },
      'CEM-003': { eval: 14.0, dev1: 13.5, dev2: 14.5, comp: 15.0 },
      'CEM-004': { eval: 10.0, dev1: 9.5, dev2: 11.0, comp: 10.5 },
      'CEM-005': { eval: 16.0, dev1: 15.5, dev2: 17.0, comp: 17.5 },
      'CEM-006': { eval: 8.5, dev1: 9.0, dev2: 8.0, comp: 9.5 }
    };

    for (const student of students) {
      for (const subject of subjects) {
        const base = sampleGradesMatrix[student.id] || { eval: 12, dev1: 12, dev2: 12, comp: 12 };
        const factor = subject.specialty === 'Sciences' ? (student.id === 'CEM-005' ? 1.05 : 0.98) : 1.0;
        const ev = Math.min(20, Math.max(0, Math.round(base.eval * factor * 10) / 10));
        const d1 = Math.min(20, Math.max(0, Math.round(base.dev1 * factor * 10) / 10));
        const d2 = Math.min(20, Math.max(0, Math.round(base.dev2 * factor * 10) / 10));
        const cp = Math.min(20, Math.max(0, Math.round(base.comp * factor * 10) / 10));

        grades.push({
          id: `grd-${student.id}-${subject.id}-t1`,
          studentId: student.id,
          subjectId: subject.id,
          subjectName: subject.nom,
          classId: student.classId,
          className: student.className,
          academicYearId: 'ay-2025-2026',
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
        details: 'Initialisation de la base de données relationnelle TIC-TiG pour CEMINACE Brazzaville',
        createdAt: now
      }
    ];

    return {
      version: 1,
      schoolId: crypto.randomUUID(),
      establishmentName: DEFAULT_SCHOOL_PROFILE.schoolName,
      establishmentCity: DEFAULT_SCHOOL_PROFILE.city,
      schoolProfile: { ...DEFAULT_SCHOOL_PROFILE },
      academicYears,
      users,
      teachers,
      classes,
      subjects,
      students,
      grades,
      auditLogs,
      license: null,
      licenseRenewals: []
    };
  }
}

export const db = new DatabaseEngine();
