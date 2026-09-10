import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db, DbUser, DbStudent, DbTeacher, DbClass, DbSubject, DbGrade } from './db.js';
import { authMiddleware, requireRoles, generateToken, AuthenticatedRequest } from './auth.js';
import { computeClassResults, computeEstablishmentStats } from './academic.js';

export const apiRouter = Router();

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

apiRouter.get('/students', authMiddleware, (req: Request, res: Response) => {
  const { classId, className, search } = req.query;
  const data = db.getData();
  let list = data.students.filter(s => s.statut);

  if (classId) {
    list = list.filter(s => s.classId === classId);
  }
  if (className) {
    list = list.filter(s => s.className === className);
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

apiRouter.post('/students', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const { matricule, nom, prenom, sexe, dateNaissance, lieuNaissance, parentPhone, classId, className } = req.body;
  if (!nom || !prenom || !dateNaissance) {
    return res.status(400).json({ error: 'Nom, prénom et date de naissance requis.' });
  }

  const data = db.getData();
  const cls = data.classes.find(c => c.id === classId || c.nom === className);
  const targetClassId = cls ? cls.id : classId || 'cls-6a';
  const targetClassName = cls ? cls.nom : className || '6ème A';

  const autoMatricule = matricule || `CEM-${String(data.students.length + 1).padStart(3, '0')}`;
  const now = new Date().toISOString();

  const newStudent: DbStudent = {
    id: autoMatricule,
    matricule: autoMatricule,
    nom: nom.toUpperCase(),
    prenom,
    sexe: sexe === 'F' ? 'F' : 'M',
    dateNaissance,
    lieuNaissance: lieuNaissance || 'Brazzaville',
    parentPhone: parentPhone || '',
    classId: targetClassId,
    className: targetClassName,
    statut: true,
    createdAt: now,
    updatedAt: now
  };

  data.students.push(newStudent);
  db.persist();
  db.logAudit('CREATE_STUDENT', `Nouvel élève inscrit: ${autoMatricule} - ${nom} ${prenom} (${targetClassName})`, req.user?.id, req.user?.email, req.ip);

  res.status(201).json(newStudent);
});

apiRouter.put('/students/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const data = db.getData();
  const student = data.students.find(s => s.id === req.params.id || s.matricule === req.params.id);
  if (!student) return res.status(404).json({ error: 'Élève non trouvé.' });

  const { nom, prenom, sexe, dateNaissance, lieuNaissance, parentPhone, classId, className, statut } = req.body;
  if (nom) student.nom = nom.toUpperCase();
  if (prenom) student.prenom = prenom;
  if (sexe) student.sexe = sexe === 'F' ? 'F' : 'M';
  if (dateNaissance) student.dateNaissance = dateNaissance;
  if (lieuNaissance !== undefined) student.lieuNaissance = lieuNaissance;
  if (parentPhone !== undefined) student.parentPhone = parentPhone;
  if (className) {
    student.className = className;
    const cls = data.classes.find(c => c.nom === className);
    if (cls) student.classId = cls.id;
  }
  if (classId) {
    student.classId = classId;
    const cls = data.classes.find(c => c.id === classId);
    if (cls) student.className = cls.nom;
  }
  if (typeof statut === 'boolean') student.statut = statut;
  student.updatedAt = new Date().toISOString();

  db.persist();
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
apiRouter.post('/students/batch-import', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const { students: importedList, targetClass } = req.body;
  if (!Array.isArray(importedList) || importedList.length === 0) {
    return res.status(400).json({ error: 'Liste d’élèves invalide ou vide.' });
  }

  const data = db.getData();
  const now = new Date().toISOString();
  let count = 0;

  for (const row of importedList) {
    if (!row.nom || !row.prenom) continue;
    const matricule = row.matricule || `CEM-${String(data.students.length + 1 + count).padStart(3, '0')}`;
    
    // Vérifier doublon
    if (data.students.some(s => s.matricule === matricule)) continue;

    const newStudent: DbStudent = {
      id: matricule,
      matricule,
      nom: String(row.nom).toUpperCase(),
      prenom: String(row.prenom),
      sexe: row.sexe === 'F' ? 'F' : 'M',
      dateNaissance: row.dateNaissance || row.dob || '01/01/2010',
      parentPhone: row.parentPhone || row.telephone || '',
      classId: targetClass || 'cls-6a',
      className: targetClass || '6ème A',
      statut: true,
      createdAt: now,
      updatedAt: now
    };
    data.students.push(newStudent);
    count++;
  }

  db.persist();
  db.logAudit('BATCH_IMPORT_STUDENTS', `Import de ${count} élèves depuis Excel`, req.user?.id, req.user?.email, req.ip);

  res.json({ success: true, importedCount: count, total: data.students.length });
});

// ============================================================================
// 7. NOTES & ÉVALUATIONS (Validation stricte 0 <= note <= 20)
// ============================================================================

apiRouter.get('/grades', authMiddleware, (req: Request, res: Response) => {
  const { classId, className, term, studentId } = req.query;
  const data = db.getData();
  let list = data.grades;

  if (studentId) list = list.filter(g => g.studentId === studentId);
  if (classId) list = list.filter(g => g.classId === classId);
  if (className) list = list.filter(g => g.className === className);
  if (term) list = list.filter(g => g.term === term);

  res.json(list);
});

// Saisie en lot sécurisée
apiRouter.post('/grades/batch', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const { grades: gradeEntries, classId, className, term } = req.body;
  if (!Array.isArray(gradeEntries)) {
    return res.status(400).json({ error: 'Format de notes invalide.' });
  }

  const data = db.getData();
  const now = new Date().toISOString();
  let updatedCount = 0;

  for (const entry of gradeEntries) {
    const { studentId, subjectId, evaluations, dev1, dev2, composition, observation } = entry;

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

    const existingIdx = data.grades.findIndex(
      g => g.studentId === studentId && g.subjectId === subjectId && g.term === (term || '1er Trimestre')
    );

    const subject = data.subjects.find(s => s.id === subjectId);
    const subjectName = subject ? subject.nom : entry.subjectName || 'Matière';

    if (existingIdx >= 0) {
      data.grades[existingIdx] = {
        ...data.grades[existingIdx],
        evaluations: ev,
        dev1: d1,
        dev2: d2,
        composition: cp,
        observation: observation || data.grades[existingIdx].observation,
        updatedAt: now
      };
    } else {
      data.grades.push({
        id: `grd-${studentId}-${subjectId}-${Date.now()}`,
        studentId,
        subjectId,
        subjectName,
        classId: classId || 'cls-6a',
        className: className || '6ème A',
        teacherId: req.user?.id,
        academicYearId: 'ay-2025-2026',
        term: term || '1er Trimestre',
        evaluations: ev,
        dev1: d1,
        dev2: d2,
        composition: cp,
        observation,
        createdAt: now,
        updatedAt: now
      });
    }
    updatedCount++;
  }

  db.persist();
  db.logAudit('BATCH_UPDATE_GRADES', `Mise à jour de ${updatedCount} notes pour classe ${className || classId}`, req.user?.id, req.user?.email, req.ip);

  res.json({ success: true, updatedCount });
});

// ============================================================================
// 8. RÉSULTATS, CLASSEMENTS & MOYENNES (Calculs serveur certifiés)
// ============================================================================

apiRouter.get('/results/class/:classId', authMiddleware, (req: Request, res: Response) => {
  const { classId } = req.params;
  const term = (req.query.term as any) || '1er Trimestre';

  const data = db.getData();
  // Trouver la classe par ID ou par nom pour rétrocompatibilité
  const cls = data.classes.find(c => c.id === classId || c.nom === classId);
  const targetId = cls ? cls.id : classId;

  const results = computeClassResults(targetId, term);
  res.json({
    classId: targetId,
    className: cls ? cls.nom : classId,
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
  if (!backupData || !Array.isArray(backupData.students) || !Array.isArray(backupData.users)) {
    return res.status(400).json({ error: 'Fichier de sauvegarde invalide.' });
  }

  const current = db.getData();
  current.students = backupData.students;
  current.grades = backupData.grades || [];
  current.classes = backupData.classes || current.classes;
  current.subjects = backupData.subjects || current.subjects;
  current.teachers = backupData.teachers || current.teachers;

  db.persist();
  db.logAudit('BACKUP_RESTORE', 'Restauration complète de la base effectuée', req.user?.id, req.user?.email, req.ip);

  res.json({ success: true, message: 'Base de données restaurée avec succès.' });
});

// Journal d'audit
apiRouter.get('/audit-logs', authMiddleware, requireRoles(['ADMIN']), (req: Request, res: Response) => {
  const data = db.getData();
  res.json(data.auditLogs);
});
