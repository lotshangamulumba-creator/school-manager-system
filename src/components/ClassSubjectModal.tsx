import React, { useState, useEffect } from 'react';
import { X, School, BookOpen, Plus, Check, AlertCircle } from 'lucide-react';
import { api, ApiClass, ApiSubject } from '../services/api';

interface ClassSubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshNeeded: () => void;
}

export const ClassSubjectModal: React.FC<ClassSubjectModalProps> = ({ isOpen, onClose, onRefreshNeeded }) => {
  const [activeTab, setActiveTab] = useState<'classes' | 'subjects'>('classes');
  const [classes, setClasses] = useState<ApiClass[]>([]);
  const [subjects, setSubjects] = useState<ApiSubject[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Formulaire Classe
  const [newClassName, setNewClassName] = useState('');
  const [newClassLevel, setNewClassLevel] = useState<'Primaire' | 'Collège' | 'Lycée'>('Collège');
  const [newClassSection, setNewClassSection] = useState('');

  // Formulaire Matière
  const [newSubjName, setNewSubjName] = useState('');
  const [newSubjCode, setNewSubjCode] = useState('');
  const [newSubjLevel, setNewSubjLevel] = useState<'Primaire' | 'Collège' | 'Lycée'>('Collège');
  const [newSubjSpecialty, setNewSubjSpecialty] = useState<'Sciences' | 'Littérature' | 'EPS' | 'Autre'>('Sciences');
  const [newSubjCoeff, setNewSubjCoeff] = useState(2);

  const loadData = async () => {
    setLoading(true);
    try {
      const [c, s] = await Promise.all([api.getClasses(), api.getSubjects()]);
      setClasses(c);
      setSubjects(s);
    } catch (err: any) {
      setMessage({ text: err.message || 'Erreur de chargement.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      setMessage(null);
    }
  }, [isOpen]);

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;

    try {
      await api.createClass({
        nom: newClassName.trim(),
        niveau: newClassLevel,
        section: newClassSection.trim() || undefined,
        capacite: 45
      });
      setMessage({ text: `Classe ${newClassName} créée avec succès.`, type: 'success' });
      setNewClassName('');
      setNewClassSection('');
      loadData();
      onRefreshNeeded();
    } catch (err: any) {
      setMessage({ text: err.message || 'Erreur création classe.', type: 'error' });
    }
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjName.trim() || !newSubjCode.trim()) return;

    try {
      await api.createSubject({
        nom: newSubjName.trim(),
        code: newSubjCode.trim().toUpperCase(),
        niveau: newSubjLevel,
        specialty: newSubjSpecialty,
        coeff: Number(newSubjCoeff) || 2
      });
      setMessage({ text: `Matière ${newSubjName} créée avec succès.`, type: 'success' });
      setNewSubjName('');
      setNewSubjCode('');
      loadData();
      onRefreshNeeded();
    } catch (err: any) {
      setMessage({ text: err.message || 'Erreur création matière.', type: 'error' });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#0C1E36] to-[#1E3A5F] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
              <School className="w-5 h-5 text-sky-300" />
            </div>
            <div>
              <h2 className="text-base font-black">Configuration des Classes & Matières</h2>
              <p className="text-xs text-sky-200">Personnalisation des cycles (Primaire, Collège, Lycée) et barèmes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6">
          <button
            onClick={() => setActiveTab('classes')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'classes'
                ? 'border-sky-600 text-sky-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <School className="w-4 h-4" />
            <span>Classes ({classes.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('subjects')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'subjects'
                ? 'border-sky-600 text-sky-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Matières ({subjects.length})</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {message && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                message.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                  : 'bg-rose-50 border border-rose-200 text-rose-700'
              }`}
            >
              {message.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{message.text}</span>
            </div>
          )}

          {activeTab === 'classes' ? (
            <div className="space-y-4">
              {/* Formulaire ajout classe */}
              <form onSubmit={handleAddClass} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-sky-600" />
                  <span>Ajouter une Nouvelle Classe</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Nom de la classe</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: 3ème B, 1ère D..."
                      value={newClassName}
                      onChange={(e) => setNewClassName(e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Cycle / Niveau</label>
                    <select
                      value={newClassLevel}
                      onChange={(e) => setNewClassLevel(e.target.value as any)}
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white font-medium"
                    >
                      <option value="Primaire">Primaire (CP1 - CM2)</option>
                      <option value="Collège">Collège (6ème - 3ème)</option>
                      <option value="Lycée">Lycée (2nde - Terminale)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Série / Section</label>
                    <input
                      type="text"
                      placeholder="Ex: Scientifique, Littéraire..."
                      value={newClassSection}
                      onChange={(e) => setNewClassSection(e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                </div>
                <div className="text-right">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Créer la Classe</span>
                  </button>
                </div>
              </form>

              {/* Table classes */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
                      <th className="py-2.5 px-3">Classe</th>
                      <th className="py-2.5 px-3">Niveau</th>
                      <th className="py-2.5 px-3">Section</th>
                      <th className="py-2.5 px-3 text-center">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {classes.map((cls) => (
                      <tr key={cls.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-bold text-slate-900">{cls.nom}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                            {cls.niveau}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{cls.section || '-'}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                            Active
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Formulaire ajout matière */}
              <form onSubmit={handleAddSubject} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-sky-600" />
                  <span>Ajouter une Nouvelle Matière</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Nom de la matière</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Philosophie, Espagnol..."
                      value={newSubjName}
                      onChange={(e) => setNewSubjName(e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Code Matière</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: PHILO"
                      value={newSubjCode}
                      onChange={(e) => setNewSubjCode(e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Coefficient</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={newSubjCoeff}
                      onChange={(e) => setNewSubjCoeff(Number(e.target.value))}
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Pôle / Spécialité</label>
                    <select
                      value={newSubjSpecialty}
                      onChange={(e) => setNewSubjSpecialty(e.target.value as any)}
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white font-medium"
                    >
                      <option value="Sciences">Sciences (Maths, Physique, SVT)</option>
                      <option value="Littérature">Littérature (Français, Histoire-Géo, Anglais)</option>
                      <option value="EPS">Éducation Physique (EPS)</option>
                      <option value="Autre">Autre</option>
                    </select>
                  </div>
                  <div className="flex items-end justify-end">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Ajouter la Matière</span>
                    </button>
                  </div>
                </div>
              </form>

              {/* Table matières */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
                      <th className="py-2.5 px-3">Matière</th>
                      <th className="py-2.5 px-3">Code</th>
                      <th className="py-2.5 px-3">Spécialité</th>
                      <th className="py-2.5 px-3 text-center">Coeff</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {subjects.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-bold text-slate-900">{s.nom}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-600">{s.code}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              s.specialty === 'Sciences'
                                ? 'bg-sky-50 text-sky-700'
                                : s.specialty === 'Littérature'
                                ? 'bg-indigo-50 text-indigo-700'
                                : 'bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            {s.specialty}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                          {s.coeff}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition-all cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
