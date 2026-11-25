import React, { useEffect, useState } from 'react';
import { Subject, Specialty, SchoolLevel } from '../types';
import { MidnightButton } from './MidnightButton';
import { X, BookOpen, Plus, Trash2 } from 'lucide-react';
import { api, ApiSubject } from '../services/api';

interface SubjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  level: SchoolLevel;
  subjects: Subject[];
  onSaveSubjects: (newSubjects: Subject[]) => void;
}

function mapSubject(subject: ApiSubject): Subject {
  return {
    id: subject.id,
    name: subject.nom,
    coeff: subject.coeff,
    specialty:
      subject.specialty === 'Littérature' || subject.specialty === 'EPS'
        ? subject.specialty
        : 'Sciences',
    level: subject.niveau,
  };
}

export const SubjectsModal: React.FC<SubjectsModalProps> = ({
  isOpen,
  onClose,
  level,
  subjects,
  onSaveSubjects,
}) => {
  const [list, setList] = useState<Subject[]>(subjects);
  const [newName, setNewName] = useState('');
  const [newCoeff, setNewCoeff] = useState('2');
  const [newSpecialty, setNewSpecialty] = useState<Specialty>('Sciences');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) setList(subjects);
  }, [isOpen, subjects]);

  if (!isOpen) return null;

  const handleAddSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const add = async () => {
      setIsSaving(true);
      setSaveError(null);
      try {
        const created = await api.createSubject({
          nom: newName.trim(),
          code: `SUB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
          niveau: level,
          specialty: newSpecialty,
          coeff: Math.max(1, parseInt(newCoeff, 10) || 1),
        });
        const updated = [...list, mapSubject(created)];
        setList(updated);
        onSaveSubjects(updated);
        setNewName('');
        setNewCoeff('2');
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'La création de matière a échoué.');
      } finally {
        setIsSaving(false);
      }
    };
    void add();
  };

  const handleDelete = (id: string) => {
    const remove = async () => {
      setIsSaving(true);
      setSaveError(null);
      try {
        await api.updateSubject(id, { statut: false });
        const updated = list.filter((subject) => subject.id !== id);
        setList(updated);
        onSaveSubjects(updated);
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'La suppression de matière a échoué.');
      } finally {
        setIsSaving(false);
      }
    };
    void remove();
  };

  const handleUpdateCoeff = (id: string) => {
    const update = async () => {
      const newValue = list.find((subject) => subject.id === id)?.coeff;
      if (newValue === undefined) return;
      setIsSaving(true);
      setSaveError(null);
      try {
        await api.updateSubject(id, { coeff: newValue });
        onSaveSubjects(list);
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'La mise à jour du coefficient a échoué.');
      } finally {
        setIsSaving(false);
      }
    };
    void update();
  };

  const handleUpdateSpecialty = (id: string, specialty: Specialty) => {
    const update = async () => {
      setIsSaving(true);
      setSaveError(null);
      try {
        await api.updateSubject(id, { specialty });
        const updated = list.map((subject) =>
          subject.id === id ? { ...subject, specialty } : subject
        );
        setList(updated);
        onSaveSubjects(updated);
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'La mise à jour de la spécialité a échoué.');
      } finally {
        setIsSaving(false);
      }
    };
    void update();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-[#1E3A5F] text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-sky-300" />
            <h3 className="font-semibold text-base">
              Configuration des Matières, Coefficients & Spécialités
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="text-slate-300 hover:text-white p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Add form */}
          {saveError && (
            <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {saveError}
            </div>
          )}

          <form
            onSubmit={handleAddSubject}
            className="bg-slate-50 border border-slate-200 rounded-lg p-3 grid grid-cols-1 md:grid-cols-4 gap-2.5 items-end"
          >
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nom de la Matière
              </label>
              <input
                type="text"
                placeholder="Ex: Informatique, Économie"
                value={newName}
                disabled={isSaving}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs md:text-sm border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-[#1E3A5F]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Coefficient
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={newCoeff}
                disabled={isSaving}
                onChange={(e) => setNewCoeff(e.target.value)}
                className="w-full px-3 py-1.5 text-xs md:text-sm border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-[#1E3A5F]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Spécialité
              </label>
              <select
                value={newSpecialty}
                disabled={isSaving}
                onChange={(e) => setNewSpecialty(e.target.value as Specialty)}
                className="w-full px-2.5 py-1.5 text-xs md:text-sm border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-[#1E3A5F] bg-white"
              >
                <option value="Sciences">Sciences</option>
                <option value="Littérature">Littérature</option>
                <option value="EPS">EPS</option>
              </select>
            </div>
            <div className="md:col-span-4 flex justify-end">
              <MidnightButton type="submit" size="sm" disabled={isSaving} icon={<Plus className="w-4 h-4" />}>
                Ajouter la Matière
              </MidnightButton>
            </div>
          </form>

          {/* Table */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1E3A5F] text-white">
                <tr>
                  <th className="py-2 px-3 font-semibold">Matière</th>
                  <th className="py-2 px-3 font-semibold text-center w-24">Coefficient</th>
                  <th className="py-2 px-3 font-semibold w-36">Spécialité académique</th>
                  <th className="py-2 px-3 font-semibold text-right w-16">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {list.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 font-medium text-slate-900">{sub.name}</td>
                    <td className="py-2 px-3 text-center">
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={sub.coeff}
                        disabled={isSaving}
                        onChange={(e) => {
                          const coeff = Math.max(1, parseInt(e.target.value, 10) || 1);
                          setList((current) =>
                            current.map((subject) =>
                              subject.id === sub.id ? { ...subject, coeff } : subject
                            )
                          );
                        }}
                        onBlur={() => handleUpdateCoeff(sub.id)}
                        className="w-14 text-center py-1 border border-slate-300 rounded focus:ring-1 focus:ring-[#1E3A5F] outline-none font-bold"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <select
                        value={sub.specialty}
                        disabled={isSaving}
                        onChange={(e) => handleUpdateSpecialty(sub.id, e.target.value as Specialty)}
                        className="w-full py-1 px-2 border border-slate-300 rounded bg-white outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                      >
                        <option value="Sciences">Sciences</option>
                        <option value="Littérature">Littérature</option>
                        <option value="EPS">EPS</option>
                      </select>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button
                        onClick={() => handleDelete(sub.id)}
                        disabled={isSaving}
                        className="text-rose-600 hover:text-rose-800 p-1 rounded hover:bg-rose-50 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-end">
          <MidnightButton onClick={onClose} size="sm" disabled={isSaving}>
            Fermer et Appliquer
          </MidnightButton>
        </div>
      </div>
    </div>
  );
};
