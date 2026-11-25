import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { db, DbUser, DbStudent, DbTeacher, DbClass, DbSubject, DbGrade, DbAcademicYear } from './db.js';
import { authMiddleware, requireRoles, generateToken, AuthenticatedRequest, BCRYPT_COST, validatePassword } from './auth.js';
import { computeClassResults, computeEstablishmentStats } from './academic.js';
import {
  getConfiguredLicensePublicKey,
  getLicenseStatus,
  SignedSchoolLicense,
  verifyInstallableLicense,
} from './licensing.js';
import { DEFAULT_SCHOOL_PROFILE } from '../data/schoolProfile.js';
import { validateSchoolProfile } from './schoolProfile.js';
import { sanitizeBackup, validateBackup } from './backup.js';

export const apiRouter = Router();

const TEACHER_SCOPED_ROLES = ['TEACHER'];
const STAFF_ROLES = ['ADMIN', 'DIRECTOR', 'SECRETARY', 'TEACHER'];
const TERMS = ['1er Trimestre', '2ème Trimestre', '3ème Trimestre'] as const;
const ROLES = ['ADMIN', 'DIRECTOR', 'SECRETARY', 'TEACHER', 'PARENT', 'STUDENT'] as const;
const DUMMY_BCRYPT_HASH = '$2b$12$I15k7vo9vqu8e8xl8QJ6b.qMKIV7c5hI6zEdVSjxemfcSufkI2hzq';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip || req.socket.remoteAddress || 'unknown'}|${String(req.body?.email || '').trim().toLowerCase()}`,
  handler: (_req, res) => res.status(429).json({ error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' }),
});

function resolveClass(data: ReturnType<typeof db.getData>, classId?: unknown, className?: unknown) {
  if (typeof classId !== 'string' || !classId) return null;
  const cls = data.classes.find(candidate => candidate.id === classId);
  if (!cls || (className !== undefined && className !== cls.nom)) return null;
  return cls;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function getActiveAcademicYear(data: ReturnType<typeof db.getData>) {
  return data.academicYears.find(year => year.status === 'active') || null;
}

export function parseGrade(value: unknown): number | null {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) return null;
  if (typeof value !== 'number' && typeof value !== 'string') throw new Error('Note invalide.');
  const parsed = typeof value === 'string' ? Number(value.trim()) : value;
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 20) {
    throw new Error('La note doit être un nombre compris entre 0 et 20.');
  }
  return parsed;
}

function isValidBirthDate(value: string): boolean {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return false;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return false;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return date.getTime() <= today.getTime();
}

function generateMatricule(data: ReturnType<typeof db.getData>): string {
  const prefix = data.schoolProfile.matriculePrefix.trim();
  const existing = new Set(data.students.map(student => student.matricule.trim().toLowerCase()));
  let sequence = 1;
  let matricule = `${prefix}-${String(sequence).padStart(3, '0')}`;
  while (existing.has(matricule.toLowerCase())) {
    sequence += 1;
    matricule = `${prefix}-${String(sequence).padStart(3, '0')}`;
  }
  return matricule;
}

function teacherCanAccessClass(req: AuthenticatedRequest, cls: DbClass) {
  if (!req.user || !TEACHER_SCOPED_ROLES.includes(req.user.role)) return true;
  const teacher = db.getData().teachers.find(candidate => candidate.userId === req.user?.id);
  return Boolean(teacher && cls.headTeacherId === teacher.id);
}

function teacherClassIds(req: AuthenticatedRequest, data: ReturnType<typeof db.getData>) {
  if (req.user?.role !== 'TEACHER') return null;
  const teacher = data.teachers.find(candidate => candidate.userId === req.user?.id);
  return new Set(data.classes.filter(cls => cls.headTeacherId === teacher?.id).map(cls => cls.id));
}

function rejectMismatchedReference(res: Response, message: string) {
  return res.status(400).json({ error: message });
}

interface NormalizedStudentInput {
  matricule?: string;
  nom?: string;
  prenom?: string;
  sexe?: string;
  dateNaissance?: string;
  lieuNaissance?: string;
  parentPhone?: string;
  classId?: string;
  className?: string;
  statut?: boolean;
}

function normalizeStudentInput(body: Record<string, unknown>): NormalizedStudentInput {
  return {
    matricule: typeof body.matricule === 'string' ? body.matricule : undefined,
    nom: typeof (body.nom ?? body.lastName) === 'string' ? (body.nom ?? body.lastName) as string : undefined,
    prenom: typeof (body.prenom ?? body.firstName) === 'string' ? (body.prenom ?? body.firstName) as string : undefined,
    sexe: typeof (body.sexe ?? body.gender) === 'string' ? (body.sexe ?? body.gender) as string : undefined,
    dateNaissance: typeof (body.dateNaissance ?? body.dateOfBirth ?? body.dob) === 'string'
      ? (body.dateNaissance ?? body.dateOfBirth ?? body.dob) as string
      : undefined,
    lieuNaissance: typeof (body.lieuNaissance ?? body.birthPlace) === 'string'
      ? (body.lieuNaissance ?? body.birthPlace) as string
      : undefined,
    parentPhone: typeof (body.parentPhone ?? body.telephoneParent) === 'string'
      ? (body.parentPhone ?? body.telephoneParent) as string
      : undefined,
    classId: typeof body.classId === 'string' ? body.classId : undefined,
    className: typeof body.className === 'string' ? body.className : undefined,
    statut: typeof body.statut === 'boolean' ? body.statut : undefined,
  };
}

// ============================================================================
// 1. AUTHENTIFICATION
// ============================================================================

// POST /api/auth/login
apiRouter.post('/auth/login', loginLimiter, async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis.' });
  }

  const data = db.getData();
  const normalizedEmail = email.trim().toLowerCase();
  const user = data.users.find(candidate => candidate.email.toLowerCase() === normalizedEmail);
  let valid = false;
  try {
    valid = await bcrypt.compare(password, user?.passwordHash || DUMMY_BCRYPT_HASH);
  } catch {
    valid = false;
  }
  if (!user || !user.actif || !valid) {
    db.logAudit('LOGIN_FAILURE', 'Tentative de connexion échouée.', user?.id, normalizedEmail, req.ip);
    return res.status(401).json({ error: 'Identifiants invalides' });
  }

  const token = generateToken(user);
  db.logAudit('USER_LOGIN', `Connexion réussie: ${user.email} (${user.role})`, user.id, user.email, req.ip);

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      nom: user.nom,
      prenom: user.prenom,
      role: user.role,
      telephone: user.telephone
    }
  });
});

// GET /api/auth/me
apiRouter.get('/auth/me', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const data = db.getData();
  const user = data.users.find(u => u.id === req.user?.id);
  if (!user || !user.actif) {
    return res.status(401).json({ error: 'Utilisateur introuvable ou désactivé.' });
  }

  res.json({
    id: user.id,
    email: user.email,
    nom: user.nom,
    prenom: user.prenom,
    role: user.role,
    telephone: user.telephone
  });
});

apiRouter.get('/school-profile', (_req: Request, res: Response) => {
  const data = db.getData();
  res.json(data.schoolProfile || {
    ...DEFAULT_SCHOOL_PROFILE,
    schoolName: data.establishmentName,
    city: data.establishmentCity,
  });
});

// POST /api/auth/change-password
apiRouter.post('/auth/change-password', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { oldPassword, newPassword } = req.body;
  if (typeof oldPassword !== 'string' || !oldPassword) {
    return res.status(400).json({ error: 'L’ancien mot de passe est obligatoire.' });
  }

  const data = db.getData();
  const user = data.users.find(u => u.id === req.user?.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });

  if (!await bcrypt.compare(oldPassword, user.passwordHash)) {
    return res.status(401).json({ error: 'L’ancien mot de passe est incorrect.' });
  }

  const passwordError = validatePassword(newPassword, oldPassword);
  if (passwordError) return res.status(400).json({ error: passwordError });

  user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
  user.updatedAt = new Date().toISOString();
  db.persist();
  db.logAudit('CHANGE_PASSWORD', `Changement de mot de passe pour ${user.email}`, user.id, user.email, req.ip);

  res.json({ success: true, message: 'Mot de passe mis à jour avec succès.' });
});

apiRouter.get('/license/status', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const data = db.getData();
  const status = getLicenseStatus(
    data.license,
    data.schoolId,
    data.establishmentName,
    getConfiguredLicensePublicKey()
  );
  res.json({
    ...status,
    renewals: req.user?.role === 'ADMIN' ? data.licenseRenewals : undefined,
  });
});

apiRouter.post('/license/install', authMiddleware, requireRoles(['ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const submittedLicense = req.body?.license as SignedSchoolLicense | undefined;
  const data = db.getData();
  const publicKey = getConfiguredLicensePublicKey();
  if (!publicKey) {
    return res.status(503).json({
      code: 'LICENSE_PUBLIC_KEY_MISSING',
      error: 'La clé publique de licence n’est pas configurée sur le serveur.',
    });
  }
  if (!submittedLicense || typeof submittedLicense !== 'object' || !submittedLicense.payload) {
    return res.status(400).json({ error: 'Document de licence invalide.' });
  }

  if (!verifyInstallableLicense(submittedLicense, data.schoolId, publicKey)) {
    return res.status(400).json({
      code: 'LICENSE_NOT_INSTALLABLE',
      error: 'La licence est invalide, expirée ou ne correspond pas à cette école.',
    });
  }
  const currentLicensePayload = data.license?.payload;
  if (
    currentLicensePayload &&
    (
      submittedLicense.payload.licenseId === currentLicensePayload.licenseId ||
      Date.parse(submittedLicense.payload.issuedAt) < Date.parse(currentLicensePayload.issuedAt) ||
      Date.parse(submittedLicense.payload.expiresAt) <= Date.parse(currentLicensePayload.expiresAt)
    )
  ) {
    return res.status(409).json({
      code: 'LICENSE_REPLAY_REJECTED',
      error: 'Cette licence ne renouvelle pas la licence actuellement enregistrée.',
    });
  }

  const now = new Date().toISOString();
  const renewal = {
    id: `lic-renewal-${crypto.randomUUID()}`,
    licenseId: submittedLicense.payload.licenseId,
    previousLicenseId: data.license?.payload?.licenseId,
    plan: submittedLicense.payload.plan,
    startsAt: submittedLicense.payload.startsAt,
    expiresAt: submittedLicense.payload.expiresAt,
    actorUserId: req.user!.id,
    actorEmail: req.user!.email,
    createdAt: now,
  };
  const auditEntry = {
    id: crypto.randomUUID(),
    userId: req.user!.id,
    userEmail: req.user!.email,
    action: 'LICENSE_INSTALLED',
    details: `Licence ${submittedLicense.payload.licenseId} installée (${submittedLicense.payload.plan}, expiration ${submittedLicense.payload.expiresAt}).`,
    ipAddress: req.ip,
    createdAt: now,
  };
  const previousLicense = data.license;
  const previousRenewals = data.licenseRenewals;
  const previousAuditLogs = data.auditLogs;

  try {
    data.license = submittedLicense;
    data.licenseRenewals = [renewal, ...previousRenewals];
    data.auditLogs = [auditEntry, ...previousAuditLogs].slice(0, 500);
    db.persist();
  } catch (error) {
    data.license = previousLicense;
    data.licenseRenewals = previousRenewals;
    data.auditLogs = previousAuditLogs;
    console.error('License installation failed and was rolled back:', error);
    return res.status(500).json({ error: 'La licence n’a pas pu être enregistrée.' });
  }

  res.json({
    success: true,
    status: getLicenseStatus(data.license, data.schoolId, data.establishmentName, publicKey),
  });
});

// Authentication and license management remain reachable when a license is blocked.
apiRouter.use(authMiddleware, (req: AuthenticatedRequest, res: Response, next) => {
  const data = db.getData();
  const status = getLicenseStatus(
    data.license,
    data.schoolId,
    data.establishmentName,
    getConfiguredLicensePublicKey()
  );
  if (status.state === 'active' || status.state === 'grace') return next();
  const isReadRequest = req.method === 'GET';
  const reportReadPaths = [
    '/backup/export',
    '/classes',
    '/students',
    '/subjects',
    '/grades',
  ];
  const isBulletinRead = req.path.startsWith('/results/class/');
  if (
    isReadRequest &&
    (status.state === 'expired' ||
      (status.state === 'missing' && (reportReadPaths.includes(req.path) || isBulletinRead)))
  ) return next();

  const code = status.state === 'expired' ? 'LICENSE_EXPIRED' : 'LICENSE_BLOCKED';
  return res.status(402).json({
    code,
    state: status.state,
    schoolId: status.schoolId,
    error: status.state === 'expired'
      ? 'La licence a expiré : l’API est en lecture seule. Renouvelez-la pour reprendre les écritures.'
      : 'Une licence valide est nécessaire pour utiliser MonPilot School ERP.',
  });
});

const academicYearInputSchema = z.object({
  label: z.string().trim().min(1).max(80),
  startDate: z.string().refine(value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00.000Z`))),
  endDate: z.string().refine(value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00.000Z`))),
}).strict().refine(value => value.startDate < value.endDate, {
  path: ['endDate'],
  message: 'La date de fin doit être postérieure à la date de début.',
});

apiRouter.get('/academic-years', authMiddleware, requireRoles(['ADMIN']), (_req: Request, res: Response) => {
  res.json(db.getData().academicYears);
});

apiRouter.post('/academic-years', authMiddleware, requireRoles(['ADMIN']), (req: Request, res: Response) => {
  const parsed = academicYearInputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Année scolaire invalide.' });
  const { label, startDate, endDate } = parsed.data;
  if (typeof label !== 'string' || typeof startDate !== 'string' || typeof endDate !== 'string') {
    return res.status(400).json({ error: 'Année scolaire invalide.' });
  }
  const data = db.getData();
  if (data.academicYears.some(year => year.label.toLowerCase() === label.toLowerCase())) {
    return res.status(409).json({ error: 'Cette année scolaire existe déjà.' });
  }
  const year: DbAcademicYear = {
    id: crypto.randomUUID(),
    label,
    startDate,
    endDate,
    status: 'draft',
    createdAt: new Date().toISOString(),
  };
  data.academicYears.push(year);
  db.persist();
  res.status(201).json(year);
});

apiRouter.put('/academic-years/:id', authMiddleware, requireRoles(['ADMIN']), (req: Request, res: Response) => {
  const parsed = academicYearInputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Année scolaire invalide.' });
  const { label, startDate, endDate } = parsed.data;
  if (typeof label !== 'string' || typeof startDate !== 'string' || typeof endDate !== 'string') {
    return res.status(400).json({ error: 'Année scolaire invalide.' });
  }
  const data = db.getData();
  const year = data.academicYears.find(candidate => candidate.id === req.params.id);
  if (!year) return res.status(404).json({ error: 'Année scolaire introuvable.' });
  if (year.status === 'closed') return res.status(409).json({ error: 'Une année clôturée ne peut pas être modifiée.' });
  if (data.academicYears.some(candidate => candidate.id !== year.id && candidate.label.toLowerCase() === label.toLowerCase())) {
    return res.status(409).json({ error: 'Cette année scolaire existe déjà.' });
  }
  Object.assign(year, { label, startDate, endDate });
  db.persist();
  res.json(year);
});

apiRouter.delete('/academic-years/:id', authMiddleware, requireRoles(['ADMIN']), (req: Request, res: Response) => {
  const data = db.getData();
  const index = data.academicYears.findIndex(year => year.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: 'Année scolaire introuvable.' });
  const year = data.academicYears[index];
  if (year.status === 'active' || data.classes.some(item => item.academicYearId === year.id) ||
      data.students.some(item => item.academicYearId === year.id) || data.grades.some(item => item.academicYearId === year.id)) {
    return res.status(409).json({ error: 'Une année active ou utilisée par des données ne peut pas être supprimée.' });
  }
  data.academicYears.splice(index, 1);
  db.persist();
  res.json({ success: true });
});

apiRouter.post('/academic-years/:id/activate', authMiddleware, requireRoles(['ADMIN']), (req: Request, res: Response) => {
  const data = db.getData();
  const year = data.academicYears.find(candidate => candidate.id === req.params.id);
  if (!year) return res.status(404).json({ error: 'Année scolaire introuvable.' });
  if (year.status === 'closed') return res.status(409).json({ error: 'Une année clôturée ne peut pas être réactivée.' });
  for (const candidate of data.academicYears) {
    if (candidate.status === 'active') candidate.status = 'draft';
  }
  year.status = 'active';
  db.persist();
  res.json(year);
});

apiRouter.post('/academic-years/:id/close', authMiddleware, requireRoles(['ADMIN']), (req: Request, res: Response) => {
  const data = db.getData();
  const year = data.academicYears.find(candidate => candidate.id === req.params.id);
  if (!year) return res.status(404).json({ error: 'Année scolaire introuvable.' });
  year.status = 'closed';
  db.persist();
  res.json(year);
});

apiRouter.put('/school-profile', authMiddleware, requireRoles(['ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const profile = validateSchoolProfile(req.body?.profile);
  if (!profile) {
    return res.status(400).json({
      error: 'Profil invalide : vérifiez les champs, les couleurs hexadécimales et le logo PNG/JPEG (1 Mo maximum).',
    });
  }

  const data = db.getData();
  const previousProfile = data.schoolProfile;
  const previousName = data.establishmentName;
  const previousCity = data.establishmentCity;
  const previousAuditLogs = data.auditLogs;
  const now = new Date().toISOString();
  const auditEntry = {
    id: crypto.randomUUID(),
    userId: req.user!.id,
    userEmail: req.user!.email,
    action: 'UPDATE_SCHOOL_PROFILE',
    details: `Profil de l’établissement mis à jour (${profile.schoolName}).`,
    ipAddress: req.ip,
    createdAt: now,
  };

  try {
    data.schoolProfile = profile;
    data.establishmentName = profile.schoolName;
    data.establishmentCity = profile.city;
    data.auditLogs = [auditEntry, ...previousAuditLogs].slice(0, 500);
    db.persist();
  } catch (error) {
    data.schoolProfile = previousProfile;
    data.establishmentName = previousName;
    data.establishmentCity = previousCity;
    data.auditLogs = previousAuditLogs;
    console.error('School profile update failed and was rolled back:', error);
    return res.status(500).json({ error: 'Le profil de l’établissement n’a pas pu être enregistré.' });
  }

  res.json(data.schoolProfile);
});

// ============================================================================
// 2. UTILISATEURS (Admin uniquement)
// ============================================================================

apiRouter.get('/users', authMiddleware, requireRoles(['ADMIN']), (req: Request, res: Response) => {
  const data = db.getData();
  const safeUsers = data.users.map(({ passwordHash, ...u }) => u);
  res.json(safeUsers);
});

const createUserSchema = z.object({
  email: z.string().trim().email().transform(value => value.toLowerCase()),
  password: z.string(),
  nom: z.string().trim().min(1),
  prenom: z.string().trim().min(1),
  role: z.enum(ROLES).default('TEACHER'),
  telephone: z.string().optional(),
}).strict();

const updateUserSchema = z.object({
  email: z.string().trim().email().transform(value => value.toLowerCase()).optional(),
  password: z.string().optional(),
  nom: z.string().trim().min(1).optional(),
  prenom: z.string().trim().min(1).optional(),
  role: z.enum(ROLES).optional(),
  actif: z.boolean().optional(),
  telephone: z.string().optional(),
}).strict().refine(value => Object.values(value).some(item => item !== undefined));

apiRouter.post('/users', authMiddleware, requireRoles(['ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Nom, prénom, email et mot de passe sont obligatoires.' });
  }
  const { email, password, nom, prenom, role, telephone } = parsed.data;
  const passwordError = validatePassword(password);
  if (passwordError) return res.status(400).json({ error: passwordError });

  const data = db.getData();
  if (data.users.some(u => u.email.toLowerCase() === email)) {
    return res.status(409).json({ error: 'Un utilisateur avec cet email existe déjà.' });
  }

  const now = new Date().toISOString();
  const newUser: DbUser = {
    id: crypto.randomUUID(),
    email,
    passwordHash: await bcrypt.hash(password, BCRYPT_COST),
    nom: nom.toUpperCase(),
    prenom,
    telephone,
    role,
    actif: true,
    createdAt: now,
    updatedAt: now
  };

  data.users.push(newUser);
  db.persist();
  db.logAudit('CREATE_USER', `Création de l'utilisateur ${email} (${role})`, req.user?.id, req.user?.email, req.ip);

  const { passwordHash, ...safe } = newUser;
  res.status(201).json(safe);
});

apiRouter.put('/users/:id', authMiddleware, requireRoles(['ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Données utilisateur invalides.' });
  const data = db.getData();
  const user = data.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé.' });

  const { nom, prenom, email, role, actif, telephone, password } = parsed.data;
  const nextRole = role ?? user.role;
  const nextActive = actif ?? user.actif;
  if (email && email !== user.email && data.users.some(candidate => candidate.id !== user.id && candidate.email.toLowerCase() === email)) {
    return res.status(409).json({ error: 'Un utilisateur avec cet email existe déjà.' });
  }
  if (user.id === req.user?.id && (nextRole !== 'ADMIN' || !nextActive)) {
    return res.status(400).json({ error: 'Un administrateur ne peut pas retirer son propre rôle ADMIN ni se désactiver.' });
  }
  if (user.role === 'ADMIN' && user.actif && (nextRole !== 'ADMIN' || !nextActive)) {
    const activeAdmins = data.users.filter(candidate => candidate.role === 'ADMIN' && candidate.actif).length;
    if (activeAdmins <= 1) return res.status(400).json({ error: 'Le dernier administrateur actif ne peut pas être retiré.' });
  }
  if (password !== undefined) {
    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ error: passwordError });
    if (await bcrypt.compare(password, user.passwordHash)) {
      return res.status(400).json({ error: 'Le nouveau mot de passe doit être différent de l’ancien.' });
    }
    user.passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  }
  if (nom !== undefined) user.nom = nom.toUpperCase();
  if (prenom !== undefined) user.prenom = prenom;
  if (email !== undefined) user.email = email;
  user.role = nextRole;
  user.actif = nextActive;
  if (telephone !== undefined) user.telephone = telephone;
  user.updatedAt = new Date().toISOString();

  db.persist();
  db.logAudit('UPDATE_USER', `Mise à jour de l'utilisateur ${user.email}`, req.user?.id, req.user?.email, req.ip);

  const { passwordHash, ...safe } = user;
  res.json(safe);
});

// ============================================================================
// 3. ENSEIGNANTS
// ============================================================================

apiRouter.get('/teachers', authMiddleware, (req: Request, res: Response) => {
  const data = db.getData();
  res.json(data.teachers);
});

apiRouter.post('/teachers', authMiddleware, requireRoles(['ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  const { nom, prenom, email, telephone, specialite, createAccount, initialPassword } = req.body;
  if (!nom || !prenom || !email) {
    return res.status(400).json({ error: 'Nom, prénom et email sont requis.' });
  }

  const data = db.getData();
  const now = new Date().toISOString();
  let userId: string | undefined = undefined;

  if (createAccount && initialPassword) {
    const passwordError = validatePassword(initialPassword);
    if (passwordError) return res.status(400).json({ error: passwordError });
    const existingUser = data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      userId = existingUser.id;
    } else {
      const newUser: DbUser = {
        id: crypto.randomUUID(),
        email,
        passwordHash: await bcrypt.hash(initialPassword, BCRYPT_COST),
        nom: nom.toUpperCase(),
        prenom,
        telephone,
        role: 'TEACHER',
        actif: true,
        createdAt: now,
        updatedAt: now
      };
      data.users.push(newUser);
      userId = newUser.id;
    }
  }

  const teacher: DbTeacher = {
    id: crypto.randomUUID(),
    userId,
    nom: nom.toUpperCase(),
    prenom,
    email,
    telephone,
    specialite,
    statut: true,
    createdAt: now
  };

  data.teachers.push(teacher);
  db.persist();
  db.logAudit('CREATE_TEACHER', `Création enseignant: ${nom} ${prenom}`, req.user?.id, req.user?.email, req.ip);

  res.status(201).json(teacher);
});

apiRouter.put('/teachers/:id', authMiddleware, requireRoles(['ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const data = db.getData();
  const teacher = data.teachers.find(t => t.id === req.params.id);
  if (!teacher) return res.status(404).json({ error: 'Enseignant non trouvé.' });

  const { nom, prenom, email, telephone, specialite, statut } = req.body;
  if (nom) teacher.nom = nom.toUpperCase();
  if (prenom) teacher.prenom = prenom;
  if (email) teacher.email = email;
  if (telephone !== undefined) teacher.telephone = telephone;
  if (specialite !== undefined) teacher.specialite = specialite;
  if (typeof statut === 'boolean') teacher.statut = statut;

  db.persist();
  res.json(teacher);
});

// ============================================================================
// 4. CLASSES & NIVEAUX
// ============================================================================

apiRouter.get('/classes', authMiddleware, (req: Request, res: Response) => {
  const data = db.getData();
  res.json(data.classes);
});

apiRouter.post('/classes', authMiddleware, requireRoles(['ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const { nom, niveau, section, capacite, headTeacherId } = req.body;
  if (!nom || !niveau) {
    return res.status(400).json({ error: 'Nom de la classe et niveau requis.' });
  }

  const data = db.getData();
  const year = getActiveAcademicYear(data);
  if (!year) return res.status(409).json({ error: 'Aucune année scolaire active.' });
  if (data.classes.some(c => c.nom.toLowerCase() === nom.toLowerCase() && c.academicYearId === year.id)) {
    return res.status(400).json({ error: `La classe ${nom} existe déjà.` });
  }

  const newClass: DbClass = {
    id: crypto.randomUUID(),
    nom,
    niveau,
    section,
    capacite: Number(capacite) || 45,
    statut: true,
    academicYearId: year.id,
    headTeacherId,
    createdAt: new Date().toISOString()
  };

  data.classes.push(newClass);
  db.persist();
  db.logAudit('CREATE_CLASS', `Création classe: ${nom} (${niveau})`, req.user?.id, req.user?.email, req.ip);

  res.status(201).json(newClass);
});

apiRouter.put('/classes/:id', authMiddleware, requireRoles(['ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const data = db.getData();
  const cls = data.classes.find(c => c.id === req.params.id);
  if (!cls) return res.status(404).json({ error: 'Classe non trouvée.' });

  const { nom, niveau, section, capacite, headTeacherId, statut } = req.body;
  if (nom) cls.nom = nom;
  if (niveau) cls.niveau = niveau;
  if (section !== undefined) cls.section = section;
  if (capacite) cls.capacite = Number(capacite);
  if (headTeacherId !== undefined) cls.headTeacherId = headTeacherId;
  if (typeof statut === 'boolean') cls.statut = statut;

  db.persist();
  res.json(cls);
});

// ============================================================================
// 5. MATIÈRES & COEFFICIENTS
// ============================================================================

apiRouter.get('/subjects', authMiddleware, (req: Request, res: Response) => {
  const data = db.getData();
  res.json(data.subjects);
});

apiRouter.post('/subjects', authMiddleware, requireRoles(['ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const { nom, code, niveau, specialty, coeff } = req.body;
  if (!nom || !code) {
    return res.status(400).json({ error: 'Nom et code de matière requis.' });
  }

  const data = db.getData();
  const newSubject: DbSubject = {
    id: crypto.randomUUID(),
    nom,
    code: code.toUpperCase(),
    niveau: niveau || 'Collège',
    specialty: specialty || 'Sciences',
    coeff: Number(coeff) || 2,
    statut: true,
    createdAt: new Date().toISOString()
  };

  data.subjects.push(newSubject);
  db.persist();
  db.logAudit('CREATE_SUBJECT', `Création matière: ${nom} (${code})`, req.user?.id, req.user?.email, req.ip);

  res.status(201).json(newSubject);
});

apiRouter.put('/subjects/:id', authMiddleware, requireRoles(['ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const data = db.getData();
  const sub = data.subjects.find(s => s.id === req.params.id);
  if (!sub) return res.status(404).json({ error: 'Matière non trouvée.' });

  const { nom, code, niveau, specialty, coeff, statut } = req.body;
  if (nom) sub.nom = nom;
  if (code) sub.code = code.toUpperCase();
  if (niveau) sub.niveau = niveau;
  if (specialty) sub.specialty = specialty;
  if (coeff !== undefined) sub.coeff = Number(coeff);
  if (typeof statut === 'boolean') sub.statut = statut;

  db.persist();
  res.json(sub);
});

// ============================================================================
// 6. ÉLÈVES
// ============================================================================

apiRouter.get('/students', authMiddleware, requireRoles(STAFF_ROLES), (req: AuthenticatedRequest, res: Response) => {
  const { classId, className, search } = req.query;
  const data = db.getData();
  let list = data.students.filter(s => s.statut);
  const scopedClassIds = teacherClassIds(req, data);
  if (scopedClassIds) list = list.filter(s => scopedClassIds.has(s.classId));

  if (classId) {
    const cls = resolveClass(data, classId, className);
    if (!cls) return rejectMismatchedReference(res, 'classId/className ne correspondent pas à une classe existante.');
    if (!teacherCanAccessClass(req as AuthenticatedRequest, cls)) return res.status(403).json({ error: 'Accès limité à votre périmètre de classe.' });
    list = list.filter(s => s.classId === cls.id);
  } else if (className) {
    return rejectMismatchedReference(res, 'Utilisez classId et le libellé exact de la classe.');
  }
  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    list = list.filter(s =>
      s.nom.toLowerCase().includes(q) ||
      s.prenom.toLowerCase().includes(q) ||
      s.matricule.toLowerCase().includes(q)
    );
  }

  res.json(list);
});

apiRouter.post('/students', authMiddleware, requireRoles(STAFF_ROLES), (req: AuthenticatedRequest, res: Response) => {
  const { matricule, nom, prenom, sexe, dateNaissance, lieuNaissance, parentPhone, classId, className } = normalizeStudentInput(req.body);
  if (typeof nom !== 'string' || !nom.trim() || typeof prenom !== 'string' || !prenom.trim() || typeof dateNaissance !== 'string' || !dateNaissance.trim()) {
    return res.status(400).json({ error: 'Nom, prénom et date de naissance requis.' });
  }

  const data = db.getData();
  const cls = resolveClass(data, classId, className);
  if (!cls) return rejectMismatchedReference(res, 'classId doit désigner une classe existante et className doit correspondre exactement.');
  const year = getActiveAcademicYear(data);
  if (!year || cls.academicYearId !== year.id) {
    return res.status(409).json({ error: 'La classe n’appartient pas à l’année scolaire active.' });
  }
  if (!teacherCanAccessClass(req, cls)) return res.status(403).json({ error: 'Vous ne pouvez gérer que votre périmètre de classe.' });
  const targetClassId = cls.id;
  const targetClassName = cls.nom;

  if (!isValidBirthDate(dateNaissance.trim())) {
    return res.status(400).json({ error: 'La date de naissance doit être une date réelle au format jj/mm/aaaa et ne pas être future.' });
  }
  const autoMatricule = typeof matricule === 'string' && matricule.trim()
    ? matricule.trim()
    : generateMatricule(data);
  if (data.students.some(student => student.matricule.toLowerCase() === autoMatricule.toLowerCase())) {
    return res.status(409).json({ error: `Le matricule ${autoMatricule} existe déjà.` });
  }
  const now = new Date().toISOString();

  const newStudent: DbStudent = {
    id: crypto.randomUUID(),
    matricule: autoMatricule,
    nom: nom.trim().toUpperCase(),
    prenom: prenom.trim(),
    sexe: sexe === 'F' ? 'F' : 'M',
    dateNaissance: dateNaissance.trim(),
    lieuNaissance: lieuNaissance || 'Brazzaville',
    parentPhone: parentPhone || '',
    classId: targetClassId,
    className: targetClassName,
    academicYearId: year.id,
    statut: true,
    createdAt: now,
    updatedAt: now
  };

  const previousStudents = data.students;
  try {
    data.students = [...previousStudents, newStudent];
    db.persist();
  } catch (error) {
    data.students = previousStudents;
    console.error('Student creation failed and was rolled back:', error);
    return res.status(500).json({ error: 'La création de l’élève a échoué; aucune donnée n’a été modifiée.' });
  }
  db.logAudit('CREATE_STUDENT', `Nouvel élève inscrit: ${autoMatricule} - ${nom} ${prenom} (${targetClassName})`, req.user?.id, req.user?.email, req.ip);

  res.status(201).json(newStudent);
});

apiRouter.put('/students/:id', authMiddleware, requireRoles(STAFF_ROLES), (req: AuthenticatedRequest, res: Response) => {
  const data = db.getData();
  const student = data.students.find(s => s.id === req.params.id || s.matricule === req.params.id);
  if (!student) return res.status(404).json({ error: 'Élève non trouvé.' });
  const previousStudent = { ...student };

  const { nom, prenom, sexe, dateNaissance, lieuNaissance, parentPhone, classId, className, statut } = normalizeStudentInput(req.body);
  if (typeof nom === 'string' && nom.trim()) student.nom = nom.trim().toUpperCase();
  if (typeof prenom === 'string' && prenom.trim()) student.prenom = prenom.trim();
  if (sexe) student.sexe = sexe === 'F' ? 'F' : 'M';
  if (typeof dateNaissance === 'string' && dateNaissance.trim()) {
    if (!isValidBirthDate(dateNaissance.trim())) {
      return res.status(400).json({ error: 'La date de naissance doit être une date réelle au format jj/mm/aaaa et ne pas être future.' });
    }
    student.dateNaissance = dateNaissance.trim();
  }
  if (lieuNaissance !== undefined) student.lieuNaissance = lieuNaissance;
  if (parentPhone !== undefined) student.parentPhone = parentPhone;
  if (classId !== undefined || className !== undefined) {
    const cls = resolveClass(data, classId || student.classId, className || student.className);
    if (!cls) return rejectMismatchedReference(res, 'classId et className doivent désigner la même classe existante.');
    if (!teacherCanAccessClass(req, cls)) return res.status(403).json({ error: 'Vous ne pouvez gérer que votre périmètre de classe.' });
    student.classId = cls.id;
    student.className = cls.nom;
  }
  if (typeof statut === 'boolean') student.statut = statut;
  student.updatedAt = new Date().toISOString();

  try {
    db.persist();
  } catch (error) {
    Object.assign(student, previousStudent);
    console.error('Student update failed and was rolled back:', error);
    return res.status(500).json({ error: 'La mise à jour de l’élève a échoué; aucune donnée n’a été modifiée.' });
  }
  res.json(student);
});

apiRouter.delete('/students/:id', authMiddleware, requireRoles(['ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const data = db.getData();
  const idx = data.students.findIndex(s => s.id === req.params.id || s.matricule === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Élève non trouvé.' });

  const removed = data.students[idx];
  removed.statut = false; // Soft delete
  db.persist();
  db.logAudit('DELETE_STUDENT', `Suppression élève: ${removed.matricule} ${removed.nom}`, req.user?.id, req.user?.email, req.ip);

  res.json({ success: true, message: `Élève ${removed.nom} ${removed.prenom} désactivé.` });
});

// Import par lot (Excel)
apiRouter.post('/students/batch-import', authMiddleware, requireRoles(STAFF_ROLES), (req: AuthenticatedRequest, res: Response) => {
  const { students: importedList, targetClassId, targetClassName } = req.body;
  if (!Array.isArray(importedList) || importedList.length === 0) {
    return res.status(400).json({ error: 'Liste d’élèves invalide ou vide.' });
  }

  const data = db.getData();
  const cls = resolveClass(data, targetClassId, targetClassName);
  if (!cls) return rejectMismatchedReference(res, 'targetClassId doit désigner une classe existante et targetClassName doit correspondre.');
  const year = getActiveAcademicYear(data);
  if (!year || cls.academicYearId !== year.id) {
    return res.status(409).json({ error: 'La classe n’appartient pas à l’année scolaire active.' });
  }
  if (!teacherCanAccessClass(req, cls)) return res.status(403).json({ error: 'Vous ne pouvez importer que dans votre périmètre de classe.' });
  const now = new Date().toISOString();
  const pendingStudents: DbStudent[] = [];
  const importedMatricules = new Set<string>();
  for (const rawRow of importedList) {
    if (!isRecord(rawRow)) {
      return res.status(400).json({ error: 'Chaque ligne importée doit être un objet valide.' });
    }
    const row = normalizeStudentInput(rawRow);
    if (!row.nom?.trim() || !row.prenom?.trim()) {
      return res.status(400).json({ error: 'Chaque ligne importée doit contenir un nom et un prénom.' });
    }
    const dateNaissance = String(row.dateNaissance || '01/01/2010');
    if (!isValidBirthDate(dateNaissance)) {
      return res.status(400).json({ error: `Date de naissance invalide pour ${row.nom}: utilisez jj/mm/aaaa et une date passée ou présente.` });
    }
    const matricule = row.matricule?.trim() || generateMatricule({
      ...data,
      students: [...data.students, ...pendingStudents],
    });
    const normalizedMatricule = matricule.toLowerCase();
    if (
      data.students.some(student => student.matricule.trim().toLowerCase() === normalizedMatricule) ||
      importedMatricules.has(normalizedMatricule)
    ) {
      return res.status(409).json({ error: `Matricule dupliqué: ${matricule}. Import annulé.` });
    }
    importedMatricules.add(normalizedMatricule);

    const newStudent: DbStudent = {
      id: crypto.randomUUID(),
      matricule,
      nom: row.nom.trim().toUpperCase(),
      prenom: row.prenom.trim(),
      sexe: row.sexe === 'F' ? 'F' : 'M',
      dateNaissance,
      parentPhone: row.parentPhone || '',
      classId: cls.id,
      className: cls.nom,
      academicYearId: year.id,
      statut: true,
      createdAt: now,
      updatedAt: now
    };
    pendingStudents.push(newStudent);
  }

  const previousStudents = data.students;
  try {
    data.students = [...previousStudents, ...pendingStudents];
    db.persist();
  } catch (error) {
    data.students = previousStudents;
    console.error('Student import failed and was rolled back:', error);
    return res.status(500).json({ error: 'L’import a échoué; aucun élève n’a été ajouté.' });
  }
  db.logAudit('BATCH_IMPORT_STUDENTS', `Import de ${pendingStudents.length} élèves depuis Excel`, req.user?.id, req.user?.email, req.ip);

  res.json({ success: true, importedCount: pendingStudents.length, total: data.students.length });
});

// ============================================================================
// 7. NOTES & ÉVALUATIONS (Validation stricte 0 <= note <= 20)
// ============================================================================

apiRouter.get('/grades', authMiddleware, requireRoles(STAFF_ROLES), (req: AuthenticatedRequest, res: Response) => {
  const { classId, className, term, studentId } = req.query;
  const data = db.getData();
  let list = data.grades;
  const scopedClassIds = teacherClassIds(req, data);
  if (scopedClassIds) list = list.filter(g => scopedClassIds.has(g.classId));

  if (studentId) list = list.filter(g => g.studentId === studentId);
  if (classId) {
    const cls = resolveClass(data, classId, className);
    if (!cls) return rejectMismatchedReference(res, 'classId/className ne correspondent pas à une classe existante.');
    if (!teacherCanAccessClass(req, cls)) return res.status(403).json({ error: 'Accès limité à votre périmètre de classe.' });
    list = list.filter(g => g.classId === cls.id);
  } else if (className) {
    return rejectMismatchedReference(res, 'Utilisez classId et le libellé exact de la classe.');
  }
  if (term) list = list.filter(g => g.term === term);

  res.json(list);
});

// Saisie en lot sécurisée
apiRouter.post('/grades/batch', authMiddleware, requireRoles(STAFF_ROLES), (req: AuthenticatedRequest, res: Response) => {
  const { grades: gradeEntries, classId, className, term } = req.body;
  if (!Array.isArray(gradeEntries) || gradeEntries.length === 0 || typeof classId !== 'string' || typeof className !== 'string') {
    return res.status(400).json({ error: 'Format de notes invalide.' });
  }

  const data = db.getData();
  const cls = resolveClass(data, classId, className);
  if (!cls) return rejectMismatchedReference(res, 'classId/className ne correspondent pas à une classe existante.');
  const activeYear = getActiveAcademicYear(data);
  if (!activeYear || cls.academicYearId !== activeYear.id) {
    return res.status(409).json({ error: 'La saisie est limitée aux classes de l’année scolaire active.' });
  }
  if (!teacherCanAccessClass(req, cls)) return res.status(403).json({ error: 'Vous ne pouvez saisir des notes que dans votre périmètre de classe.' });
  const actorTeacherId = data.teachers.find(teacher => teacher.userId === req.user?.id)?.id;
  const selectedTerm = term || '1er Trimestre';
  if (!TERMS.includes(selectedTerm)) return res.status(400).json({ error: 'Trimestre invalide.' });
  const now = new Date().toISOString();
  const previousGrades = data.grades;
  const nextGrades = [...data.grades];

  for (const entry of gradeEntries) {
    if (!isRecord(entry)) {
      return res.status(400).json({ error: 'Entrée de note invalide; lot annulé.' });
    }
    const { studentId, subjectId, evaluations, dev1, dev2, composition, observation } = entry;
    if (typeof studentId !== 'string' || typeof subjectId !== 'string' ||
        (observation !== undefined && observation !== null && typeof observation !== 'string')) {
      return res.status(400).json({ error: 'Référence ou observation de note invalide; lot annulé.' });
    }
    const gradeObservation = typeof observation === 'string' ? observation : undefined;
    const student = data.students.find(candidate => candidate.id === studentId && candidate.statut);
    const subject = data.subjects.find(candidate => candidate.id === subjectId && candidate.statut);
    if (!student || student.classId !== cls.id || student.academicYearId !== activeYear.id) {
      return res.status(400).json({ error: `Élève ${studentId} absent de la classe ${cls.id}. Lot annulé.` });
    }
    if (!subject) {
      return res.status(400).json({ error: `Matière inconnue: ${subjectId}. Lot annulé.` });
    }

    let ev: number | null;
    let d1: number | null;
    let d2: number | null;
    let cp: number | null;
    try {
      ev = parseGrade(evaluations);
      d1 = parseGrade(dev1);
      d2 = parseGrade(dev2);
      cp = parseGrade(composition);
    } catch (error) {
      return res.status(400).json({
        error: `Valeur de note invalide pour l'élève ${studentId}: ${error instanceof Error ? error.message : 'lot annulé.'}`
      });
    }

    const existingIdx = nextGrades.findIndex(
      g => g.studentId === studentId && g.subjectId === subjectId && g.classId === cls.id &&
        g.academicYearId === activeYear.id && g.term === selectedTerm
    );

    if (existingIdx < 0 && ev === null && d1 === null && d2 === null && cp === null && observation === undefined) {
      continue;
    }
    if (existingIdx >= 0) {
      nextGrades[existingIdx] = {
        ...nextGrades[existingIdx],
        evaluations: ev,
        dev1: d1,
        dev2: d2,
        composition: cp,
        observation: gradeObservation ?? nextGrades[existingIdx].observation,
        teacherId: actorTeacherId ?? nextGrades[existingIdx].teacherId,
        updatedAt: now
      };
    } else {
      nextGrades.push({
        id: crypto.randomUUID(),
        studentId,
        subjectId,
        subjectName: subject.nom,
        classId: cls.id,
        className: cls.nom,
        teacherId: actorTeacherId,
        academicYearId: activeYear.id,
        term: selectedTerm,
        evaluations: ev,
        dev1: d1,
        dev2: d2,
        composition: cp,
        observation: gradeObservation,
        createdAt: now,
        updatedAt: now
      });
    }
  }

  try {
    data.grades = nextGrades;
    db.persist();
  } catch (error) {
    data.grades = previousGrades;
    console.error('Batch grade update failed and was rolled back:', error);
    return res.status(500).json({ error: 'La saisie des notes a échoué; aucune note n’a été modifiée.' });
  }
  db.logAudit('BATCH_UPDATE_GRADES', `Mise à jour atomique de ${gradeEntries.length} notes pour classe ${cls.nom}`, req.user?.id, req.user?.email, req.ip);

  res.json({ success: true, updatedCount: gradeEntries.length });
});

// ============================================================================
// 8. RÉSULTATS, CLASSEMENTS & MOYENNES (Calculs serveur certifiés)
// ============================================================================

apiRouter.get('/results/class/:classId', authMiddleware, requireRoles(STAFF_ROLES), (req: AuthenticatedRequest, res: Response) => {
  const { classId } = req.params;
  const term = (req.query.term as typeof TERMS[number]) || '1er Trimestre';

  const data = db.getData();
  const cls = resolveClass(data, classId);
  if (!cls) return res.status(404).json({ error: 'Classe inconnue.' });
  if (!teacherCanAccessClass(req, cls)) return res.status(403).json({ error: 'Accès limité à votre périmètre de classe.' });

  const results = computeClassResults(cls.id, term);
  res.json({
    classId: cls.id,
    className: cls.nom,
    term,
    results
  });
});

// ============================================================================
// 9. TABLEAU DE BORD (Statistiques centralisées réelles)
// ============================================================================

apiRouter.get('/stats/dashboard', authMiddleware, (req: Request, res: Response) => {
  const term = (req.query.term as any) || '1er Trimestre';
  const stats = computeEstablishmentStats(term);
  res.json(stats);
});

// ============================================================================
// 10. SAUVEGARDE & RESTAURATION (Export/Import JSON de la base)
// ============================================================================

apiRouter.get('/backup/export', authMiddleware, requireRoles(['ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const data = db.getData();
  db.logAudit('BACKUP_EXPORT', 'Téléchargement de sauvegarde complète de la base de données', req.user?.id, req.user?.email, req.ip);
  res.setHeader('Content-Type', 'application/json');
  const schoolSlug = data.schoolProfile.schoolName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'ecole';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  res.setHeader('Content-Disposition', `attachment; filename="${schoolSlug}_backup_${timestamp}.json"`);
  res.send(JSON.stringify(sanitizeBackup(data), null, 2));
});

apiRouter.post('/backup/restore', authMiddleware, requireRoles(['ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const { backupData, dryRun = false } = req.body || {};
  if (typeof dryRun !== 'boolean') return res.status(400).json({ error: 'dryRun doit être un booléen.' });
  const validation = validateBackup(backupData);
  if (validation.data?.schoolProfile && !validateSchoolProfile(validation.data.schoolProfile)) {
    validation.errors.push('schoolProfile: profil d’établissement invalide.');
  }
  if (dryRun) {
    return res.json({
      valid: validation.data !== null && validation.errors.length === 0,
      counts: validation.counts,
      errors: validation.errors,
    });
  }
  if (!validation.data || validation.errors.length > 0) {
    return res.status(400).json({ error: 'Fichier de sauvegarde invalide.', errors: validation.errors });
  }

  const backup = validation.data;
  const current = db.getData();
  const previous = JSON.parse(JSON.stringify(current)) as typeof current;
  const before = {
    students: current.students.length,
    grades: current.grades.length
  };
  const schoolClassById = new Map(backup.classes.map(schoolClass => [schoolClass.id, schoolClass]));
  const timestamp = new Date().toISOString();
  const restoredStudents: DbStudent[] = backup.students.map(student => ({
    id: student.id,
    matricule: student.matricule,
    nom: student.nom,
    prenom: student.prenom,
    sexe: student.sexe,
    dateNaissance: student.dateNaissance,
    lieuNaissance: typeof student.lieuNaissance === 'string' ? student.lieuNaissance : undefined,
    adresse: typeof student.adresse === 'string' ? student.adresse : undefined,
    telephone: typeof student.telephone === 'string' ? student.telephone : undefined,
    parentPhone: typeof student.parentPhone === 'string' ? student.parentPhone : undefined,
    email: typeof student.email === 'string' ? student.email : undefined,
    photoUrl: typeof student.photoUrl === 'string' ? student.photoUrl : undefined,
    statut: student.statut,
    classId: student.classId,
    className: student.className,
    academicYearId: student.academicYearId || schoolClassById.get(student.classId)!.academicYearId,
    createdAt: typeof student.createdAt === 'string' ? student.createdAt : timestamp,
    updatedAt: typeof student.updatedAt === 'string' ? student.updatedAt : timestamp,
  }));
  const restoredClasses: DbClass[] = backup.classes.map(schoolClass => ({
    id: schoolClass.id,
    nom: schoolClass.nom,
    niveau: schoolClass.niveau,
    section: typeof schoolClass.section === 'string' ? schoolClass.section : undefined,
    capacite: schoolClass.capacite,
    statut: schoolClass.statut,
    academicYearId: schoolClass.academicYearId,
    headTeacherId: typeof schoolClass.headTeacherId === 'string' ? schoolClass.headTeacherId : undefined,
    createdAt: typeof schoolClass.createdAt === 'string' ? schoolClass.createdAt : timestamp,
  }));
  const restoredGrades: DbGrade[] = backup.grades.map(grade => ({
    id: grade.id,
    studentId: grade.studentId,
    subjectId: grade.subjectId,
    subjectName: grade.subjectName,
    classId: grade.classId,
    className: grade.className,
    teacherId: typeof grade.teacherId === 'string' ? grade.teacherId : undefined,
    academicYearId: grade.academicYearId || schoolClassById.get(grade.classId)!.academicYearId,
    term: grade.term,
    evaluations: grade.evaluations,
    dev1: grade.dev1,
    dev2: grade.dev2,
    composition: grade.composition,
    observation: typeof grade.observation === 'string' ? grade.observation : undefined,
    createdAt: typeof grade.createdAt === 'string' ? grade.createdAt : timestamp,
    updatedAt: typeof grade.updatedAt === 'string' ? grade.updatedAt : timestamp,
  }));
  const restoredSubjects: DbSubject[] = backup.subjects.map(subject => ({
    id: subject.id,
    nom: subject.nom,
    code: subject.code,
    niveau: subject.niveau,
    specialty: subject.specialty,
    coeff: subject.coeff,
    statut: subject.statut,
    createdAt: typeof subject.createdAt === 'string' ? subject.createdAt : timestamp,
  }));
  const restoredTeachers: DbTeacher[] = backup.teachers.map(teacher => ({
    id: teacher.id,
    userId: teacher.userId,
    nom: teacher.nom,
    prenom: teacher.prenom,
    email: teacher.email,
    telephone: typeof teacher.telephone === 'string' ? teacher.telephone : undefined,
    specialite: typeof teacher.specialite === 'string' ? teacher.specialite : undefined,
    statut: teacher.statut,
    createdAt: typeof teacher.createdAt === 'string' ? teacher.createdAt : timestamp,
  }));
  const restoredYears: DbAcademicYear[] | undefined = backup.academicYears?.map(year => ({
    id: year.id,
    label: year.label,
    startDate: year.startDate,
    endDate: year.endDate,
    status: year.status,
    createdAt: year.createdAt,
  }));
  const restoredProfile = backup.schoolProfile ? validateSchoolProfile(backup.schoolProfile) : current.schoolProfile;
  const restored = {
    ...current,
    academicYears: restoredYears || current.academicYears,
    students: restoredStudents,
    grades: restoredGrades,
    classes: restoredClasses,
    subjects: restoredSubjects,
    teachers: backup.teachers.length > 0 ? restoredTeachers : current.teachers,
    schoolProfile: restoredProfile,
    establishmentName: restoredProfile.schoolName,
    establishmentCity: restoredProfile.city,
  };

  try {
    db.createPreRestoreBackup();
    Object.assign(current, restored);
    db.persist();
  } catch (error) {
    Object.assign(current, previous);
    console.error('Backup restore failed and was rolled back:', error);
    return res.status(500).json({ error: 'La restauration a échoué; aucune donnée n’a été modifiée.' });
  }
  db.logAudit(
    'BACKUP_RESTORE',
    `Restauration complète: avant élèves=${before.students}, notes=${before.grades}; après élèves=${restored.students.length}, notes=${restored.grades.length}`,
    req.user?.id,
    req.user?.email,
    req.ip
  );

  res.json({
    success: true,
    message: 'Base de données restaurée avec succès.',
    counts: {
      students: restored.students.length,
      grades: restored.grades.length,
      classes: restored.classes.length,
      subjects: restored.subjects.length,
      academicYears: restored.academicYears.length,
    },
  });
});

// Journal d'audit
apiRouter.get('/audit-logs', authMiddleware, requireRoles(['ADMIN']), (req: Request, res: Response) => {
  const data = db.getData();
  res.json(data.auditLogs);
});
