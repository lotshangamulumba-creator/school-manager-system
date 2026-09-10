import React, { useState, useEffect } from 'react';
import { X, UserPlus, GraduationCap, Mail, Phone, BookOpen, ShieldCheck, Check, AlertCircle } from 'lucide-react';
import { api, ApiTeacher } from '../services/api';

interface TeacherManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TeacherManagementModal: React.FC<TeacherManagementModalProps> = ({ isOpen, onClose }) => {
  const [teachers, setTeachers] = useState<ApiTeacher[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Formulaire d'ajout
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [specialite, setSpecialite] = useState('Mathématiques & Sciences');
  const [createAccount, setCreateAccount] = useState(true);
  const [initialPassword, setInitialPassword] = useState('prof1234');

  const loadTeachers = async () => {
    setLoading(true);
    try {
      const data = await api.getTeachers();
      setTeachers(data);
    } catch (err: any) {
      setError(err.message || 'Impossible de charger la liste des enseignants.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadTeachers();
      setError(null);
      setSuccess(null);
    }
  }, [isOpen]);

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom || !prenom || !email) {
      setError('Veuillez renseigner le nom, le prénom et l’email.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await api.createTeacher({
        nom,
        prenom,
        email,
        telephone,
        specialite,
        createAccount,
        initialPassword: createAccount ? initialPassword : undefined,
      });

      setSuccess(`Enseignant ${nom.toUpperCase()} ${prenom} enregistré avec succès.`);
      setNom('');
      setPrenom('');
      setEmail('');
      setTelephone('');
      loadTeachers();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création de l’enseignant.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#0C1E36] to-[#1E3A5F] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-sky-300" />
            </div>
            <div>
              <h2 className="text-base font-black">Corps Professoral & Enseignants</h2>
              <p className="text-xs text-sky-200">Gestion des profils et attributions des comptes d'accès</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Formulaire Nouvel Enseignant */}
          <form onSubmit={handleCreateTeacher} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-sky-600" />
              <span>Enregistrer un Nouvel Enseignant</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Nom</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: MBOUNGOU"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white focus:outline-sky-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Prénom</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Martial"
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white focus:outline-sky-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Email Professionnel</label>
                <input
                  type="email"
                  required
                  placeholder="nom@ceminace.cg"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white focus:outline-sky-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Téléphone</label>
                <input
                  type="text"
                  placeholder="+242 06..."
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white focus:outline-sky-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Spécialité / Matières</label>
                <input
                  type="text"
                  placeholder="Ex: Mathématiques, SVT..."
                  value={specialite}
                  onChange={(e) => setSpecialite(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white focus:outline-sky-500"
                />
              </div>

              <div className="flex items-center gap-4 pt-4">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={createAccount}
                    onChange={(e) => setCreateAccount(e.target.checked)}
                    className="w-4 h-4 text-sky-600 rounded-sm"
                  />
                  <span>Créer un compte d'accès web</span>
                </label>

                {createAccount && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span className="font-bold">Mot de passe initial :</span>
                    <input
                      type="text"
                      value={initialPassword}
                      onChange={(e) => setInitialPassword(e.target.value)}
                      className="w-24 text-xs px-2 py-1 rounded-sm border border-slate-300 font-mono bg-white"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="text-right">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Enregistrer l'Enseignant</span>
              </button>
            </div>
          </form>

          {/* Liste des enseignants */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
              Enseignants Actuels ({teachers.length})
            </h3>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
                    <th className="py-2.5 px-3">Enseignant</th>
                    <th className="py-2.5 px-3">Email & Contact</th>
                    <th className="py-2.5 px-3">Spécialité</th>
                    <th className="py-2.5 px-3 text-center">Accès Web</th>
                    <th className="py-2.5 px-3 text-center">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {teachers.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {t.nom} {t.prenom}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        <div>{t.email}</div>
                        {t.telephone && <div className="text-[10px] text-slate-400">{t.telephone}</div>}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 font-medium">
                        {t.specialite || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {t.userId ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <ShieldCheck className="w-3 h-3" /> Actif
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Non configuré</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700">
                          En activité
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
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
