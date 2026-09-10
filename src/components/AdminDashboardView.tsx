import React, { useEffect, useState } from 'react';
import { Users, GraduationCap, School, BookOpen, Award, TrendingUp, RefreshCw, BarChart2, ShieldCheck, ChevronRight } from 'lucide-react';
import { api } from '../services/api';

interface AdminDashboardProps {
  selectedTerm: string;
  onSelectClass?: (className: string) => void;
}

export const AdminDashboardView: React.FC<AdminDashboardProps> = ({ selectedTerm, onSelectClass }) => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await api.getDashboardStats(selectedTerm);
      setStats(data);
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [selectedTerm]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin text-sky-500 mb-3" />
        <p className="text-sm font-semibold">Calcul des indicateurs académiques en cours...</p>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6 pb-6">
      {/* 1. Bandeau de synthèse */}
      <div className="bg-gradient-to-r from-[#0C1E36] via-[#1E3A5F] to-[#152F52] text-white p-6 rounded-2xl shadow-xl border border-sky-900/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-64 h-64 bg-sky-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-sky-400/20 text-sky-300 border border-sky-400/30">
                {stats.establishmentName || 'CEMINACE'}
              </span>
              <span className="text-xs text-slate-300">• {stats.city}</span>
            </div>
            <h2 className="text-2xl font-black text-white">Tableau de Bord Institutionnel</h2>
            <p className="text-xs text-slate-300 mt-1">
              Suivi des effectifs, des évaluations pédagogiques et de la performance globale pour le <strong className="text-sky-300">{selectedTerm}</strong>.
            </p>
          </div>
          <button
            onClick={loadStats}
            className="self-start md:self-auto flex items-center gap-2 px-3.5 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-bold text-white transition-all cursor-pointer active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Actualiser</span>
          </button>
        </div>
      </div>

      {/* 2. Cartes KPI Principaux */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Total Élèves</span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900">{stats.totalStudents}</div>
            <p className="text-[10px] text-emerald-600 font-bold mt-0.5">Inscrits actifs</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Enseignants</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900">{stats.totalTeachers}</div>
            <p className="text-[10px] text-indigo-600 font-bold mt-0.5">Corps professoral</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Classes Actives</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <School className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900">{stats.totalClasses}</div>
            <p className="text-[10px] text-amber-600 font-bold mt-0.5">Primaire & Secondaire</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Matières</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900">{stats.totalSubjects}</div>
            <p className="text-[10px] text-purple-600 font-bold mt-0.5">Avec coefficients</p>
          </div>
        </div>

        <div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-emerald-500 to-teal-700 text-white p-4 rounded-xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-100">Moyenne Globale</span>
            <div className="w-8 h-8 rounded-lg bg-white/20 text-white flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-white">{stats.globalAvg.toFixed(2)}<span className="text-sm font-normal text-emerald-200">/20</span></div>
            <p className="text-[10px] text-emerald-100 font-bold mt-0.5">Établissement</p>
          </div>
        </div>
      </div>

      {/* 3. Tableau de performance par Classe */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-sky-600" />
            <h3 className="font-black text-slate-900 text-sm">Performance par Classe ({stats.classes?.length || 0})</h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">Formule CEMINACE CC (1/3) + Composition (2/3)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <th className="py-2.5 px-4">Classe</th>
                <th className="py-2.5 px-3">Cycle / Niveau</th>
                <th className="py-2.5 px-3 text-center">Effectif</th>
                <th className="py-2.5 px-3 text-center">Moyenne Classe</th>
                <th className="py-2.5 px-3">Major de Promotion</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.classes?.map((c: any) => {
                const isPassing = c.classAvg >= 10;
                return (
                  <tr key={c.classId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{c.className}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                        {c.niveau}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-700">{c.studentCount}</td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-md font-black text-xs ${
                          isPassing ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {c.classAvg.toFixed(2)}/20
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-700 font-medium">
                      {c.bestStudent || '-'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {onSelectClass && (
                        <button
                          onClick={() => onSelectClass(c.className)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-600 hover:text-sky-800 hover:underline cursor-pointer"
                        >
                          <span>Accéder</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
