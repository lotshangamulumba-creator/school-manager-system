import React, { useState } from 'react';
import { LogIn, School, ShieldCheck, UserCheck, AlertCircle, KeyRound, Mail, Sparkles, CheckCircle2 } from 'lucide-react';
import { api, UserProfile } from '../services/api';

interface LoginScreenProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Veuillez renseigner votre adresse email et votre mot de passe.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { user } = await api.login(email.trim(), password);
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || 'Identifiants invalides ou problème de connexion au serveur.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-sky-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800 shadow-2xl rounded-2xl p-6 sm:p-8 z-10">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 shadow-lg shadow-sky-500/25 mb-3">
            <School className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-wide">TIC-TiG Scolaire</h1>
          <p className="text-xs text-sky-400 font-semibold mt-1">
            Complexe Scolaire Privé CEMINACE
          </p>
          <p className="text-[11px] text-slate-400">
            Plateforme Centralisée de Gestion des Notes & Bulletins
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Adresse Email Institutionnelle
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nom@ceminace.cg"
                className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Mot de passe
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-lg shadow-sky-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Se connecter au portail</span>
              </>
            )}
          </button>
        </form>

        {/* Comptes de démonstration préconfigurés */}
        <div className="mt-6 pt-5 border-t border-slate-800">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold mb-2.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Comptes de test préconfigurés :</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => fillDemo('admin@ceminace.cg', 'admin1234')}
              className="p-2.5 text-left rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-sky-500/50 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-sky-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Administrateur
                </span>
                <span className="text-[10px] text-slate-400 group-hover:text-white">Cliquer</span>
              </div>
              <p className="text-[11px] text-slate-300 font-mono mt-0.5 truncate">admin@ceminace.cg</p>
              <p className="text-[10px] text-slate-400">Passe : admin1234</p>
            </button>

            <button
              type="button"
              onClick={() => fillDemo('prof.math@ceminace.cg', 'prof1234')}
              className="p-2.5 text-left rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-indigo-500/50 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-400 flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5" /> Enseignant
                </span>
                <span className="text-[10px] text-slate-400 group-hover:text-white">Cliquer</span>
              </div>
              <p className="text-[11px] text-slate-300 font-mono mt-0.5 truncate">prof.math@ceminace.cg</p>
              <p className="text-[10px] text-slate-400">Passe : prof1234</p>
            </button>
          </div>
        </div>

        {/* Footer Security Badges */}
        <div className="mt-6 flex items-center justify-between text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Session chiffrée JWT
          </span>
          <span className="font-bold text-sky-400 tracking-wider">TiC-TIG</span>
        </div>
      </div>
    </div>
  );
};
