import React, { useState } from 'react';
import { MidnightButton } from './MidnightButton';
import { Terminal, Download, Copy, Check, FileCode, Play } from 'lucide-react';

interface PythonCodeViewerProps {
  pythonCode: string;
}

export const PythonCodeViewer: React.FC<PythonCodeViewerProps> = ({ pythonCode }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(pythonCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPy = () => {
    const blob = new Blob([pythonCode], { type: 'text/x-python;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tic_tig.py';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadReq = () => {
    const reqContent = `pandas>=2.0.0\nopenpyxl>=3.1.0\npython-docx>=1.1.0\nreportlab>=4.0.0\n`;
    const blob = new Blob([reqContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'requirements.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner with Quick Actions */}
      <div className="bg-slate-900 text-white rounded-xl p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sky-500/20 border border-sky-400/30 flex items-center justify-center shrink-0">
            <FileCode className="w-6 h-6 text-sky-400" />
          </div>
          <div>
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              Code Source Python Desktop (Tkinter 980x683)
              <span className="text-[10px] bg-sky-500/30 text-sky-300 font-mono px-2 py-0.5 rounded-full border border-sky-400/40">
                tic_tig.py
              </span>
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Code complet, modulaire et directement exécutable avec Tkinter, pandas, openpyxl, python-docx et reportlab.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copié !' : 'Copier le Code'}
          </button>
          <button
            onClick={handleDownloadReq}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-sky-400" />
            requirements.txt
          </button>
          <MidnightButton
            size="sm"
            onClick={handleDownloadPy}
            icon={<Download className="w-3.5 h-3.5" />}
          >
            Télécharger tic_tig.py
          </MidnightButton>
        </div>
      </div>

      {/* Terminal Instructions */}
      <div className="bg-slate-950 text-slate-200 rounded-xl p-4 font-mono text-xs border border-slate-800 space-y-2">
        <div className="flex items-center gap-2 text-slate-400 border-b border-slate-800 pb-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold text-slate-300">Instructions d'exécution sur votre PC / Mac :</span>
        </div>
        <div className="space-y-1.5 text-slate-300">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 font-bold">1.</span>
            <span>Installer les bibliothèques requises :</span>
            <code className="bg-slate-800 px-2 py-0.5 rounded text-sky-300">pip install -r requirements.txt</code>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 font-bold">2.</span>
            <span>Lancer l'application graphique bureau (980x683 px) :</span>
            <code className="bg-slate-800 px-2 py-0.5 rounded text-emerald-300">python tic_tig.py</code>
          </div>
        </div>
      </div>

      {/* Code Display */}
      <div className="relative rounded-xl border border-slate-300 bg-slate-900 text-slate-100 overflow-hidden shadow-sm">
        <div className="bg-slate-950/80 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span className="font-mono">tic_tig.py • Python 3 (Tkinter GUI 980x683)</span>
          <span>{pythonCode.split('\n').length} lignes</span>
        </div>
        <pre className="p-4 text-xs font-mono overflow-x-auto max-h-[500px] leading-relaxed text-slate-200 selection:bg-sky-500 selection:text-white">
          <code>{pythonCode}</code>
        </pre>
      </div>
    </div>
  );
};
