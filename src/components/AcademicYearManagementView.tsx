import React, { useEffect, useState } from 'react';
import { AlertCircle, CalendarDays, Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { ApiAcademicYear, api } from '../services/api';
import { MidnightButton } from './MidnightButton';

interface AcademicYearManagementViewProps {
  onClose: () => void;
  onChanged: () => Promise<void>;
}

const EMPTY_YEAR = { label: '', startDate: '', endDate: '' };
const YEAR_STATUS_CLASSES: Record<ApiAcademicYear['status'], string> = {
  active: 'bg-emerald-100 text-emerald-800',
  closed: 'bg-slate-200 text-slate-700',
  draft: 'bg-amber-100 text-amber-950',
};

export const AcademicYearManagementView: React.FC<AcademicYearManagementViewProps> = ({ onClose, onChanged }) => {
  const [years, setYears] = useState<ApiAcademicYear[]>([]);
  const [draft, setDraft] = useState(EMPTY_YEAR);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setYears(await api.getAcademicYears());
  };

  useEffect(() => {
    load().catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Chargement impossible.'));
  }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (editingId) await api.updateAcademicYear(editingId, draft);
      else await api.createAcademicYear(draft);
      setDraft(EMPTY_YEAR);
      setEditingId(null);
      await load();
      await onChanged();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
      await onChanged();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Opération impossible.');
    } finally {
      setBusy(false);
    }
  };

  const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900';

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm sm:p-6">
      <section role="dialog" aria-modal="true" aria-labelledby="academic-years-title" className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between bg-slate-950 px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <CalendarDays className="h-5 w-5 text-sky-300" />
            <div>
              <h2 id="academic-years-title" className="font-bold">Années scolaires</h2>
              <p className="text-xs text-slate-300">Une seule année active; les années clôturées sont en lecture seule.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <div className="space-y-2">
            {years.map((year) => (
              <div key={year.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                <div>
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    {year.label}
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${YEAR_STATUS_CLASSES[year.status]}`}>{year.status === 'draft' ? 'Brouillon' : year.status === 'active' ? 'Active' : 'Clôturée'}</span>
                  </div>
                  <p className="text-xs text-slate-500">{year.startDate} – {year.endDate}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {year.status === 'draft' && (
                    <button type="button" disabled={busy} onClick={() => runAction(() => api.activateAcademicYear(year.id))} className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50">
                      <Check className="h-3.5 w-3.5" /> Activer
                    </button>
                  )}
                  {year.status !== 'closed' && (
                    <button type="button" disabled={busy} onClick={() => runAction(() => api.closeAcademicYear(year.id))} className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50">
                      Clôturer
                    </button>
                  )}
                  {year.status !== 'closed' && (
                    <button type="button" disabled={busy} onClick={() => {
                      setEditingId(year.id);
                      setDraft({ label: year.label, startDate: year.startDate, endDate: year.endDate });
                    }} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-50" aria-label={`Modifier ${year.label}`}>
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  <button type="button" disabled={busy} onClick={() => {
                    if (window.confirm(`Supprimer l’année scolaire ${year.label} ?`)) {
                      runAction(() => api.deleteAcademicYear(year.id));
                    }
                  }} className="rounded-lg p-1.5 text-rose-700 hover:bg-rose-50 disabled:opacity-50" aria-label={`Supprimer ${year.label}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            {years.length === 0 && <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Aucune année scolaire définie.</p>}
          </div>

          <form onSubmit={save} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Plus className="h-4 w-4" /> {editingId ? 'Modifier l’année' : 'Créer une année brouillon'}
            </h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="sm:col-span-1">
                <span className="mb-1 block text-xs font-medium text-slate-600">Libellé</span>
                <input required maxLength={80} className={inputClass} value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} />
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-slate-600">Date de début</span>
                <input required type="date" className={inputClass} value={draft.startDate} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} />
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-slate-600">Date de fin</span>
                <input required type="date" className={inputClass} value={draft.endDate} onChange={(event) => setDraft({ ...draft, endDate: event.target.value })} />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              {editingId && <MidnightButton type="button" size="sm" variant="secondary" onClick={() => { setEditingId(null); setDraft(EMPTY_YEAR); }}>Annuler</MidnightButton>}
              <MidnightButton type="submit" size="sm" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</MidnightButton>
            </div>
          </form>

          {error && <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
        </div>
      </section>
    </div>
  );
};
