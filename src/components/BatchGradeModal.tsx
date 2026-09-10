import React, { useState, useEffect } from 'react';
import { Student, StudentGrades, Subject } from '../types';
import { MidnightButton } from './MidnightButton';
import { X, Calculator, Award, Save, CheckCircle2 } from 'lucide-react';

interface BatchGradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  currentClass: string;
  subjects: Subject[];
  selectedSubject: Subject | null;
  onSelectSubject: (sub: Subject) => void;
  trimester: string;
  gradesMap: Record<string, StudentGrades>;
  onSaveBatch: (updatedGrades: Record<string, StudentGrades>) => void;
}

export const BatchGradeModal: React.FC<BatchGradeModalProps> = ({
  isOpen,
  onClose,
  students,
  currentClass,
  subjects,
  selectedSubject,
  onSelectSubject,
  trimester,
  gradesMap,
  onSaveBatch,
}) => {
  const [localRows, setLocalRows] = useState<
    Record<string, { evalNote: string; dev1: string; dev2: string; comp: string }>
  >({});
  const [savedSuccess, setSavedSuccess] = useState(false);

  const classStudents = students.filter((s) => s.className === currentClass);

  // Initialize or reinitialize row states when modal opens, class, subject, or trimester changes
  useEffect(() => {
    if (!isOpen || !selectedSubject) return;

    const initial: Record<string, { evalNote: string; dev1: string; dev2: string; comp: string }> = {};

    classStudents.forEach((student) => {
      const g =
        gradesMap[`${student.id}_${selectedSubject.name}_${trimester}`] ||
        gradesMap[`${student.id}_${selectedSubject.name}`] || {
          evaluations: 10,
          dev1: 10,
          dev2: 10,
          composition: 10,
          eval1: 10,
          eval2: 10,
          dev3: 10,
        };

      const evalVal = g.evaluations ?? g.eval1 ?? 10;
      const d1Val = g.dev1 ?? 10;
      const d2Val = g.dev2 ?? 10;
      const compVal = g.composition ?? g.dev3 ?? 10;

      initial[student.id] = {
        evalNote: evalVal.toString(),
        dev1: d1Val.toString(),
        dev2: d2Val.toString(),
        comp: compVal.toString(),
      };
    });

    setLocalRows(initial);
    setSavedSuccess(false);
  }, [isOpen, selectedSubject, currentClass, trimester]);

  if (!isOpen || !selectedSubject) return null;

  const handleRowChange = (
    studentId: string,
    field: 'evalNote' | 'dev1' | 'dev2' | 'comp',
    value: string
  ) => {
    setLocalRows((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { evalNote: '10', dev1: '10', dev2: '10', comp: '10' }),
        [field]: value,
      },
    }));
  };

  const handleSaveAll = (e: React.FormEvent) => {
    e.preventDefault();
    const updates: Record<string, StudentGrades> = {};

    classStudents.forEach((student) => {
      const row = localRows[student.id] || {
        evalNote: '10',
        dev1: '10',
        dev2: '10',
        comp: '10',
      };

      const eNum = Math.min(20, Math.max(0, parseFloat(row.evalNote) || 0));
      const d1Num = Math.min(20, Math.max(0, parseFloat(row.dev1) || 0));
      const d2Num = Math.min(20, Math.max(0, parseFloat(row.dev2) || 0));
      const compNum = Math.min(20, Math.max(0, parseFloat(row.comp) || 0));

      const gradeObj: StudentGrades = {
        evaluations: eNum,
        dev1: d1Num,
        dev2: d2Num,
        composition: compNum,
        eval1: eNum,
        eval2: eNum,
        dev3: compNum,
      };

      const keyWithTrim = `${student.id}_${selectedSubject.name}_${trimester}`;
      updates[keyWithTrim] = gradeObj;
      if (trimester === '1er Trimestre') {
        updates[`${student.id}_${selectedSubject.name}`] = gradeObj;
      }
    });

    onSaveBatch(updates);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 md:p-6">
      <div className="relative w-full max-w-4xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-[#1E3A5F] text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Calculator className="w-5 h-5 text-sky-300" />
            <div>
              <h3 className="font-semibold text-sm md:text-base flex items-center gap-2">
                Saisie Complète des Notes : {currentClass} • {trimester}
              </h3>
              <p className="text-xs text-sky-200">
                Notes Évaluations, Devoir 1, Devoir 2 et COMPOSITION pour toute la classe
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar: Subject Selector and CEMINACE Formula */}
        <div className="bg-slate-50 border-b border-slate-200 p-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">Matière sélectionnée :</span>
            <select
              value={selectedSubject.name}
              onChange={(e) => {
                const sub = subjects.find((s) => s.name === e.target.value);
                if (sub) onSelectSubject(sub);
              }}
              className="bg-white border border-slate-300 text-xs font-bold text-[#1E3A5F] rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-[#1E3A5F]"
            >
              {subjects.map((sub) => (
                <option key={sub.name} value={sub.name}>
                  {sub.name} ({sub.specialty} • Coeff {sub.coeff})
                </option>
              ))}
            </select>
          </div>

          <div className="text-[11px] bg-sky-100/70 border border-sky-200 text-sky-900 px-3 py-1 rounded-md font-mono">
            CC = (Évals + D1 + D2)/3  •  Moyenne = (CC + 2 × COMPOSITION)/3
          </div>
        </div>

        {/* Form & Table */}
        <form onSubmit={handleSaveAll} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4">
            {classStudents.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-sm">
                Aucun élève inscrit dans cette classe. Veuillez ajouter des élèves avant de saisir des notes.
              </div>
            ) : (
              <table className="w-full text-xs text-left border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-100 text-slate-700 font-semibold uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Élève & Matricule</th>
                    <th className="py-2 px-2 text-center w-28">Évaluations (/20)</th>
                    <th className="py-2 px-2 text-center w-24">Devoir 1 (/20)</th>
                    <th className="py-2 px-2 text-center w-24">Devoir 2 (/20)</th>
                    <th className="py-2 px-2 text-center w-32 bg-amber-100 text-amber-900">
                      COMPOSITION (/20)
                    </th>
                    <th className="py-2 px-2 text-center w-24 bg-sky-50 text-sky-900">
                      Moyenne /20
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {classStudents.map((student) => {
                    const row = localRows[student.id] || {
                      evalNote: '10',
                      dev1: '10',
                      dev2: '10',
                      comp: '10',
                    };

                    const eVal = Math.min(20, Math.max(0, parseFloat(row.evalNote) || 0));
                    const d1Val = Math.min(20, Math.max(0, parseFloat(row.dev1) || 0));
                    const d2Val = Math.min(20, Math.max(0, parseFloat(row.dev2) || 0));
                    const compVal = Math.min(20, Math.max(0, parseFloat(row.comp) || 0));

                    const cc = (eVal + d1Val + d2Val) / 3;
                    const computedAvg = (cc + 2 * compVal) / 3;

                    return (
                      <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2 px-3 font-medium text-slate-800">
                          <div className="font-bold text-slate-900">
                            {student.lastName.toUpperCase()} {student.firstName}
                          </div>
                          <div className="text-[10px] text-slate-400">{student.id}</div>
                        </td>

                        {/* Évaluations */}
                        <td className="py-2 px-2 text-center">
                          <input
                            type="number"
                            step="0.25"
                            min="0"
                            max="20"
                            value={row.evalNote}
                            onChange={(e) => handleRowChange(student.id, 'evalNote', e.target.value)}
                            className="w-20 text-center px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-[#1E3A5F] outline-none"
                            required
                          />
                        </td>

                        {/* Devoir 1 */}
                        <td className="py-2 px-2 text-center">
                          <input
                            type="number"
                            step="0.25"
                            min="0"
                            max="20"
                            value={row.dev1}
                            onChange={(e) => handleRowChange(student.id, 'dev1', e.target.value)}
                            className="w-18 text-center px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-[#1E3A5F] outline-none"
                            required
                          />
                        </td>

                        {/* Devoir 2 */}
                        <td className="py-2 px-2 text-center">
                          <input
                            type="number"
                            step="0.25"
                            min="0"
                            max="20"
                            value={row.dev2}
                            onChange={(e) => handleRowChange(student.id, 'dev2', e.target.value)}
                            className="w-18 text-center px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-[#1E3A5F] outline-none"
                            required
                          />
                        </td>

                        {/* COMPOSITION */}
                        <td className="py-2 px-2 text-center bg-amber-50/50">
                          <input
                            type="number"
                            step="0.25"
                            min="0"
                            max="20"
                            value={row.comp}
                            onChange={(e) => handleRowChange(student.id, 'comp', e.target.value)}
                            className="w-24 text-center px-2 py-1 text-xs font-bold text-amber-950 border border-amber-300 bg-amber-50/80 rounded focus:ring-1 focus:ring-amber-600 outline-none"
                            required
                          />
                        </td>

                        {/* Moyenne Calculée */}
                        <td className="py-2 px-2 text-center bg-sky-50/50 font-bold">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs ${
                              computedAvg >= 14
                                ? 'bg-emerald-100 text-emerald-800'
                                : computedAvg >= 10
                                ? 'bg-sky-100 text-sky-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {computedAvg.toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer with Actions */}
          <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-between shrink-0">
            <div className="text-xs text-slate-500">
              {classStudents.length} élèves • Trimestre actif :{' '}
              <span className="font-bold text-[#1E3A5F]">{trimester}</span>
            </div>

            <div className="flex items-center gap-2">
              {savedSuccess && (
                <div className="flex items-center gap-1 text-xs font-bold text-emerald-600 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4" />
                  Notes enregistrées avec succès !
                </div>
              )}
              <MidnightButton type="button" variant="secondary" size="sm" onClick={onClose}>
                Annuler
              </MidnightButton>
              <MidnightButton type="submit" size="sm">
                <Save className="w-4 h-4 mr-1.5 inline" />
                Enregistrer la Classe
              </MidnightButton>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
