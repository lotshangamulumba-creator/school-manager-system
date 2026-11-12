import React, { useState } from 'react';
import { AlertCircle, CalendarClock, KeyRound, LogOut, ShieldCheck, Upload, X } from 'lucide-react';
import { LicenseStatusResponse, SignedSchoolLicense } from '../services/api';
import { MidnightButton } from './MidnightButton';

interface LicenseManagementViewProps {
  status: LicenseStatusResponse | null;
  isAdmin: boolean;
  blocked?: boolean;
  onInstall: (license: SignedSchoolLicense) => Promise<void>;
  onLogout: () => void;
  onBack?: () => void;
}

const STATE_LABELS: Record<LicenseStatusResponse['state'], string> = {
  active: 'Active',
  missing: 'Aucune licence installée',
  invalid: 'Licence invalide',
  not_started: 'Pas encore active',
  expired: 'Expirée',
  unconfigured: 'Configuration serveur requise',
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export const LicenseManagementView: React.FC<LicenseManagementViewProps> = ({
  status,
  isAdmin,
  blocked = false,
  onInstall,
  onLogout,
  onBack,
}) => {
  const [licenseText, setLicenseText] = useState('');
  const [isInstalling, setIsInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInstall = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsInstalling(true);
    try {
      const license = JSON.parse(licenseText) as SignedSchoolLicense;
      await onInstall(license);
      setLicenseText('');
    } catch (installError) {
      setError(installError instanceof Error ? installError.message : 'Le document de licence est invalide.');
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <div className={`${blocked ? 'min-h-screen bg-slate-950' : 'min-h-[520px]'} flex items-center justify-center p-4`}>
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="bg-slate-950 px-6 py-5 text-white sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl border border-white/15 bg-white/10 p-2.5">
                {status?.state === 'active' ? <ShieldCheck className="h-6 w-6 text-emerald-300" /> : <KeyRound className="h-6 w-6 text-amber-300" />}
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">MonPilot School ERP</p>
                <h2 className="mt-1 text-xl font-black sm:text-2xl">
                  {blocked ? 'Licence requise pour continuer' : 'Gestion de la licence'}
                </h2>
                <p className="mt-1 text-sm text-slate-300">
                  {status?.schoolName || 'Établissement'}
                </p>
              </div>
            </div>
            {onBack && (
              <button onClick={onBack} className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white" aria-label="Retour à MonPilot">
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        <div className="space-y-5 p-5 sm:p-8">
          <div className={`rounded-xl border p-4 ${status?.state === 'active' ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">État de la licence</p>
                <p className="mt-1 font-bold text-slate-900">{status ? STATE_LABELS[status.state] : 'Vérification en cours'}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Identifiant école</p>
                <code className="mt-1 inline-block select-all rounded bg-white/80 px-2 py-1 text-xs font-bold text-slate-800">
                  {status?.schoolId || 'Indisponible'}
                </code>
              </div>
            </div>
            {status?.license && (
              <div className="mt-4 grid gap-3 border-t border-slate-200/80 pt-3 text-sm sm:grid-cols-3">
                <div>
                  <span className="block text-xs text-slate-500">Abonnement</span>
                  <span className="font-semibold text-slate-900">{status.license.plan === 'annual' ? 'Annuel' : 'Mensuel'}</span>
                </div>
                <div>
                  <span className="block text-xs text-slate-500">Début</span>
                  <span className="font-semibold text-slate-900">{formatDate(status.license.startsAt)}</span>
                </div>
                <div>
                  <span className="block text-xs text-slate-500">Expiration</span>
                  <span className="font-semibold text-slate-900">{formatDate(status.license.expiresAt)}</span>
                </div>
              </div>
            )}
          </div>

          {status?.state === 'unconfigured' && (
            <div role="alert" className="flex gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              La clé publique de vérification doit être configurée par l’administrateur du serveur avant d’installer une licence.
            </div>
          )}

          {isAdmin ? (
            <form onSubmit={handleInstall} className="space-y-3">
              <div>
                <label htmlFor="signed-license" className="mb-1.5 block text-sm font-bold text-slate-800">
                  Installer ou renouveler une licence signée
                </label>
                <p className="mb-2 text-xs leading-relaxed text-slate-600">
                  Générez le fichier de licence avec l’outil d’émission sécurisé, puis collez son contenu JSON ici. Le serveur vérifie la signature et l’identifiant de cette école.
                </p>
                <textarea
                  id="signed-license"
                  value={licenseText}
                  onChange={(event) => setLicenseText(event.target.value)}
                  rows={5}
                  spellCheck={false}
                  placeholder={'{\n  "payload": { ... },\n  "signature": "..."\n}'}
                  disabled={isInstalling || status?.state === 'unconfigured'}
                  className="w-full resize-y rounded-xl border border-slate-300 bg-slate-50 p-3 font-mono text-xs text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:opacity-60"
                />
              </div>
              {error && (
                <div role="alert" className="flex gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="flex items-center gap-1.5 text-xs text-slate-500">
                  <CalendarClock className="h-4 w-4" />
                  Le renouvellement est journalisé côté serveur.
                </p>
                <MidnightButton type="submit" size="sm" disabled={isInstalling || !licenseText.trim() || status?.state === 'unconfigured'}>
                  <Upload className="mr-1.5 inline h-4 w-4" />
                  {isInstalling ? 'Vérification...' : 'Installer la licence'}
                </MidnightButton>
              </div>
            </form>
          ) : (
            <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              Seul l’administrateur de l’école peut installer ou renouveler la licence.
            </p>
          )}

          {isAdmin && status?.renewals && status.renewals.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-bold text-slate-900">Historique des licences</h3>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Date</th>
                      <th className="px-3 py-2 font-semibold">Plan</th>
                      <th className="px-3 py-2 font-semibold">Expiration</th>
                      <th className="px-3 py-2 font-semibold">Administrateur</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {status.renewals.map((renewal) => (
                      <tr key={renewal.id}>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-700">{formatDate(renewal.createdAt)}</td>
                        <td className="px-3 py-2 font-medium text-slate-800">{renewal.plan === 'annual' ? 'Annuel' : 'Mensuel'}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-700">{formatDate(renewal.expiresAt)}</td>
                        <td className="px-3 py-2 text-slate-600">{renewal.actorEmail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {blocked && (
            <div className="flex justify-end border-t border-slate-100 pt-4">
              <MidnightButton type="button" variant="secondary" size="sm" onClick={onLogout}>
                <LogOut className="mr-1.5 inline h-4 w-4" />
                Se déconnecter
              </MidnightButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
