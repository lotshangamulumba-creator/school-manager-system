import React, { useEffect, useState } from 'react';
import { AlertCircle, ImagePlus, Save, Trash2, X } from 'lucide-react';
import { SchoolProfile } from '../types';
import { MidnightButton } from './MidnightButton';

interface SchoolSettingsModalProps {
  isOpen: boolean;
  profile: SchoolProfile;
  onClose: () => void;
  onSave: (profile: SchoolProfile) => Promise<void>;
}

const MAX_LOGO_BYTES = 1024 * 1024;
const ACCEPTED_LOGO_TYPES = ['image/png', 'image/jpeg'];

export const SchoolSettingsModal: React.FC<SchoolSettingsModalProps> = ({
  isOpen,
  profile,
  onClose,
  onSave,
}) => {
  const [draft, setDraft] = useState(profile);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDraft(profile);
      setError(null);
    }
  }, [isOpen, profile]);

  if (!isOpen) return null;

  const updateField = <K extends keyof SchoolProfile>(key: K, value: SchoolProfile[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!ACCEPTED_LOGO_TYPES.includes(file.type)) {
      setError('Choisissez un logo au format PNG ou JPEG.');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError('Le logo doit peser 1 Mo maximum.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        updateField('logoDataUrl', reader.result);
        setError(null);
      }
    };
    reader.onerror = () => setError('Impossible de lire ce fichier image.');
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      await onSave(draft);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Le profil n’a pas pu être enregistré.');
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:opacity-60';
  const labelClass = 'mb-1 block text-xs font-semibold text-slate-700';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="school-settings-title"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 bg-slate-950 px-5 py-4 text-white sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-white/10">
              {draft.logoDataUrl
                ? <img src={draft.logoDataUrl} alt="" className="h-full w-full object-contain p-1" />
                : <ImagePlus className="h-5 w-5 text-slate-300" />}
            </div>
            <div className="min-w-0">
              <h2 id="school-settings-title" className="text-lg font-bold">Profil de l’établissement</h2>
              <p className="mt-0.5 truncate text-xs text-slate-300">Identité visuelle, coordonnées et informations des bulletins</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Fermer les paramètres de l’établissement"
            className="rounded-lg p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-6 overflow-y-auto p-5 sm:p-7">
            <section aria-labelledby="school-identity-heading">
              <h3 id="school-identity-heading" className="mb-3 text-sm font-bold text-slate-900">Identité de l’école</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className={labelClass}>Nom de l’établissement *</span>
                  <input required maxLength={160} className={inputClass} value={draft.schoolName} onChange={(e) => updateField('schoolName', e.target.value)} disabled={isSaving} />
                </label>
                <label>
                  <span className={labelClass}>Ville / région *</span>
                  <input required maxLength={160} className={inputClass} value={draft.city} onChange={(e) => updateField('city', e.target.value)} disabled={isSaving} />
                </label>
                <label>
                  <span className={labelClass}>Adresse</span>
                  <input maxLength={240} className={inputClass} value={draft.address} onChange={(e) => updateField('address', e.target.value)} disabled={isSaving} />
                </label>
                <label>
                  <span className={labelClass}>Téléphone</span>
                  <input type="tel" maxLength={60} className={inputClass} value={draft.phone} onChange={(e) => updateField('phone', e.target.value)} disabled={isSaving} />
                </label>
                <label>
                  <span className={labelClass}>Adresse e-mail</span>
                  <input type="email" maxLength={160} className={inputClass} value={draft.email} onChange={(e) => updateField('email', e.target.value)} disabled={isSaving} />
                </label>
                <label className="sm:col-span-2">
                  <span className={labelClass}>Devise / slogan de l’établissement</span>
                  <input maxLength={160} className={inputClass} value={draft.motto} onChange={(e) => updateField('motto', e.target.value)} disabled={isSaving} />
                </label>
              </div>
            </section>

            <section aria-labelledby="school-logo-heading">
              <h3 id="school-logo-heading" className="mb-3 text-sm font-bold text-slate-900">Logo</h3>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-16 w-24 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-2">
                  {draft.logoDataUrl
                    ? <img src={draft.logoDataUrl} alt={`Logo de ${draft.schoolName || 'l’établissement'}`} className="max-h-full max-w-full object-contain" />
                    : <span className="text-xs text-slate-500">Aucun logo</span>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 ${isSaving ? 'pointer-events-none opacity-50' : ''}`}>
                    <ImagePlus className="h-4 w-4" />
                    Choisir une image
                    <input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={handleLogoChange} disabled={isSaving} />
                  </label>
                  {draft.logoDataUrl && (
                    <button type="button" onClick={() => updateField('logoDataUrl', null)} disabled={isSaving} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">
                      <Trash2 className="h-4 w-4" />
                      Retirer
                    </button>
                  )}
                  <span className="w-full text-[11px] text-slate-500">PNG ou JPEG · 1 Mo maximum</span>
                </div>
              </div>
            </section>

            <section aria-labelledby="school-colors-heading">
              <h3 id="school-colors-heading" className="mb-3 text-sm font-bold text-slate-900">Couleurs de l’interface et des bulletins</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                {([
                  ['primaryColor', 'Couleur principale'],
                  ['secondaryColor', 'Couleur secondaire'],
                  ['accentColor', 'Couleur d’accentuation'],
                ] as const).map(([field, label]) => (
                  <label key={field}>
                    <span className={labelClass}>{label}</span>
                    <span className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white p-2">
                      <input type="color" aria-label={label} value={draft[field]} onChange={(e) => updateField(field, e.target.value.toUpperCase())} disabled={isSaving} className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0" />
                      <span className="font-mono text-xs font-semibold text-slate-700">{draft[field]}</span>
                    </span>
                  </label>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <span className="h-7 w-7 rounded-md" style={{ backgroundColor: draft.primaryColor }} />
                <span className="h-7 w-7 rounded-md" style={{ backgroundColor: draft.secondaryColor }} />
                <span className="h-7 w-7 rounded-md" style={{ backgroundColor: draft.accentColor }} />
                <span className="ml-1 text-xs text-slate-600">Aperçu de la palette</span>
              </div>
            </section>

            <section aria-labelledby="school-signatories-heading">
              <h3 id="school-signatories-heading" className="mb-3 text-sm font-bold text-slate-900">Informations du bulletin</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className={labelClass}>Nom du chef d’établissement</span>
                  <input maxLength={120} className={inputClass} value={draft.principalName} onChange={(e) => updateField('principalName', e.target.value)} disabled={isSaving} />
                </label>
                <label>
                  <span className={labelClass}>Nom du directeur des études</span>
                  <input maxLength={120} className={inputClass} value={draft.directorOfStudiesName} onChange={(e) => updateField('directorOfStudiesName', e.target.value)} disabled={isSaving} />
                </label>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">Le nom, les coordonnées, le logo, la devise et les signataires sont repris sur les bulletins générés.</p>
            </section>

            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <footer className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 sm:px-7">
            <MidnightButton type="button" variant="secondary" size="sm" onClick={onClose} disabled={isSaving}>Annuler</MidnightButton>
            <MidnightButton type="submit" size="sm" disabled={isSaving}>
              <Save className="mr-1.5 inline h-4 w-4" />
              {isSaving ? 'Enregistrement...' : 'Enregistrer le profil'}
            </MidnightButton>
          </footer>
        </form>
      </section>
    </div>
  );
};
