import React, { useState } from 'react';
import { LogIn, AlertCircle, KeyRound, Mail, CheckCircle2 } from 'lucide-react';
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

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-fuchsia-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800 shadow-2xl rounded-2xl p-6 sm:p-8 z-10">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 via-violet-600 to-fuchsia-600 shadow-lg shadow-cyan-500/25 mb-3">
            <svg
              viewBox="0 0 64 64"
              className="w-11 h-11"
              role="img"
              aria-label="MonPilot"
            >
              <defs>
                <linearGradient id="monpilot-wheel" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#22d3ee" />
                  <stop offset="0.38" stopColor="#2563eb" />
                  <stop offset="0.68" stopColor="#c026d3" />
                  <stop offset="1" stopColor="#fb923c" />
                </linearGradient>
                <linearGradient id="monpilot-mp" x1="23" y1="23" x2="43" y2="44" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#67e8f9" />
                  <stop offset="0.5" stopColor="#a78bfa" />
                  <stop offset="1" stopColor="#fb923c" />
                </linearGradient>
              </defs>
              <circle cx="32" cy="32" r="24" fill="none" stroke="url(#monpilot-wheel)" strokeWidth="6" />
              <path
                d="M18.5 22.5 27 31m18.5-8.5L37 31M32 39v-7"
                fill="none"
                stroke="url(#monpilot-wheel)"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="5"
              />
              <circle cx="32" cy="32" r="10.5" fill="#0f172a" stroke="url(#monpilot-wheel)" strokeWidth="2" />
              <path
                d="M25 39V25l7 8 7-8v14"
                fill="none"
                stroke="url(#monpilot-mp)"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3.25"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-white tracking-wide">MonPilot</h1>
          <p className="text-xs text-cyan-300 font-semibold mt-1">
            School ERP
          </p>
          <p className="text-xs text-violet-300 font-semibold mt-1">
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
              <Mail className="w-4 h-4 text-cyan-300/80 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nom@ceminace.cg"
                className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Mot de passe
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-violet-300/80 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-500 via-violet-600 to-fuchsia-600 hover:from-cyan-400 hover:via-violet-500 hover:to-orange-400 text-white shadow-lg shadow-cyan-500/20 hover:shadow-fuchsia-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
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

        {/* Footer Security Badges */}
        <div className="mt-6 flex items-center justify-between text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Session chiffrée JWT
          </span>
          <span className="font-bold text-cyan-300 tracking-wider">MONPILOT</span>
        </div>
      </div>
    </div>
  );
};
