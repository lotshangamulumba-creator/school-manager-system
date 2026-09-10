import React, { useState, useEffect } from 'react';
import { X, Download, Upload, ShieldCheck, History, AlertTriangle, Check, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

interface AuditBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataRestored?: () => void;
}

export const AuditBackupModal: React.FC<AuditBackupModalProps> = ({ isOpen, onClose, onDataRestored }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getAuditLogs();
      setLogs(data);
    } catch (err: any) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAuditLogs();
      setMessage(null);
    }
  }, [isOpen]);

  const handleDownloadBackup = () => {
    const token = api.getToken();
    const url = `/api/backup/export`;
    // Création d'un lien de téléchargement direct avec en-tête d'authentification
    fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then(res => res.blob())
      .then(blob => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `ceminace_sauvegarde_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setMessage({ text: 'Sauvegarde téléchargée avec succès.', type: 'success' });
      })
      .catch(err => {
        setMessage({ text: 'Erreur lors du téléchargement de la sauvegarde.', type: 'error' });
      });
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setRestoring(true);
        const parsed = JSON.parse(event.target?.result as string);
        const res = await api.restoreBackup(parsed);
        setMessage({ text: res.message || 'Restauration effectuée avec succès !', type: 'success' });
        loadAuditLogs();
        if (onDataRestored) onDataRestored();
      } catch (err: any) {
        setMessage({ text: err.message || 'Fichier de sauvegarde invalide.', type: 'error' });
      } finally {
        setRestoring(false);
      }
    };
    reader.readAsText(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#0C1E36] to-[#1E3A5F] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-sky-300" />
            </div>
            <div>
              <h2 className="text-base font-black">Sauvegardes & Journalisation d'Audit</h2>
              <p className="text-xs text-sky-200">Sécurité des données scolaires et traçabilité des opérations</p>
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
          {message && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                message.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                  : 'bg-rose-50 border border-rose-200 text-rose-700'
              }`}
            >
              {message.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              <span>{message.text}</span>
            </div>
          )}

          {/* Section Sauvegarde / Restauration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between space-y-3">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-sky-600" />
                  <span>Exporter une Sauvegarde</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Téléchargez une archive JSON complète contenant tous les élèves, classes, matières, notes et utilisateurs.
                </p>
              </div>
              <button
                onClick={handleDownloadBackup}
                className="w-full py-2.5 px-3 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Télécharger la Sauvegarde (.json)</span>
              </button>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between space-y-3">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-amber-600" />
                  <span>Restaurer une Base de Données</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Chargez une sauvegarde antérieure pour réinjecter les données scolaires en cas d'incident.
                </p>
              </div>
              <label className="w-full py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2">
                <Upload className="w-4 h-4" />
                <span>{restoring ? 'Restauration en cours...' : 'Sélectionner un fichier JSON'}</span>
                <input
                  type="file"
                  accept=".json"
                  disabled={restoring}
                  onChange={handleRestoreFile}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Section Journal d'Audit */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <History className="w-4 h-4 text-slate-500" />
                <span>Journal d'Audit des Opérations ({logs.length})</span>
              </h3>
              <button
                onClick={loadAuditLogs}
                className="text-[11px] text-sky-600 hover:text-sky-800 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Rafraîchir</span>
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
              {logs.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">Aucun journal d'audit enregistré.</div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 sticky top-0">
                      <th className="py-2 px-3">Date / Heure</th>
                      <th className="py-2 px-3">Action</th>
                      <th className="py-2 px-3">Détails</th>
                      <th className="py-2 px-3">Utilisateur</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 text-slate-500 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString('fr-FR')}
                        </td>
                        <td className="py-2 px-3 font-bold text-sky-700 whitespace-nowrap">
                          {log.action}
                        </td>
                        <td className="py-2 px-3 text-slate-700 max-w-xs truncate">
                          {log.details || '-'}
                        </td>
                        <td className="py-2 px-3 text-slate-500 whitespace-nowrap">
                          {log.userEmail || 'Système'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
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
