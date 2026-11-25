import { z } from 'zod';

const roleSchema = z.enum(['ADMIN', 'DIRECTOR', 'SECRETARY', 'TEACHER', 'PARENT', 'STUDENT']);
const levelSchema = z.enum(['Primaire', 'Collège', 'Lycée']);
const yearSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  status: z.enum(['draft', 'active', 'closed']),
  createdAt: z.string(),
}).passthrough();

const backupSchema = z.object({
  version: z.number(),
  schoolId: z.string().optional(),
  establishmentName: z.string().optional(),
  establishmentCity: z.string().optional(),
  schoolProfile: z.object({
    schoolName: z.string(),
    city: z.string(),
    address: z.string(),
    phone: z.string(),
    email: z.string(),
    motto: z.string(),
    principalName: z.string(),
    directorOfStudiesName: z.string(),
    matriculePrefix: z.string(),
    primaryColor: z.string(),
    secondaryColor: z.string(),
    accentColor: z.string(),
    logoDataUrl: z.string().nullable(),
  }).passthrough().optional(),
  academicYears: z.array(yearSchema).optional(),
  users: z.array(z.object({
    id: z.string().min(1),
    email: z.string().email(),
    nom: z.string(),
    prenom: z.string(),
    role: roleSchema,
    actif: z.boolean(),
  }).passthrough()).optional(),
  teachers: z.array(z.object({
    id: z.string().min(1),
    nom: z.string(),
    prenom: z.string(),
    email: z.string(),
    statut: z.boolean(),
    userId: z.string().optional(),
  }).passthrough()).optional().default([]),
  classes: z.array(z.object({
    id: z.string().min(1),
    nom: z.string().min(1),
    niveau: levelSchema,
    capacite: z.number(),
    statut: z.boolean(),
    academicYearId: z.string().min(1),
  }).passthrough()),
  subjects: z.array(z.object({
    id: z.string().min(1),
    nom: z.string().min(1),
    code: z.string().min(1),
    niveau: levelSchema,
    specialty: z.enum(['Sciences', 'Littérature', 'EPS', 'Autre']),
    coeff: z.number(),
    statut: z.boolean(),
  }).passthrough()),
  students: z.array(z.object({
    id: z.string().min(1),
    matricule: z.string().min(1),
    nom: z.string().min(1),
    prenom: z.string().min(1),
    sexe: z.enum(['M', 'F']),
    dateNaissance: z.string(),
    statut: z.boolean(),
    classId: z.string().min(1),
    className: z.string(),
    academicYearId: z.string().optional(),
  }).passthrough()),
  grades: z.array(z.object({
    id: z.string().min(1),
    studentId: z.string().min(1),
    subjectId: z.string().min(1),
    subjectName: z.string(),
    classId: z.string().min(1),
    className: z.string(),
    academicYearId: z.string().optional(),
    term: z.enum(['1er Trimestre', '2ème Trimestre', '3ème Trimestre']),
    evaluations: z.number().min(0).max(20).nullable().optional().transform(value => value ?? null),
    dev1: z.number().min(0).max(20).nullable().optional().transform(value => value ?? null),
    dev2: z.number().min(0).max(20).nullable().optional().transform(value => value ?? null),
    composition: z.number().min(0).max(20).nullable().optional().transform(value => value ?? null),
  }).passthrough()),
}).passthrough();

export type ValidatedBackup = z.infer<typeof backupSchema>;

export interface BackupValidation {
  data: ValidatedBackup | null;
  errors: string[];
  counts: Record<string, number>;
}

export function validateBackup(input: unknown): BackupValidation {
  const parsed = backupSchema.safeParse(input);
  if (!parsed.success) {
    return {
      data: null,
      errors: parsed.error.issues.map(issue => `${issue.path.join('.') || 'backup'}: ${issue.message}`),
      counts: backupCounts(input),
    };
  }

  const data = parsed.data;
  const errors: string[] = [];
  const classIds = new Set(data.classes.map(schoolClass => schoolClass.id));
  const studentById = new Map(data.students.map(student => [student.id, student]));
  const subjectIds = new Set(data.subjects.map(subject => subject.id));
  const yearIds = data.academicYears ? new Set(data.academicYears.map(year => year.id)) : null;
  const activeYears = data.academicYears?.filter(year => year.status === 'active') || [];
  if (activeYears.length > 1) errors.push('academicYears: une seule année peut être active.');

  data.students.forEach((student, index) => {
    if (!classIds.has(student.classId)) errors.push(`students.${index}.classId: classe inexistante.`);
    if (yearIds && student.academicYearId && !yearIds.has(student.academicYearId)) {
      errors.push(`students.${index}.academicYearId: année scolaire inexistante.`);
    }
  });
  data.classes.forEach((schoolClass, index) => {
    if (yearIds && !yearIds.has(schoolClass.academicYearId)) {
      errors.push(`classes.${index}.academicYearId: année scolaire inexistante.`);
    }
  });
  data.grades.forEach((grade, index) => {
    const student = studentById.get(grade.studentId);
    if (!student) errors.push(`grades.${index}.studentId: élève inexistant.`);
    if (!classIds.has(grade.classId)) errors.push(`grades.${index}.classId: classe inexistante.`);
    if (student && student.classId !== grade.classId) errors.push(`grades.${index}: l’élève ne correspond pas à la classe.`);
    if (!subjectIds.has(grade.subjectId)) errors.push(`grades.${index}.subjectId: matière inexistante.`);
    if (yearIds && grade.academicYearId && !yearIds.has(grade.academicYearId)) {
      errors.push(`grades.${index}.academicYearId: année scolaire inexistante.`);
    }
  });

  return { data, errors, counts: backupCounts(data) };
}

function backupCounts(input: unknown): Record<string, number> {
  if (!input || typeof input !== 'object') return {};
  const data = input as Record<string, unknown>;
  return Object.fromEntries(
    ['users', 'teachers', 'classes', 'subjects', 'students', 'grades', 'academicYears']
      .map(key => [key, Array.isArray(data[key]) ? (data[key] as unknown[]).length : 0])
  );
}

export function sanitizeBackup<T extends { users: Array<{ passwordHash: string }>; license: unknown; licenseRenewals: unknown }>(data: T) {
  const { license: _license, licenseRenewals: _licenseRenewals, users, ...safeData } = data;
  return {
    ...safeData,
    users: users.map(({ passwordHash: _passwordHash, ...safeUser }) => safeUser),
  };
}
