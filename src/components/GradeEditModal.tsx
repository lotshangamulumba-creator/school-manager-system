import React, { useState, useEffect } from 'react';
import { Student, StudentGrades } from '../types';
import { MidnightButton } from './MidnightButton';
import { X, Calculator, Award, AlertCircle } from 'lucide-react';
import { parseGradeInput } from '../utils/gradeInput';

interface GradeEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  subjectName: string;
  trimester?: string;
  initialGrades: Partial<StudentGrades>;
  onSave: (grades: StudentGrades) => Promise<void>;
}

export const GradeEditModal: React.FC<GradeEditModalProps> = ({
  isOpen,
  onClose,
  student,
  subjectName,
  trimester = '1er Trimestre',
  initialGrades,
  onSave,
}) => {
  const [evaluations, setEvaluations] = useState(
    (initialGrades.evaluations ?? initialGrades.eval1 ?? '').toString()
  );
  const [dev1, setDev1] = useState((initialGrades.dev1 ?? '').toString());
  const [dev2, setDev2] = useState((initialGrades.dev2 ?? '').toString());
  const [composition, setComposition] = useState(
    (initialGrades.composition ?? initialGrades.dev3 ?? '').toString()
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setEvaluations((initialGrades.evaluations ?? initialGrades.eval1 ?? '').toString());
    setDev1((initialGrades.dev1 ?? '').toString());
    setDev2((initialGrades.dev2 ?? '').toString());
    setComposition((initialGrades.composition ?? initialGrades.dev3 ?? '').toString());
    setSaveError(null);
  }, [initialGrades, isOpen]);

  if (!isOpen || !student) return null;

  const parsedValues = [evaluations, dev1, dev2, composition].map((value) =>
    value.trim() === '' ? null : Number(value)
  );
  const hasValidGrades = parsedValues.every((value) =>
    value === null || (Number.isFinite(value) && value >= 0 && value <= 20)
  );
  const [numEval, numD1, numD2, numComp] = parsedValues;
  const ccNotes = [numEval, numD1, numD2].filter((value): value is number => value !== null);
  const cc = ccNotes.length > 0
    ? ccNotes.reduce((sum, value) => sum + value, 0) / ccNotes.length
    : null;
  const computedMoyenne = numComp !== null && cc !== null ? (cc + 2 * numComp) / 3 : null;
  const hasAnyGrade = parsedValues.some((value) => value !== null);
  const isProvisional = hasAnyGrade && parsedValues.some((value) => value === null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    try {
      const [savedEval, savedD1, savedD2, savedComp] = [
        evaluations,
        dev1,
        dev2,
        composition,
      ].map(parseGradeInput);
      if ([savedEval, savedD1, savedD2, savedComp].every((value) => value === null)) {
        throw new Error('Saisissez au moins une note.');
      }
      await onSave({
        evaluations: savedEval,
        dev1: savedD1,
        dev2: savedD2,
        composition: savedComp,
        eval1: savedEval ?? undefined,
        eval2: savedEval ?? undefined,
        dev3: savedComp ?? undefined,
      });
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'L’enregistrement des notes a échoué.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-[#1E3A5F] text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-sky-300" />
            <div>
              <h3 className="font-semibold text-sm md:text-base">Saisie des Notes & Composition</h3>
              <p className="text-[11px] text-sky-200">
                {student.lastName.toUpperCase()} {student.firstName} • {subjectName} ({trimester})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="text-slate-300 hover:text-white p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 text-xs text-sky-900 space-y-1">
            <div className="flex justify-between font-semibold">
              <span>Formule officielle :</span>
              <span className="text-[#1E3A5F]">{trimester}</span>
            </div>
            <div className="font-mono text-[11px] text-sky-800">
              CC = (Évals + Devoir 1 + Devoir 2) / 3
              <br />
              Moyenne = (CC + 2 × COMPOSITION) / 3
            </div>
          </div>

          <div className="space-y-3">
            {/* 1. Notes Évaluations */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Notes Évaluations (/20)
              </label>
              <input
                type="number"
                step="0.25"
                min="0"
                max="20"
                value={evaluations}
                onChange={(e) => setEvaluations(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                placeholder="Ex: 14.5"
              />
            </div>

            {/* 2. Devoirs 1 et 2 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notes Devoir 1 (/20)
                </label>
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  max="20"
                  value={dev1}
                  onChange={(e) => setDev1(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                  placeholder="Ex: 12"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notes Devoir 2 (/20)
                </label>
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  max="20"
                  value={dev2}
                  onChange={(e) => setDev2(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                  placeholder="Ex: 13.5"
                />
              </div>
            </div>

            {/* 3. Notes COMPOSITION par trimestre */}
            <div className="bg-amber-50/60 border border-amber-200 rounded-lg p-2.5">
              <label className="flex items-center gap-1.5 text-xs font-bold text-amber-900 mb-1">
                <Award className="w-4 h-4 text-amber-600" />
                Notes COMPOSITION ({trimester}) (/20) - Coeff 2
              </label>
              <input
                type="number"
                step="0.25"
                min="0"
                max="20"
                value={composition}
                onChange={(e) => setComposition(e.target.value)}
                className="w-full px-3 py-2 text-sm font-semibold border border-amber-300 bg-white rounded-lg outline-none focus:ring-2 focus:ring-amber-500 text-amber-950"
                placeholder="Ex: 15"
              />
              <span className="text-[10px] text-amber-800 block mt-1">
                Épreuve de synthèse trimestrielle majeure comptant double dans la moyenne.
              </span>
            </div>
          </div>

          {saveError && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          {/* Live computed preview */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 grid grid-cols-3 text-center text-xs gap-1">
            <div>
              <span className="text-slate-500 block text-[11px]">Contrôle Continu</span>
              <span className="font-bold text-slate-800 text-sm">{hasValidGrades && cc !== null ? cc.toFixed(2) : '—'}</span>
            </div>
            <div>
              <span className="text-amber-700 block text-[11px]">Composition</span>
              <span className="font-bold text-amber-800 text-sm">{hasValidGrades && numComp !== null ? numComp.toFixed(2) : '—'}</span>
            </div>
            <div className="border-l border-slate-200 pl-2">
              <span className="text-[#1E3A5F] font-semibold block text-[11px]">Moyenne Finale</span>
              <span className="font-extrabold text-[#1E3A5F] text-base">
                {hasValidGrades && computedMoyenne !== null ? `${computedMoyenne.toFixed(2)} / 20` : '—'}
              </span>
              {isProvisional && <span className="mt-1 block text-[10px] font-semibold text-amber-700">Provisoire</span>}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
            <MidnightButton type="button" variant="secondary" size="sm" onClick={onClose} disabled={isSaving}>
              Annuler
            </MidnightButton>
            <MidnightButton type="submit" size="sm" disabled={isSaving}>
              {isSaving ? 'Enregistrement...' : 'Enregistrer'}
            </MidnightButton>
          </div>
        </form>
      </div>
    </div>
  );
};
