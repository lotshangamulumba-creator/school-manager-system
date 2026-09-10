import React, { useState, useMemo, useEffect } from 'react';
import {
  SchoolLevel,
  Subject,
  Student,
  StudentGrades,
  StudentTrimesterResult,
} from './types';
import {
  CEMINACE_LEVELS,
  INITIAL_STUDENTS,
  generateInitialGrades,
} from './data/ceminaceDefaults';
import {
  calculateClassAverages,
  calculateEstablishmentSpecialtySummary,
} from './utils/academicCalculations';
import {
  generateClassResultsPDF,
  generateStudentBulletinPDF,
  generateAllClassBulletinsCombinedPDF,
} from './utils/pdfGenerator';
import { Language, TRANSLATIONS } from './utils/translations';
import { MidnightButton } from './components/MidnightButton';
import { WatermarkBackground } from './components/WatermarkBackground';
import { StudentModal } from './components/StudentModal';
import { SubjectsModal } from './components/SubjectsModal';
import { GradeEditModal } from './components/GradeEditModal';
import { BatchGradeModal } from './components/BatchGradeModal';
import { GeneralTotalView } from './components/GeneralTotalView';
import { ImportModal } from './components/ImportModal';
import { LoginScreen } from './components/LoginScreen';
import { AdminDashboardView } from './components/AdminDashboardView';
import { TeacherManagementModal } from './components/TeacherManagementModal';
import { ClassSubjectModal } from './components/ClassSubjectModal';
import { AuditBackupModal } from './components/AuditBackupModal';
import { api, UserProfile } from './services/api';
import {
  Users,
  GraduationCap,
  Calculator,
  Award,
  FileDown,
  Plus,
  BookOpen,
  Edit2,
  Trash2,
  Upload,
  RefreshCw,
  Sparkles,
  Maximize2,
  Minimize2,
  Printer,
  FileSpreadsheet,
  Repeat,
  Languages,
  FileStack,
  Layers,
  LogOut,
  LayoutDashboard,
  Shield,
  ShieldCheck,
  Database,
  UserCheck,
  School,
} from 'lucide-react';

const LEVEL_ORDER: SchoolLevel[] = ['Primaire', 'Collège', 'Lycée'];

export default function App() {
  // Langue de l'application (Français / English)
  const [language, setLanguage] = useState<Language>('fr');
  const t = TRANSLATIONS[language];

  // Mode d'affichage : Fenêtre standard 980x683 ou Plein écran
  const [isWindowedMode, setIsWindowedMode] = useState(false);

  // Configuration académique CEMINACE
  const [level, setLevel] = useState<SchoolLevel>('Collège');
  const [classes, setClasses] = useState<string[]>(CEMINACE_LEVELS['Collège'].classes);
  const [currentClass, setCurrentClass] = useState<string>(CEMINACE_LEVELS['Collège'].classes[0]);
  const [trimester, setTrimester] = useState<string>('1er Trimestre');

  // Matières
  const [subjects, setSubjects] = useState<Subject[]>(CEMINACE_LEVELS['Collège'].defaultSubjects);
  const [selectedSubjectForGrade, setSelectedSubjectForGrade] = useState<string>(
    CEMINACE_LEVELS['Collège'].defaultSubjects[0]?.name || ''
  );

  // Registre des élèves & Notes
  const [students, setStudents] = useState<Student[]>(INITIAL_STUDENTS);
  const [grades, setGrades] = useState<Record<string, StudentGrades>>(() =>
    generateInitialGrades(INITIAL_STUDENTS, CEMINACE_LEVELS['Collège'].defaultSubjects)
  );

  // Authentification et Utilisateur connecté
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Onglet actif
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'students' | 'grades' | 'rankings' | 'reports' | 'generaltotal'
  >('students');

  // Modals
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [studentToEdit, setStudentToEdit] = useState<Student | null>(null);

  const [isSubjectsModalOpen, setIsSubjectsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isBatchGradeModalOpen, setIsBatchGradeModalOpen] = useState(false);

  // Modals d'administration Full-Stack
  const [isTeacherModalOpen, setIsTeacherModalOpen] = useState(false);
  const [isClassSubjectModalOpen, setIsClassSubjectModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  // Synchronisation avec le backend REST API
  const loadBackendData = async () => {
    try {
      const [backendStudents, backendClasses, backendSubjects] = await Promise.all([
        api.getStudents(),
        api.getClasses(),
        api.getSubjects(),
      ]);

      if (backendStudents.length > 0) {
        setStudents(
          backendStudents.map((bs) => ({
            id: bs.id,
            firstName: bs.prenom,
            lastName: bs.nom,
            dob: bs.dateNaissance,
            gender: bs.sexe,
            parentPhone: bs.parentPhone || '',
            matricule: bs.matricule,
            nom: bs.nom,
            prenom: bs.prenom,
            sexe: bs.sexe,
            dateNaissance: bs.dateNaissance,
            lieuNaissance: bs.lieuNaissance || 'Brazzaville',
            telephoneParent: bs.parentPhone || '',
            className: bs.className || '6ème A',
          }))
        );
      }

      if (backendClasses.length > 0) {
        const classNames = backendClasses.map((c) => c.nom);
        setClasses(classNames);
      }

      if (backendSubjects.length > 0) {
        setSubjects(
          backendSubjects.map((s) => ({
            name: s.nom,
            coeff: s.coeff,
            specialty: s.specialty || 'Sciences',
            level: (s.niveau as any) || 'Collège',
            category: s.specialty || 'Sciences',
          }))
        );
      }
    } catch (e) {
      console.warn('[TIC-TiG] Données locales actives:', e);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      const timeoutId = setTimeout(() => {
        if (isMounted) setIsAuthChecking(false);
      }, 2500);

      try {
        const token = api.getToken();
        if (token) {
          try {
            const profile = await api.getMe();
            if (isMounted) {
              setCurrentUser(profile);
              await loadBackendData();
            }
          } catch {
            api.logout();
            if (isMounted) setCurrentUser(null);
          }
        }
      } catch (e) {
        console.warn('Erreur initialisation auth:', e);
      } finally {
        clearTimeout(timeoutId);
        if (isMounted) {
          setIsAuthChecking(false);
        }
      }
    };

    initAuth();

    const handleUnauthorized = () => {
      if (isMounted) setCurrentUser(null);
    };
    window.addEventListener('tictig_unauthorized', handleUnauthorized);
    return () => {
      isMounted = false;
      window.removeEventListener('tictig_unauthorized', handleUnauthorized);
    };
  }, []);

  const [gradeEditModalData, setGradeEditModalData] = useState<{
    student: Student | null;
    subjectName: string;
    grades: StudentGrades;
  } | null>(null);

  // Calcul dynamique des moyennes et rangs CEMINACE (Congo Brazzaville)
  const classResults: StudentTrimesterResult[] = useMemo(() => {
    return calculateClassAverages(students, subjects, grades, currentClass, trimester);
  }, [students, subjects, grades, currentClass, trimester]);

  // Calcul du TOTAL GÉNÉRAL consolidé par classe, spécialité et niveau
  const establishmentStats = useMemo(() => {
    return calculateEstablishmentSpecialtySummary(
      students,
      grades,
      currentClass,
      level,
      subjects,
      trimester
    );
  }, [students, grades, currentClass, level, subjects, trimester]);

  // Filtrer les élèves de la classe courante
  const currentClassStudents = useMemo(() => {
    return students.filter((s) => s.className === currentClass);
  }, [students, currentClass]);

  // Changement de niveau scolaire (Primaire, Collège, Lycée)
  const handleLevelChange = (newLevel: SchoolLevel) => {
    setLevel(newLevel);
    const newClasses = CEMINACE_LEVELS[newLevel].classes;
    setClasses(newClasses);
    const newFirstClass = newClasses[0] || 'Classe 1';
    setCurrentClass(newFirstClass);
    const newSubjects = CEMINACE_LEVELS[newLevel].defaultSubjects;
    setSubjects(newSubjects);
    setSelectedSubjectForGrade(newSubjects[0]?.name || '');

    // Réassigner la classe aux élèves actuels
    setStudents((prev) => prev.map((s) => ({ ...s, className: newFirstClass })));
  };

  // Basculer cycliquement entre les niveaux : Primaire -> Collège -> Lycée -> Primaire
  const handleCycleLevel = () => {
    const currentIndex = LEVEL_ORDER.indexOf(level);
    const nextLevel = LEVEL_ORDER[(currentIndex + 1) % LEVEL_ORDER.length];
    handleLevelChange(nextLevel);
  };

  // Prochain niveau pour l'indicateur visuel
  const nextLevel = useMemo(() => {
    const currentIndex = LEVEL_ORDER.indexOf(level);
    return LEVEL_ORDER[(currentIndex + 1) % LEVEL_ORDER.length];
  }, [level]);

  // Basculer la langue
  const handleToggleLanguage = () => {
    setLanguage((prev) => (prev === 'fr' ? 'en' : 'fr'));
  };

  // Ajout d'une nouvelle classe
  const handleAddClass = () => {
    const promptMsg =
      language === 'fr'
        ? `Nom de la nouvelle classe pour le niveau ${level} (ex: 3ème C, Terminale C) :`
        : `Name of the new class for level ${level} (e.g., 3rd C, Grade 12 C):`;
    const name = window.prompt(promptMsg);
    if (name && name.trim()) {
      const trimmed = name.trim();
      if (!classes.includes(trimmed)) {
        const updated = [...classes, trimmed];
        setClasses(updated);
        setCurrentClass(trimmed);
      }
    }
  };

  // Basculer cycliquement entre les 3 trimestres
  const handleCycleTrimester = () => {
    const trimesters = ['1er Trimestre', '2ème Trimestre', '3ème Trimestre'];
    const curIdx = trimesters.indexOf(trimester);
    const nextIdx = (curIdx + 1) % trimesters.length;
    setTrimester(trimesters[nextIdx]);
  };

  // Sauvegarde d'un élève (Ajout ou Modification)
  const handleSaveStudent = (savedStudent: Student) => {
    if (studentToEdit) {
      setStudents((prev) => prev.map((s) => (s.id === savedStudent.id ? savedStudent : s)));
      api.updateStudent(savedStudent.id, {
        nom: savedStudent.nom,
        prenom: savedStudent.prenom,
        sexe: savedStudent.sexe,
        dateNaissance: savedStudent.dateNaissance,
        parentPhone: savedStudent.telephoneParent,
        className: savedStudent.className,
      }).catch(console.error);
    } else {
      setStudents((prev) => [...prev, savedStudent]);
      api.createStudent({
        matricule: savedStudent.matricule,
        nom: savedStudent.nom,
        prenom: savedStudent.prenom,
        sexe: savedStudent.sexe,
        dateNaissance: savedStudent.dateNaissance,
        parentPhone: savedStudent.telephoneParent,
        className: savedStudent.className,
      }).catch(console.error);

      // Initialiser ses notes par défaut pour les 3 trimestres
      const newGrades = { ...grades };
      const trimesters = ['1er Trimestre', '2ème Trimestre', '3ème Trimestre'];
      subjects.forEach((sub) => {
        const defaultG: StudentGrades = {
          evaluations: 10,
          dev1: 10,
          dev2: 10,
          composition: 10,
          eval1: 10,
          eval2: 10,
          dev3: 10,
        };
        newGrades[`${savedStudent.id}_${sub.name}`] = defaultG;
        trimesters.forEach((trim) => {
          newGrades[`${savedStudent.id}_${sub.name}_${trim}`] = defaultG;
        });
      });
      setGrades(newGrades);
    }
    setStudentToEdit(null);
  };

  // Suppression d'un élève
  const handleDeleteStudent = (studentId: string) => {
    const confirmMsg =
      language === 'fr'
        ? 'Êtes-vous sûr de vouloir supprimer cet élève du registre ?'
        : 'Are you sure you want to remove this student from the registry?';
    if (window.confirm(confirmMsg)) {
      setStudents((prev) => prev.filter((s) => s.id !== studentId));
      api.deleteStudent(studentId).catch(console.error);
    }
  };

  // Import d'élèves depuis Excel ou Word
  const handleImportStudents = (imported: Student[]) => {
    setStudents((prev) => [...prev, ...imported]);
    api.batchImportStudents(imported, currentClass).catch(console.error);

    const updatedGrades = { ...grades };
    const trimesters = ['1er Trimestre', '2ème Trimestre', '3ème Trimestre'];
    imported.forEach((s) => {
      subjects.forEach((sub) => {
        const defaultG: StudentGrades = {
          evaluations: 10,
          dev1: 10,
          dev2: 10,
          composition: 10,
          eval1: 10,
          eval2: 10,
          dev3: 10,
        };
        updatedGrades[`${s.id}_${sub.name}`] = defaultG;
        trimesters.forEach((trim) => {
          updatedGrades[`${s.id}_${sub.name}_${trim}`] = defaultG;
        });
      });
    });
    setGrades(updatedGrades);
  };

  // Sauvegarde des notes saisies pour un élève individuel
  const handleSaveGrades = (updatedGrades: StudentGrades) => {
    if (!gradeEditModalData?.student) return;
    const keyWithTrim = `${gradeEditModalData.student.id}_${gradeEditModalData.subjectName}_${trimester}`;
    const keyDefault = `${gradeEditModalData.student.id}_${gradeEditModalData.subjectName}`;
    setGrades((prev) => ({
      ...prev,
      [keyWithTrim]: updatedGrades,
      [keyDefault]: updatedGrades,
    }));

    // Sauvegarde en base de données sur le serveur
    api.saveBatchGrades({
      grades: [
        {
          studentId: gradeEditModalData.student.id,
          subjectId: gradeEditModalData.subjectName,
          subjectName: gradeEditModalData.subjectName,
          evaluations: updatedGrades.evaluations ?? updatedGrades.eval1 ?? 10,
          dev1: updatedGrades.dev1 ?? 10,
          dev2: updatedGrades.dev2 ?? 10,
          composition: updatedGrades.composition ?? 10,
          observation: updatedGrades.observation,
        },
      ],
      classId: currentClass,
      className: currentClass,
      term: trimester,
    }).catch(console.error);
  };

  // Sauvegarde en lot des notes pour toute la classe
  const handleSaveBatchGrades = (batchUpdates: Record<string, StudentGrades>) => {
    setGrades((prev) => ({
      ...prev,
      ...batchUpdates,
    }));

    // Transformer le lot pour l'API REST
    const gradeList: any[] = [];
    currentClassStudents.forEach((student) => {
      subjects.forEach((subj) => {
        const key = `${student.id}_${subj.name}_${trimester}`;
        const keyDef = `${student.id}_${subj.name}`;
        const g = batchUpdates[key] || batchUpdates[keyDef] || grades[key] || grades[keyDef];
        if (g) {
          gradeList.push({
            studentId: student.id,
            subjectId: subj.name,
            subjectName: subj.name,
            evaluations: g.evaluations ?? g.eval1 ?? 10,
            dev1: g.dev1 ?? 10,
            dev2: g.dev2 ?? 10,
            composition: g.composition ?? 10,
            observation: g.observation,
          });
        }
      });
    });

    if (gradeList.length > 0) {
      api.saveBatchGrades({
        grades: gradeList,
        classId: currentClass,
        className: currentClass,
        term: trimester,
      }).catch(console.error);
    }
  };

  // Recharger données démo CEMINACE
  const handleResetDemoData = () => {
    setStudents(INITIAL_STUDENTS);
    setGrades(generateInitialGrades(INITIAL_STUDENTS, subjects));
  };

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white">
        <div className="w-12 h-12 rounded-full border-4 border-sky-500/20 border-t-sky-400 animate-spin mb-4" />
        <h2 className="text-lg font-bold">TIC-TiG Scolaire</h2>
        <p className="text-xs text-slate-400">Vérification de la session en cours...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <LoginScreen
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          loadBackendData();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-start p-2 md:p-6 text-slate-800 antialiased font-sans">
      {/* Barre d'information supérieure sur l'application bureau */}
      <div className="w-full max-w-[1020px] mb-3 flex flex-wrap items-center justify-between text-xs text-slate-300 px-2 gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold text-white">{t.desktopApp}</span>
          <span className="text-slate-400">|</span>
          <span className="hidden sm:inline text-slate-300">
            {t.schoolName} ({t.schoolLocation})
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Bouton choix de la langue (FR / EN) */}
          <div className="flex items-center bg-slate-800 p-0.5 rounded-md border border-slate-700 text-xs">
            <Languages className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-0.5" />
            <button
              onClick={() => setLanguage('fr')}
              className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                language === 'fr'
                  ? 'bg-sky-500 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Passer en Français"
            >
              FR
            </button>
            <button
              onClick={() => setLanguage('en')}
              className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                language === 'en'
                  ? 'bg-sky-500 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Switch to English"
            >
              EN
            </button>
          </div>

          <button
            onClick={() => setIsWindowedMode(!isWindowedMode)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 transition-colors cursor-pointer"
            title={isWindowedMode ? t.fullScreen : t.fixedWindow}
          >
            {isWindowedMode ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isWindowedMode ? t.fullScreen : t.fixedWindow}</span>
          </button>

          <span className="bg-[#1E3A5F] px-2 py-0.5 rounded text-[11px] font-mono text-sky-200 border border-[#2B4E7C]">
            980 × 683 px
          </span>
        </div>
      </div>

      {/* Cadre de l'application TIC-TiG */}
      <div
        className={`relative bg-[#F4F7FB] rounded-xl shadow-2xl border border-slate-700 overflow-hidden flex flex-col transition-all duration-300 ${
          isWindowedMode
            ? 'w-[980px] h-[683px] shrink-0'
            : 'w-full max-w-[1020px] min-h-[683px]'
        }`}
      >
        {/* Filigrane d'application : transparent logo "EduTigTic" avec miniature école en arrière-plan */}
        <WatermarkBackground />

        {/* 1. Window Titlebar Desktop */}
        <div className="relative z-10 bg-[#1E3A5F] text-white px-4 py-2.5 flex items-center justify-between border-b border-[#152942] select-none">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 mr-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
            </div>
            <div className="flex items-center gap-1.5">
              <GraduationCap className="w-5 h-5 text-sky-300" />
              <h1 className="font-bold text-sm md:text-base tracking-wide text-white">TIC-TiG</h1>
              <span className="text-sky-300 text-xs font-normal hidden sm:inline">
                • {t.schoolName} ({t.schoolLocation})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Profil utilisateur connecté */}
            {currentUser && (
              <div className="flex items-center gap-1.5 bg-[#152942] px-2.5 py-1 rounded-md border border-[#234574] text-[11px]">
                <span className="font-bold text-sky-200">
                  {currentUser.prenom} {currentUser.nom}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                    currentUser.role === 'ADMIN'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  }`}
                >
                  {currentUser.role}
                </span>
              </div>
            )}

            {/* Outils d'administration pour l'ADMIN */}
            {currentUser?.role === 'ADMIN' && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsTeacherModalOpen(true)}
                  className="flex items-center gap-1 text-[11px] font-bold text-sky-200 bg-[#152942] hover:bg-[#203c61] px-2 py-1 rounded border border-[#234574] transition-colors cursor-pointer"
                  title="Gérer le corps professoral"
                >
                  <GraduationCap className="w-3.5 h-3.5 text-sky-300" />
                  <span className="hidden sm:inline">Enseignants</span>
                </button>

                <button
                  onClick={() => setIsClassSubjectModalOpen(true)}
                  className="flex items-center gap-1 text-[11px] font-bold text-sky-200 bg-[#152942] hover:bg-[#203c61] px-2 py-1 rounded border border-[#234574] transition-colors cursor-pointer"
                  title="Configurer classes et matières"
                >
                  <School className="w-3.5 h-3.5 text-sky-300" />
                  <span className="hidden sm:inline">Classes/Matières</span>
                </button>

                <button
                  onClick={() => setIsAuditModalOpen(true)}
                  className="flex items-center gap-1 text-[11px] font-bold text-amber-200 bg-[#152942] hover:bg-[#203c61] px-2 py-1 rounded border border-amber-500/40 transition-colors cursor-pointer"
                  title="Sauvegardes et audit"
                >
                  <Database className="w-3.5 h-3.5 text-amber-300" />
                  <span className="hidden sm:inline">Sauvegardes</span>
                </button>
              </div>
            )}

            {/* Bouton rapide de bascule de langue dans le bandeau */}
            <button
              onClick={handleToggleLanguage}
              className="flex items-center gap-1 text-[11px] font-bold text-sky-200 bg-[#152942] hover:bg-[#203c61] px-2 py-1 rounded border border-[#234574] transition-colors cursor-pointer"
              title={language === 'fr' ? 'Switch to English' : 'Passer en Français'}
            >
              <Languages className="w-3 h-3 text-sky-300" />
              <span>{language === 'fr' ? 'FR ➔ EN' : 'EN ➔ FR'}</span>
            </button>

            {/* Bouton de Déconnexion */}
            <button
              onClick={() => {
                api.logout();
                setCurrentUser(null);
              }}
              className="flex items-center gap-1 text-[11px] font-bold text-rose-200 bg-rose-950/50 hover:bg-rose-900/70 px-2 py-1 rounded border border-rose-800/60 transition-colors cursor-pointer"
              title="Se déconnecter"
            >
              <LogOut className="w-3 h-3 text-rose-300" />
              <span className="hidden sm:inline">Quitter</span>
            </button>

            <div className="text-[11px] text-sky-200 bg-[#152942] px-2 py-1 rounded border border-[#234574]">
              {trimester}
            </div>
            <div className="text-[11px] font-mono text-slate-300">v2.0-Web</div>
          </div>
        </div>

        {/* 2. Barre d'outils académique & sélection du niveau / classe */}
        <div className="relative z-10 bg-slate-100 border-b border-slate-200 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* Bouton dédié pour BASCULER ENTRE LES NIVEAUX (Demande explicite de l'utilisateur) */}
            <button
              onClick={handleCycleLevel}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white hover:bg-sky-50 text-slate-700 hover:text-[#1E3A5F] border border-slate-200 hover:border-sky-300 font-bold transition-all shadow-2xs cursor-pointer text-xs"
              title={`Basculer cycliquement : Primaire ➔ Collège ➔ Lycée (Niveau actuel : ${level})`}
            >
              <Repeat className="w-3.5 h-3.5 text-[#1E3A5F]" />
              <span>{t.switchLevel}</span>
              <span className="text-[10px] px-1.5 py-0.5 bg-sky-100 text-[#1E3A5F] rounded-md font-extrabold flex items-center gap-0.5">
                ➜ {nextLevel}
              </span>
            </button>

            {/* Sélecteur direct de Niveau Scolaire (Primaire, Collège, Lycée) */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-2xs">
              <span className="font-bold text-slate-600 px-1 text-[11px]">{t.level} :</span>
              {(['Primaire', 'Collège', 'Lycée'] as SchoolLevel[]).map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => handleLevelChange(lvl)}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                    level === lvl
                      ? 'bg-[#1E3A5F] text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {lvl === 'Primaire' ? t.primary : lvl === 'Collège' ? t.college : t.lycee}
                </button>
              ))}
            </div>

            {/* Classe active */}
            <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-2xs">
              <span className="font-bold text-slate-600 text-[11px]">{t.currentClass} :</span>
              <select
                value={currentClass}
                onChange={(e) => setCurrentClass(e.target.value)}
                className="font-bold text-slate-800 bg-transparent outline-none cursor-pointer pr-2"
              >
                {classes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Bouton ajouter classe */}
            <MidnightButton size="sm" onClick={handleAddClass} icon={<Plus className="w-3.5 h-3.5" />}>
              {t.addClass}
            </MidnightButton>

            {/* Bouton Matières & Coeffs */}
            <MidnightButton
              size="sm"
              variant="outline"
              onClick={() => setIsSubjectsModalOpen(true)}
              icon={<BookOpen className="w-3.5 h-3.5" />}
            >
              {t.manageSubjects} ({subjects.length})
            </MidnightButton>
          </div>

          {/* Trimestre & Actions rapides */}
          <div className="flex items-center gap-2">
            {/* Bouton dédié pour BASCULER ENTRE LES TRIMESTRES */}
            <button
              onClick={handleCycleTrimester}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs transition-all shadow-2xs cursor-pointer"
              title={`Basculer : 1er Trimestre ➜ 2ème Trimestre ➜ 3ème Trimestre (Actuel : ${trimester})`}
            >
              <Repeat className="w-3.5 h-3.5 text-amber-700" />
              <span>{t.switchTrimester}</span>
              <span className="text-[10px] px-1.5 py-0.5 bg-amber-200 text-amber-950 rounded-md font-extrabold">
                ➜ {trimester === '1er Trimestre' ? '2ème Trim.' : trimester === '2ème Trimestre' ? '3ème Trim.' : '1er Trim.'}
              </span>
            </button>

            <select
              value={trimester}
              onChange={(e) => setTrimester(e.target.value)}
              className="bg-white border border-slate-300 font-bold text-xs px-2 py-1.5 rounded-lg outline-none cursor-pointer shadow-2xs text-[#1E3A5F]"
            >
              <option value="1er Trimestre">{t.firstTrimester}</option>
              <option value="2ème Trimestre">{t.secondTrimester}</option>
              <option value="3ème Trimestre">{t.thirdTrimester}</option>
            </select>

            <MidnightButton
              size="sm"
              onClick={handleResetDemoData}
              variant="secondary"
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              title="Recharger l'effectif modèle CEMINACE"
            >
              {t.demoData}
            </MidnightButton>
          </div>
        </div>

        {/* 3. Navigation par Onglets Principaux (Bleu Foncé avec Surbrillance) */}
        <div className="relative z-10 bg-gradient-to-r from-[#0C1E36] via-[#152F52] to-[#0C1E36] border-y border-[#1E3A5F] shadow-md px-3 flex items-center justify-between overflow-x-auto">
          <div className="flex items-center gap-1.5 py-1">
            {/* ONGLET 0 : TABLEAU DE BORD (Accessible à l'administration) */}
            {currentUser?.role === 'ADMIN' && (
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs md:text-sm font-semibold rounded-t-md transition-all cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-gradient-to-b from-[#254C7B] to-[#18365D] text-white font-bold border-b-2 border-sky-400 shadow-[0_2px_14px_rgba(56,189,248,0.45),inset_0_1px_0_rgba(255,255,255,0.2)]'
                    : 'text-slate-300 hover:text-white hover:bg-white/10 border-b-2 border-transparent'
                }`}
              >
                <LayoutDashboard className={`w-4 h-4 ${activeTab === 'dashboard' ? 'text-sky-300 drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]' : 'text-slate-400'}`} />
                <span>Tableau de Bord</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('students')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs md:text-sm font-semibold rounded-t-md transition-all cursor-pointer ${
                activeTab === 'students'
                  ? 'bg-gradient-to-b from-[#254C7B] to-[#18365D] text-white font-bold border-b-2 border-sky-400 shadow-[0_2px_14px_rgba(56,189,248,0.45),inset_0_1px_0_rgba(255,255,255,0.2)]'
                  : 'text-slate-300 hover:text-white hover:bg-white/10 border-b-2 border-transparent'
              }`}
            >
              <Users className={`w-4 h-4 ${activeTab === 'students' ? 'text-sky-300 drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]' : 'text-slate-400'}`} />
              <span>{t.tabStudents}</span>
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'students'
                  ? 'bg-sky-400/25 text-sky-100 border border-sky-400/50 shadow-2xs'
                  : 'bg-white/10 text-slate-300'
              }`}>
                {currentClassStudents.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('grades')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs md:text-sm font-semibold rounded-t-md transition-all cursor-pointer ${
                activeTab === 'grades'
                  ? 'bg-gradient-to-b from-[#254C7B] to-[#18365D] text-white font-bold border-b-2 border-sky-400 shadow-[0_2px_14px_rgba(56,189,248,0.45),inset_0_1px_0_rgba(255,255,255,0.2)]'
                  : 'text-slate-300 hover:text-white hover:bg-white/10 border-b-2 border-transparent'
              }`}
            >
              <Calculator className={`w-4 h-4 ${activeTab === 'grades' ? 'text-sky-300 drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]' : 'text-slate-400'}`} />
              <span>{t.tabGrades}</span>
            </button>

            <button
              onClick={() => setActiveTab('rankings')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs md:text-sm font-semibold rounded-t-md transition-all cursor-pointer ${
                activeTab === 'rankings'
                  ? 'bg-gradient-to-b from-[#254C7B] to-[#18365D] text-white font-bold border-b-2 border-sky-400 shadow-[0_2px_14px_rgba(56,189,248,0.45),inset_0_1px_0_rgba(255,255,255,0.2)]'
                  : 'text-slate-300 hover:text-white hover:bg-white/10 border-b-2 border-transparent'
              }`}
            >
              <Award className={`w-4 h-4 ${activeTab === 'rankings' ? 'text-sky-300 drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]' : 'text-slate-400'}`} />
              <span>{t.tabRankings}</span>
            </button>

            <button
              onClick={() => setActiveTab('reports')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs md:text-sm font-semibold rounded-t-md transition-all cursor-pointer ${
                activeTab === 'reports'
                  ? 'bg-gradient-to-b from-[#254C7B] to-[#18365D] text-white font-bold border-b-2 border-sky-400 shadow-[0_2px_14px_rgba(56,189,248,0.45),inset_0_1px_0_rgba(255,255,255,0.2)]'
                  : 'text-slate-300 hover:text-white hover:bg-white/10 border-b-2 border-transparent'
              }`}
            >
              <FileDown className={`w-4 h-4 ${activeTab === 'reports' ? 'text-sky-300 drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]' : 'text-slate-400'}`} />
              <span>{t.tabReports}</span>
            </button>

            {/* NOUVEL ONGLET : TOTAL GÉNÉRAL ET SPÉCIALITÉS PAR NIVEAU */}
            <button
              onClick={() => setActiveTab('generaltotal')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs md:text-sm font-semibold rounded-t-md transition-all cursor-pointer ${
                activeTab === 'generaltotal'
                  ? 'bg-gradient-to-b from-[#254C7B] to-[#18365D] text-white font-bold border-b-2 border-sky-400 shadow-[0_2px_14px_rgba(56,189,248,0.45),inset_0_1px_0_rgba(255,255,255,0.2)]'
                  : 'text-slate-300 hover:text-white hover:bg-white/10 border-b-2 border-transparent'
              }`}
            >
              <Layers className={`w-4 h-4 ${activeTab === 'generaltotal' ? 'text-sky-300 drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]' : 'text-indigo-300'}`} />
              <span>{t.tabGeneralTotal}</span>
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'generaltotal'
                  ? 'bg-indigo-400/30 text-indigo-100 border border-indigo-400/50 shadow-2xs'
                  : 'bg-white/10 text-slate-300'
              }`}>
                {level}
              </span>
            </button>
          </div>
        </div>

        {/* 4. Contenu Principal de l'Application */}
        <div className="relative z-10 flex-1 p-3 md:p-4 overflow-y-auto">
          {/* ONGLET 0 : TABLEAU DE BORD ADMINISTRATIF */}
          {activeTab === 'dashboard' && (
            <AdminDashboardView
              selectedTerm={trimester}
              onSelectClass={(cls) => {
                setCurrentClass(cls);
                setActiveTab('grades');
              }}
            />
          )}

          {/* ONGLET 1 : GESTION DES ÉLÈVES & IMPORT */}
          {activeTab === 'students' && (
            <div className="space-y-3">
              {/* Barre d'action élèves */}
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MidnightButton
                    size="sm"
                    onClick={() => {
                      setStudentToEdit(null);
                      setIsStudentModalOpen(true);
                    }}
                    icon={<Plus className="w-4 h-4" />}
                  >
                    {t.registerStudent}
                  </MidnightButton>

                  <MidnightButton
                    size="sm"
                    variant="outline"
                    onClick={() => setIsImportModalOpen(true)}
                    icon={<Upload className="w-4 h-4" />}
                  >
                    {t.importWordExcel}
                  </MidnightButton>
                </div>

                <div className="text-xs text-slate-500">
                  {t.currentClass} : <strong className="text-[#1E3A5F]">{currentClass}</strong> ({currentClassStudents.length} {t.enrolledStudents})
                </div>
              </div>

              {/* Table des élèves */}
              <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#1E3A5F] text-white">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold w-24">{t.matricule}</th>
                      <th className="py-2.5 px-3 font-semibold">{t.fullName}</th>
                      <th className="py-2.5 px-3 font-semibold w-28 text-center">{t.birthDate}</th>
                      <th className="py-2.5 px-3 font-semibold w-16 text-center">{t.gender}</th>
                      <th className="py-2.5 px-3 font-semibold">{t.parentPhone}</th>
                      <th className="py-2.5 px-3 font-semibold text-right w-24">{t.actions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentClassStudents.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          {t.noStudents}
                        </td>
                      </tr>
                    ) : (
                      currentClassStudents.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-medium text-slate-700">{s.id}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900">
                            {s.lastName.toUpperCase()} {s.firstName}
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-600">{s.dob}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                s.gender === 'F' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {s.gender}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">{s.parentPhone}</td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => {
                                  setStudentToEdit(s);
                                  setIsStudentModalOpen(true);
                                }}
                                className="p-1 text-slate-600 hover:text-[#1E3A5F] hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                title={t.editStudent}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteStudent(s.id)}
                                className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                title={t.deleteStudent}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ONGLET 2 : SAISIE DES ÉVALUATIONS & DEVOIRS */}
          {activeTab === 'grades' && (
            <div className="space-y-3">
              {/* Barre de sélection de la matière & Action de saisie */}
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-xs text-slate-700">{t.subjectToGrade} :</span>
                  <select
                    value={selectedSubjectForGrade}
                    onChange={(e) => setSelectedSubjectForGrade(e.target.value)}
                    className="font-bold text-xs bg-slate-50 border border-slate-300 rounded-md px-3 py-1.5 outline-none focus:ring-2 focus:ring-[#1E3A5F] cursor-pointer"
                  >
                    {subjects.map((sub) => (
                      <option key={sub.id} value={sub.name}>
                        {sub.name} (Coeff {sub.coeff} • {sub.specialty})
                      </option>
                    ))}
                  </select>

                  <span className="bg-[#1E3A5F] text-white text-[11px] font-bold px-2.5 py-1 rounded-md">
                    {trimester}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-[11px] text-slate-600 bg-sky-50 border border-sky-200 px-2.5 py-1 rounded">
                    <strong>Formule CEMINACE :</strong> CC = (Évals + Dev1 + Dev2)/3 • Moy = (CC + 2×COMP)/3
                  </div>

                  {/* Bouton principal pour SAISIR LES NOTES (Demande explicite de l'utilisateur) */}
                  <MidnightButton
                    size="sm"
                    onClick={() => setIsBatchGradeModalOpen(true)}
                    icon={<Edit2 className="w-3.5 h-3.5" />}
                  >
                    {t.enterGradesButton}
                  </MidnightButton>
                </div>
              </div>

              {/* Table des notes pour la matière sélectionnée */}
              <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#1E3A5F] text-white">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold w-24">{t.matricule}</th>
                      <th className="py-2.5 px-3 font-semibold">{t.fullName}</th>
                      <th className="py-2.5 px-2.5 font-semibold text-center w-28 bg-[#152942]/70">
                        {t.evalNotes}
                      </th>
                      <th className="py-2.5 px-2.5 font-semibold text-center w-24">{t.dev1}</th>
                      <th className="py-2.5 px-2.5 font-semibold text-center w-24">{t.dev2}</th>
                      <th className="py-2.5 px-2.5 font-semibold text-center w-32 bg-amber-600 text-white font-bold">
                        {t.composition}
                      </th>
                      <th className="py-2.5 px-3 font-semibold text-center w-28 bg-[#152942]">
                        {t.subjectAverage}
                      </th>
                      <th className="py-2.5 px-3 font-semibold text-right w-24">{t.actions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentClassStudents.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-slate-400">
                          {t.noStudents}
                        </td>
                      </tr>
                    ) : (
                      currentClassStudents.map((student) => {
                        const keyWithTrim = `${student.id}_${selectedSubjectForGrade}_${trimester}`;
                        const keyDefault = `${student.id}_${selectedSubjectForGrade}`;
                        const g = grades[keyWithTrim] || grades[keyDefault] || {
                          evaluations: 10,
                          dev1: 10,
                          dev2: 10,
                          composition: 10,
                          eval1: 10,
                          eval2: 10,
                          dev3: 10,
                        };

                        const evalNotes = g.evaluations ?? g.eval1 ?? 10;
                        const dev1 = g.dev1 ?? 10;
                        const dev2 = g.dev2 ?? 10;
                        const comp = g.composition ?? g.dev3 ?? 10;
                        const cc = (evalNotes + dev1 + dev2) / 3;
                        const subjectAvg = (cc + 2 * comp) / 3;

                        return (
                          <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2 px-3 font-mono font-medium text-slate-700">{student.id}</td>
                            <td className="py-2 px-3 font-semibold text-slate-900">
                              {student.lastName.toUpperCase()} {student.firstName}
                            </td>
                            <td className="py-2 px-2.5 text-center font-mono font-medium text-slate-800 bg-slate-50/50">
                              {evalNotes.toFixed(2)}
                            </td>
                            <td className="py-2 px-2.5 text-center font-mono font-medium text-slate-800">
                              {dev1.toFixed(2)}
                            </td>
                            <td className="py-2 px-2.5 text-center font-mono font-medium text-slate-800">
                              {dev2.toFixed(2)}
                            </td>
                            <td className="py-2 px-2.5 text-center font-mono font-bold text-amber-900 bg-amber-50/60">
                              {comp.toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-center font-bold text-[#1E3A5F] bg-sky-50/50">
                              <span
                                className={`inline-block px-2 py-0.5 rounded ${
                                  subjectAvg >= 10 ? 'text-sky-950 font-black' : 'text-rose-700 font-bold'
                                }`}
                              >
                                {subjectAvg.toFixed(2)}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right">
                              <MidnightButton
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setGradeEditModalData({
                                    student,
                                    subjectName: selectedSubjectForGrade,
                                    grades: {
                                      evaluations: evalNotes,
                                      dev1,
                                      dev2,
                                      composition: comp,
                                      eval1: evalNotes,
                                      eval2: evalNotes,
                                      dev3: comp,
                                    },
                                  });
                                }}
                              >
                                {t.enterGrades}
                              </MidnightButton>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ONGLET 3 : PALMARÈS & RANGS PAR SPÉCIALITÉ */}
          {activeTab === 'rankings' && (
            <div className="space-y-3">
              {/* Statistiques globales */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                  <span className="text-slate-500 block">{t.evaluatedCount}</span>
                  <span className="text-base font-bold text-[#1E3A5F]">
                    {classResults.length} {t.enrolledStudents}
                  </span>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                  <span className="text-slate-500 block">{t.classAverage}</span>
                  <span className="text-base font-bold text-slate-800">
                    {classResults.length > 0
                      ? (
                          classResults.reduce((acc, r) => acc + r.generalAvg, 0) / classResults.length
                        ).toFixed(2)
                      : '0.00'}{' '}
                    / 20
                  </span>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                  <span className="text-slate-500 block">{t.highestAverage}</span>
                  <span className="text-base font-bold text-emerald-600">
                    {classResults.length > 0 ? Math.max(...classResults.map((r) => r.generalAvg)).toFixed(2) : '0.00'}{' '}
                    / 20
                  </span>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                  <span className="text-slate-500 block">{t.specialtiesEvaluated}</span>
                  <span className="text-base font-bold text-indigo-600">Sciences • Littérature • EPS</span>
                </div>
              </div>

              {/* Table complète des Rangs et Spécialités */}
              <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[800px]">
                  <thead className="bg-[#1E3A5F] text-white">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold text-center w-16">{t.overallRank}</th>
                      <th className="py-2.5 px-3 font-semibold w-24">{t.matricule}</th>
                      <th className="py-2.5 px-3 font-semibold">{t.fullName}</th>
                      <th className="py-2.5 px-2.5 font-semibold text-center bg-[#244673]">
                        {t.sciencesRank}
                      </th>
                      <th className="py-2.5 px-2.5 font-semibold text-center bg-[#2b5185]">
                        {t.literatureRank}
                      </th>
                      <th className="py-2.5 px-2.5 font-semibold text-center bg-[#335d96]">
                        {t.epsRank}
                      </th>
                      <th className="py-2.5 px-3 font-semibold text-center bg-[#152942] w-28">
                        {t.generalAverage}
                      </th>
                      <th className="py-2.5 px-3 font-semibold">{t.mention}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {classResults.map((res) => (
                      <tr key={res.student.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 text-center font-extrabold text-[#1E3A5F]">
                          {res.generalRank === 1 ? (
                            <span className="inline-flex items-center gap-1 text-amber-600">
                              <Sparkles className="w-3.5 h-3.5" /> 1er
                            </span>
                          ) : (
                            `${res.generalRank}e`
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">{res.student.id}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {res.student.lastName.toUpperCase()} {res.student.firstName}
                        </td>
                        <td className="py-2.5 px-2.5 text-center bg-sky-50/40 font-mono">
                          <span className="font-bold text-slate-800">{res.sciencesAvg.toFixed(2)}</span>
                          <span className="text-[10px] text-slate-500 ml-1">({res.sciencesRank}e)</span>
                        </td>
                        <td className="py-2.5 px-2.5 text-center bg-indigo-50/40 font-mono">
                          <span className="font-bold text-slate-800">{res.literatureAvg.toFixed(2)}</span>
                          <span className="text-[10px] text-slate-500 ml-1">({res.literatureRank}e)</span>
                        </td>
                        <td className="py-2.5 px-2.5 text-center bg-emerald-50/40 font-mono">
                          <span className="font-bold text-slate-800">{res.epsAvg.toFixed(2)}</span>
                          <span className="text-[10px] text-slate-500 ml-1">({res.epsRank}e)</span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-extrabold text-sm text-[#1E3A5F] bg-sky-100/50 font-mono">
                          {res.generalAvg.toFixed(2)} / 20
                        </td>
                        <td className="py-2.5 px-3 text-[11px] font-medium text-slate-700">{res.mention}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ONGLET 4 : BULLETINS & RAPPORTS PDF */}
          {activeTab === 'reports' && (
            <div className="space-y-4">
              {/* CARTE PRINCIPALE : EXPORT D'UN SEUL FICHIER PDF AVEC TOUS LES BULLETINS ASSEMBLÉS PAR TRIMESTRE (JSPDF) */}
              <div className="p-4 md:p-5 rounded-xl border-2 border-[#1E3A5F]/20 bg-linear-to-r from-sky-50/90 via-indigo-50/60 to-slate-50 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#1E3A5F] text-white flex items-center justify-center shadow-md shrink-0">
                      <FileStack className="w-5 h-5 text-sky-200" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm md:text-base text-[#1E3A5F]">
                          {t.singleCombinedPdfTitle}
                        </h4>
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                          jsPDF Multi-Pages
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {currentClass} • {trimester} • {classResults.length} {t.enrolledStudents}
                      </p>
                    </div>
                  </div>

                  <MidnightButton
                    size="md"
                    onClick={() =>
                      generateAllClassBulletinsCombinedPDF(
                        classResults,
                        currentClass,
                        level,
                        trimester,
                        language
                      )
                    }
                    icon={<FileDown className="w-4 h-4" />}
                    className="shadow-sm"
                  >
                    {t.singleCombinedPdfBtn}
                  </MidnightButton>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed border-t border-slate-200/80 pt-2.5">
                  {t.singleCombinedPdfDesc}
                </p>
              </div>

              {/* RAPPORTS SECONDAIRES : PALMARÈS & TABLE INDIVIDUELLE */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <div>
                  <h3 className="font-bold text-sm md:text-base text-[#1E3A5F] flex items-center gap-2">
                    <FileDown className="w-5 h-5" />
                    {t.pdfTitle}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {t.pdfSubtitle}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  {/* Option 1: Palmarès de classe */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                    <div className="flex items-center gap-2 font-bold text-sm text-slate-800">
                      <FileSpreadsheet className="w-5 h-5 text-[#1E3A5F]" />
                      <span>{t.classPalmaresTitle}</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {t.classPalmaresDesc}
                    </p>
                    <MidnightButton
                      size="sm"
                      onClick={() =>
                        generateClassResultsPDF(classResults, currentClass, level, trimester, language)
                      }
                      icon={<Printer className="w-4 h-4" />}
                    >
                      {t.classPalmaresBtn} ({currentClass})
                    </MidnightButton>
                  </div>

                  {/* Option 2: Lot individuel */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                    <div className="flex items-center gap-2 font-bold text-sm text-slate-800">
                      <Award className="w-5 h-5 text-emerald-700" />
                      <span>{t.singleCombinedPdfTitle}</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {t.singleCombinedPdfDesc}
                    </p>
                    <MidnightButton
                      size="sm"
                      onClick={() =>
                        generateAllClassBulletinsCombinedPDF(
                          classResults,
                          currentClass,
                          level,
                          trimester,
                          language
                        )
                      }
                      icon={<FileStack className="w-4 h-4" />}
                    >
                      {t.singleCombinedPdfBtn}
                    </MidnightButton>
                  </div>
                </div>

                {/* Table des bulletins individuels avec bouton par élève */}
                <div className="pt-4 border-t border-slate-200">
                  <h4 className="font-bold text-xs uppercase text-slate-700 mb-2">
                    {t.individualDownloadsTitle}
                  </h4>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#1E3A5F] text-white">
                        <tr>
                          <th className="py-2 px-3 w-16 text-center">{t.overallRank}</th>
                          <th className="py-2 px-3">{t.fullName}</th>
                          <th className="py-2 px-3 text-center w-28">{t.generalAverage}</th>
                          <th className="py-2 px-3">{t.mention}</th>
                          <th className="py-2 px-3 text-right w-36">{t.actions}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {classResults.map((res) => (
                          <tr key={res.student.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 text-center font-bold text-[#1E3A5F]">
                              {res.generalRank}e
                            </td>
                            <td className="py-2 px-3 font-semibold text-slate-900">
                              {res.student.lastName.toUpperCase()} {res.student.firstName}
                            </td>
                            <td className="py-2 px-3 text-center font-mono font-bold text-slate-800">
                              {res.generalAvg.toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-slate-600">{res.mention.split('(')[0]}</td>
                            <td className="py-2 px-3 text-right">
                              <MidnightButton
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  generateStudentBulletinPDF(
                                    res,
                                    currentClass,
                                    level,
                                    trimester,
                                    classResults.length,
                                    language
                                  )
                                }
                                icon={<FileDown className="w-3.5 h-3.5" />}
                              >
                                {t.bulletinBtn}
                              </MidnightButton>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ONGLET 5 : TOTAL GÉNÉRAL ET MOYENNES PAR SPÉCIALITÉ (PRIMAIRE, COLLÈGE, LYCÉE) */}
          {activeTab === 'generaltotal' && (
            <GeneralTotalView
              stats={establishmentStats}
              trimester={trimester}
              onCycleTrimester={handleCycleTrimester}
              isFrench={language === 'fr'}
            />
          )}
        </div>

        {/* 5. Barre de Statut Inférieure */}
        <div className="relative z-10 bg-slate-200 border-t border-slate-300 px-3 py-1 flex items-center justify-between text-[11px] text-slate-600">
          <div className="flex items-center gap-3">
            <span>
              {t.statusEstablishment}
            </span>
            <span>•</span>
            <span>
              {t.currentClass} : <strong>{currentClass}</strong> ({currentClassStudents.length} {t.enrolledStudents})
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span>GUI : 980 × 683 px</span>
            <span>•</span>
            <span className="font-semibold text-[#1E3A5F]">{t.statusWatermark}</span>
          </div>
        </div>
      </div>

      {/* MODALS */}
      <StudentModal
        isOpen={isStudentModalOpen}
        onClose={() => {
          setIsStudentModalOpen(false);
          setStudentToEdit(null);
        }}
        onSave={handleSaveStudent}
        studentToEdit={studentToEdit}
        classList={classes}
        currentClass={currentClass}
      />

      <SubjectsModal
        isOpen={isSubjectsModalOpen}
        onClose={() => setIsSubjectsModalOpen(false)}
        subjects={subjects}
        onSaveSubjects={(newSubjects) => {
          setSubjects(newSubjects);
          if (!newSubjects.some((s) => s.name === selectedSubjectForGrade) && newSubjects.length > 0) {
            setSelectedSubjectForGrade(newSubjects[0].name);
          }
        }}
      />

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportStudents={handleImportStudents}
        currentClass={currentClass}
      />

      <GradeEditModal
        isOpen={Boolean(gradeEditModalData)}
        onClose={() => setGradeEditModalData(null)}
        student={gradeEditModalData?.student || null}
        subjectName={gradeEditModalData?.subjectName || ''}
        initialGrades={gradeEditModalData?.grades || { eval1: 10, eval2: 10, dev1: 10, dev2: 10, dev3: 10 }}
        onSave={handleSaveGrades}
      />

      {/* Modal de Saisie des Notes en Lot pour toute la classe */}
      <BatchGradeModal
        isOpen={isBatchGradeModalOpen}
        onClose={() => setIsBatchGradeModalOpen(false)}
        students={currentClassStudents}
        subjects={subjects}
        grades={grades}
        currentClass={currentClass}
        level={level}
        trimester={trimester}
        onSaveBatchGrades={handleSaveBatchGrades}
      />

      {/* Modals d'Administration Full-Stack */}
      <TeacherManagementModal
        isOpen={isTeacherModalOpen}
        onClose={() => setIsTeacherModalOpen(false)}
      />

      <ClassSubjectModal
        isOpen={isClassSubjectModalOpen}
        onClose={() => setIsClassSubjectModalOpen(false)}
        onRefreshNeeded={loadBackendData}
      />

      <AuditBackupModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        onDataRestored={loadBackendData}
      />
    </div>
  );
}
