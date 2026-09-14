import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db, DbUser, DbStudent, DbTeacher, DbClass, DbSubject, DbGrade } from './db.js';
import { authMiddleware, requireRoles, generateToken, AuthenticatedRequest } from './auth.js';
import { computeClassResults, computeEstablishmentStats } from './academic.js';

export const apiRouter = Router();

const TEACHER_SCOPED_ROLES = ['TEACHER'];
const STAFF_ROLES = ['ADMIN', 'DIRECTOR', 'SECRETARY', 'TEACHER'];
const TERMS = ['1er Trimestre', '2ème Trimestre', '3ème Trimestre'] as const;

function resolveClass(data: ReturnType<typeof db.getData>, classId?: unknown, className?: unknown) {
  if (typeof classId !== 'string' || !classId) return null;
  const cls = data.classes.find(candidate => candidate.id === classId);
  if (!cls || (className !== undefined && className !== cls.nom)) return null;
  return cls;
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
apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis.' });
  }

  const data = db.getData();
  const user = data.users.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (!user) {
    return res.status(401).json({ error: 'Identifiants invalides (email introuvable).' });
  }

  if (!user.actif) {
    return res.status(403).json({ error: 'Ce compte utilisateur a été désactivé par l’administration.' });
  }

  const valid = bcrypt.compareSync(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Mot de passe incorrect.' });
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

// POST /api/auth/change-password
apiRouter.post('/auth/change-password', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const { oldPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Le nouveau mot de passe doit comporter au moins 6 caractères.' });
  }

  const data = db.getData();
  const user = data.users.find(u => u.id === req.user?.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });

  if (oldPassword && !bcrypt.compareSync(oldPassword, user.passwordHash)) {
    return res.status(400).json({ error: 'L’ancien mot de passe est incorrect.' });
  }

  user.passwordHash = bcrypt.hashSync(newPassword, 10);
  user.updatedAt = new Date().toISOString();
  db.persist();
  db.logAudit('CHANGE_PASSWORD', `Changement de mot de passe pour ${user.email}`, user.id, user.email, req.ip);

  res.json({ success: true, message: 'Mot de passe mis à jour avec succès.' });
});

// ============================================================================
// 2. UTILISATEURS (Admin uniquement)
// ============================================================================

apiRouter.get('/users', authMiddleware, requireRoles(['ADMIN']), (req: Request, res: Response) => {
  const data = db.getData();
  const safeUsers = data.users.map(({ passwordHash, ...u }) => u);
  res.json(safeUsers);
});

apiRouter.post('/users', authMiddleware, requireRoles(['ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const { email, password, nom, prenom, role, telephone } = req.body;
  if (!email || !password || !nom || !prenom) {
    return res.status(400).json({ error: 'Nom, prénom, email et mot de passe sont obligatoires.' });
  }

  const data = db.getData();
  if (data.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(400).json({ error: 'Un utilisateur avec cet email existe déjà.' });
  }

  const now = new Date().toISOString();
  const newUser: DbUser = {
    id: `usr-${Date.now()}`,
    email,
    passwordHash: bcrypt.hashSync(password, 10),
    nom: nom.toUpperCase(),
    prenom,
    telephone,
    role: role || 'TEACHER',
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

apiRouter.put('/users/:id', authMiddleware, requireRoles(['ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const data = db.getData();
  const user = data.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé.' });

  const { nom, prenom, role, actif, telephone, password } = req.body;
  if (nom) user.nom = nom.toUpperCase();
  if (prenom) user.prenom = prenom;
  if (role) user.role = role;
  if (typeof actif === 'boolean') user.actif = actif;
  if (telephone !== undefined) user.telephone = telephone;
  if (password && password.length >= 6) {
    user.passwordHash = bcrypt.hashSync(password, 10);
  }
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

apiRouter.post('/teachers', authMiddleware, requireRoles(['ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const { nom, prenom, email, telephone, specialite, createAccount, initialPassword } = req.body;
  if (!nom || !prenom || !email) {
    return res.status(400).json({ error: 'Nom, prénom et email sont requis.' });
  }

  const data = db.getData();
  const now = new Date().toISOString();
  let userId: string | undefined = undefined;

  if (createAccount && initialPassword) {
    const existingUser = data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      userId = existingUser.id;
    } else {
      const newUser: DbUser = {
        id: `usr-${Date.now()}`,
        email,
        passwordHash: bcrypt.hashSync(initialPassword, 10),
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
    id: `tch-${Date.now()}`,
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
  if (data.classes.some(c => c.nom.toLowerCase() === nom.toLowerCase())) {
    return res.status(400).json({ error: `La classe ${nom} existe déjà.` });
  }

  const newClass: DbClass = {
    id: `cls-${Date.now()}`,
    nom,
    niveau,
    section,
    capacite: Number(capacite) || 45,
    statut: true,
    academicYearId: 'ay-2025-2026',
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
    id: `sub-${Date.now()}`,
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
  if (!teacherCanAccessClass(req, cls)) return res.status(403).json({ error: 'Vous ne pouvez gérer que votre périmètre de classe.' });
  const targetClassId = cls.id;
  const targetClassName = cls.nom;

  const autoMatricule = typeof matricule === 'string' && matricule.trim()
    ? matricule.trim()
    : `CEM-${String(data.students.length + 1).padStart(3, '0')}`;
  const now = new Date().toISOString();

  const newStudent: DbStudent = {
    id: autoMatricule,
    matricule: autoMatricule,
    nom: nom.trim().toUpperCase(),
    prenom: prenom.trim(),
    sexe: sexe === 'F' ? 'F' : 'M',
    dateNaissance: dateNaissance.trim(),
    lieuNaissance: lieuNaissance || 'Brazzaville',
    parentPhone: parentPhone || '',
    classId: targetClassId,
    className: targetClassName,
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
  if (typeof dateNaissance === 'string' && dateNaissance.trim()) student.dateNaissance = dateNaissance.trim();
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
  if (!teacherCanAccessClass(req, cls)) return res.status(403).json({ error: 'Vous ne pouvez importer que dans votre périmètre de classe.' });
  const now = new Date().toISOString();
  const pendingStudents: DbStudent[] = [];
  const importedMatricules = new Set<string>();
  for (const row of importedList) {
    if (!row || !row.nom || !row.prenom) {
      return res.status(400).json({ error: 'Chaque ligne importée doit contenir un nom et un prénom.' });
    }
    const matricule = row.matricule || `CEM-${String(data.students.length + 1 + pendingStudents.length).padStart(3, '0')}`;
    
    // Vérifier doublon
    if (data.students.some(s => s.matricule === matricule) || importedMatricules.has(matricule)) {
      return res.status(400).json({ error: `Matricule dupliqué: ${matricule}. Import annulé.` });
    }
    importedMatricules.add(matricule);

    const newStudent: DbStudent = {
      id: matricule,
      matricule,
      nom: String(row.nom).toUpperCase(),
      prenom: String(row.prenom),
      sexe: row.sexe === 'F' ? 'F' : 'M',
      dateNaissance: row.dateNaissance || row.dob || '01/01/2010',
      parentPhone: row.parentPhone || row.telephone || '',
      classId: cls.id,
      className: cls.nom,
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
  if (!teacherCanAccessClass(req, cls)) return res.status(403).json({ error: 'Vous ne pouvez saisir des notes que dans votre périmètre de classe.' });
  const actorTeacherId = data.teachers.find(teacher => teacher.userId === req.user?.id)?.id;
  const selectedTerm = term || '1er Trimestre';
  if (!TERMS.includes(selectedTerm)) return res.status(400).json({ error: 'Trimestre invalide.' });
  const now = new Date().toISOString();
  const previousGrades = data.grades;
  const nextGrades = [...data.grades];

  for (const entry of gradeEntries) {
    const { studentId, subjectId, evaluations, dev1, dev2, composition, observation } = entry;
    const student = data.students.find(candidate => candidate.id === studentId && candidate.statut);
    const subject = data.subjects.find(candidate => candidate.id === subjectId && candidate.statut);
    if (!student || student.classId !== cls.id) {
      return res.status(400).json({ error: `Élève ${studentId} absent de la classe ${cls.id}. Lot annulé.` });
    }
    if (!subject) {
      return res.status(400).json({ error: `Matière inconnue: ${subjectId}. Lot annulé.` });
    }

    // Validation stricte 0 <= note <= 20
    const ev = Number(evaluations);
    const d1 = Number(dev1);
    const d2 = Number(dev2);
    const cp = Number(composition);

    if (
      isNaN(ev) || ev < 0 || ev > 20 ||
      isNaN(d1) || d1 < 0 || d1 > 20 ||
      isNaN(d2) || d2 < 0 || d2 > 20 ||
      isNaN(cp) || cp < 0 || cp > 20
    ) {
      return res.status(400).json({
        error: `Valeur de note invalide pour l'élève ${studentId}. Toutes les notes doivent être des nombres compris entre 0 et 20.`
      });
    }

    const existingIdx = nextGrades.findIndex(
      g => g.studentId === studentId && g.subjectId === subjectId && g.classId === cls.id && g.term === selectedTerm
    );

    if (existingIdx >= 0) {
      nextGrades[existingIdx] = {
        ...nextGrades[existingIdx],
        evaluations: ev,
        dev1: d1,
        dev2: d2,
        composition: cp,
        observation: observation ?? nextGrades[existingIdx].observation,
        teacherId: actorTeacherId ?? nextGrades[existingIdx].teacherId,
        updatedAt: now
      };
    } else {
      nextGrades.push({
        id: `grd-${studentId}-${subjectId}-${Date.now()}`,
        studentId,
        subjectId,
        subjectName: subject.nom,
        classId: cls.id,
        className: cls.nom,
        teacherId: actorTeacherId,
        academicYearId: 'ay-2025-2026',
        term: selectedTerm,
        evaluations: ev,
        dev1: d1,
        dev2: d2,
        composition: cp,
        observation,
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
  res.setHeader('Content-Disposition', `attachment; filename="ceminace_backup_${Date.now()}.json"`);
  res.send(JSON.stringify(data, null, 2));
});

apiRouter.post('/backup/restore', authMiddleware, requireRoles(['ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const { backupData } = req.body;
  if (
    !backupData ||
    !Array.isArray(backupData.students) ||
    !Array.isArray(backupData.users) ||
    !Array.isArray(backupData.classes) ||
    !Array.isArray(backupData.subjects) ||
    !Array.isArray(backupData.grades)
  ) {
    return res.status(400).json({ error: 'Fichier de sauvegarde invalide.' });
  }

  const current = db.getData();
  const previous = JSON.parse(JSON.stringify(current)) as typeof current;
  const before = {
    users: current.users.length,
    students: current.students.length,
    grades: current.grades.length
  };
  const restored = {
    ...current,
    users: backupData.users,
    students: backupData.students,
    grades: backupData.grades,
    classes: backupData.classes,
    subjects: backupData.subjects,
    teachers: Array.isArray(backupData.teachers) ? backupData.teachers : current.teachers
  };

  try {
    Object.assign(current, restored);
    db.persist();
  } catch (error) {
    Object.assign(current, previous);
    console.error('Backup restore failed and was rolled back:', error);
    return res.status(500).json({ error: 'La restauration a échoué; aucune donnée n’a été modifiée.' });
  }
  db.logAudit(
    'BACKUP_RESTORE',
    `Restauration complète: avant users=${before.users}, élèves=${before.students}, notes=${before.grades}; après users=${restored.users.length}, élèves=${restored.students.length}, notes=${restored.grades.length}`,
    req.user?.id,
    req.user?.email,
    req.ip
  );

  res.json({ success: true, message: 'Base de données restaurée avec succès.' });
});

// Journal d'audit
apiRouter.get('/audit-logs', authMiddleware, requireRoles(['ADMIN']), (req: Request, res: Response) => {
  const data = db.getData();
  res.json(data.auditLogs);
});
