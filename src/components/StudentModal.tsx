import React, { useState, useEffect } from 'react';
import { Student } from '../types';
import { MidnightButton } from './MidnightButton';
import { X, UserCheck, AlertCircle } from 'lucide-react';

interface StudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (student: Student) => void;
  studentToEdit?: Student | null;
  classList: string[];
  currentClass: string;
}

export const StudentModal: React.FC<StudentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  studentToEdit,
  classList,
  currentClass,
}) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('01/01/2010');
  const [gender, setGender] = useState<'M' | 'F'>('M');
  const [parentPhone, setParentPhone] = useState('+242 06 ');
  const [className, setClassName] = useState(currentClass);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (studentToEdit) {
      setFirstName(studentToEdit.firstName);
      setLastName(studentToEdit.lastName);
      setDob(studentToEdit.dob);
      setGender(studentToEdit.gender);
      setParentPhone(studentToEdit.parentPhone);
      setClassName(studentToEdit.className);
    } else {
      setFirstName('');
      setLastName('');
      setDob('01/01/2010');
      setGender('M');
      setParentPhone('+242 06 ');
      setClassName(currentClass);
    }
    setError(null);
  }, [studentToEdit, currentClass, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setError('Veuillez renseigner le prénom et le nom de famille.');
      return;
    }

    const student: Student = {
      id: studentToEdit ? studentToEdit.id : `CEM-${Date.now().toString().slice(-4)}`,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      dob: dob.trim(),
      gender,
      parentPhone: parentPhone.trim(),
      className,
    };

    onSave(student);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header styled in Light Midnight Blue */}
        <div className="bg-[#1E3A5F] text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-sky-300" />
            <h3 className="font-semibold text-base">
              {studentToEdit ? "Modifier l'Élève" : 'Inscrire un Nouvel Élève'} (CEMINACE)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Prénom (First Name) *
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ex: Grace"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1E3A5F] focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nom de Famille (Last Name) *
              </label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Ex: Moukoko"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1E3A5F] focus:border-transparent outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Date de Naissance (JJ/MM/AAAA) *
              </label>
              <input
                type="text"
                required
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                placeholder="12/04/2010"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1E3A5F] focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Sexe (Gender) *
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as 'M' | 'F')}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1E3A5F] focus:border-transparent outline-none bg-white"
              >
                <option value="M">Masculin (M)</option>
                <option value="F">Féminin (F)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Téléphone Parents (Congo) *
              </label>
              <input
                type="text"
                required
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
                placeholder="+242 06 654 32 10"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1E3A5F] focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Classe Attribuée *
              </label>
              <select
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1E3A5F] focus:border-transparent outline-none bg-white"
              >
                {classList.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <MidnightButton type="button" variant="secondary" size="sm" onClick={onClose}>
              Annuler
            </MidnightButton>
            <MidnightButton type="submit" size="sm">
              {studentToEdit ? 'Enregistrer les Modifications' : 'Ajouter au Registre'}
            </MidnightButton>
          </div>
        </form>
      </div>
    </div>
  );
};
