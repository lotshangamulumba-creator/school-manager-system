import React, { useState, useEffect } from 'react';
import { Student, StudentGrades } from '../types';
import { MidnightButton } from './MidnightButton';
import { X, Calculator, Award } from 'lucide-react';

interface GradeEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  subjectName: string;
  trimester?: string;
  initialGrades: StudentGrades;
  onSave: (grades: StudentGrades) => void;
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
    (initialGrades.evaluations ?? initialGrades.eval1 ?? 10).toString()
  );
  const [dev1, setDev1] = useState((initialGrades.dev1 ?? 10).toString());
  const [dev2, setDev2] = useState((initialGrades.dev2 ?? 10).toString());
  const [composition, setComposition] = useState(
    (initialGrades.composition ?? initialGrades.dev3 ?? 10).toString()
  );

  useEffect(() => {
    setEvaluations((initialGrades.evaluations ?? initialGrades.eval1 ?? 10).toString());
    setDev1((initialGrades.dev1 ?? 10).toString());
    setDev2((initialGrades.dev2 ?? 10).toString());
    setComposition((initialGrades.composition ?? initialGrades.dev3 ?? 10).toString());
  }, [initialGrades, isOpen]);

  if (!isOpen || !student) return null;

  const numEval = Math.min(20, Math.max(0, parseFloat(evaluations) || 0));
  const numD1 = Math.min(20, Math.max(0, parseFloat(dev1) || 0));
  const numD2 = Math.min(20, Math.max(0, parseFloat(dev2) || 0));
  const numComp = Math.min(20, Math.max(0, parseFloat(composition) || 0));

  // Contrôle Continu (CC) = (Notes Évaluations + Devoir 1 + Devoir 2) / 3
  const cc = (numEval + numD1 + numD2) / 3;
  // Formule officielle CEMINACE Congo : Moyenne = (CC + 2 * COMPOSITION) / 3
  const computedMoyenne = (cc + 2 * numComp) / 3;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      evaluations: numEval,
      dev1: numD1,
      dev2: numD2,
      composition: numComp,
      eval1: numEval,
      eval2: numEval,
      dev3: numComp,
    });
    onClose();
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
            className="text-slate-300 hover:text-white p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 text-xs text-sky-900 space-y-1">
            <div className="flex justify-between font-semibold">
              <span>Formule Officielle CEMINACE (Congo) :</span>
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
                required
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
                  required
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
                  required
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
                required
              />
              <span className="text-[10px] text-amber-800 block mt-1">
                Épreuve de synthèse trimestrielle majeure comptant double dans la moyenne.
              </span>
            </div>
          </div>

          {/* Live computed preview */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 grid grid-cols-3 text-center text-xs gap-1">
            <div>
              <span className="text-slate-500 block text-[11px]">Contrôle Continu</span>
              <span className="font-bold text-slate-800 text-sm">{cc.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-amber-700 block text-[11px]">Composition</span>
              <span className="font-bold text-amber-800 text-sm">{numComp.toFixed(2)}</span>
            </div>
            <div className="border-l border-slate-200 pl-2">
              <span className="text-[#1E3A5F] font-semibold block text-[11px]">Moyenne Finale</span>
              <span className="font-extrabold text-[#1E3A5F] text-base">
                {computedMoyenne.toFixed(2)} / 20
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
            <MidnightButton type="button" variant="secondary" size="sm" onClick={onClose}>
              Annuler
            </MidnightButton>
            <MidnightButton type="submit" size="sm">
              Enregistrer
            </MidnightButton>
          </div>
        </form>
      </div>
    </div>
  );
};
