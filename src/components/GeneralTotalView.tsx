import React, { useState } from 'react';
import { EstablishmentSpecialtyStat, SchoolLevel } from '../types';
import { MidnightButton } from './MidnightButton';
import {
  Trophy,
  Award,
  BookOpen,
  FlaskConical,
  Activity,
  Layers,
  School,
  Download,
  Filter,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface GeneralTotalViewProps {
  stats: EstablishmentSpecialtyStat;
  trimester: string;
  onCycleTrimester: () => void;
  isFrench: boolean;
}

export const GeneralTotalView: React.FC<GeneralTotalViewProps> = ({
  stats,
  trimester,
  onCycleTrimester,
  isFrench,
}) => {
  const [selectedLevelFilter, setSelectedLevelFilter] = useState<'ALL' | SchoolLevel>('ALL');

  const filteredLevels =
    selectedLevelFilter === 'ALL'
      ? stats.levels
      : stats.levels.filter((l) => l.level === selectedLevelFilter);

  // Identify top classes per specialty across the whole school
  const allClasses = stats.levels.flatMap((l) => l.classes);
  const bestSciClass = [...allClasses].sort((a, b) => b.sciencesAvg - a.sciencesAvg)[0];
  const bestLitClass = [...allClasses].sort((a, b) => b.literatureAvg - a.literatureAvg)[0];
  const bestEpsClass = [...allClasses].sort((a, b) => b.epsAvg - a.epsAvg)[0];
  const bestOverallClass = [...allClasses].sort((a, b) => b.generalAvg - a.generalAvg)[0];

  const handleExportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Watermark
    doc.saveGraphicsState();
    doc.setTextColor(235, 240, 248);
    doc.setFontSize(45);
    doc.setFont('helvetica', 'bold');
    doc.text('MonPilot - CEMINACE', pageWidth / 2, 110, { align: 'center', angle: 25 });
    doc.restoreGraphicsState();

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(30, 58, 95);
    doc.text('COMPLEXE SCOLAIRE PRIVÉ CEMINACE - BRAZZAVILLE', 14, 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('RÉPUBLIQUE DU CONGO • MINISTÈRE DE L’ENSEIGNEMENT', 14, 20);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(
      `TABLEAU GÉNÉRAL RÉCAPITULATIF DES MOYENNES PAR SPÉCIALITÉ - ${trimester.toUpperCase()}`,
      pageWidth / 2,
      28,
      { align: 'center' }
    );

    const tableRows: (string | number)[][] = [];

    stats.levels.forEach((lvl) => {
      lvl.classes.forEach((cls) => {
        tableRows.push([
          cls.level,
          cls.className,
          cls.studentCount,
          cls.sciencesAvg.toFixed(2),
          cls.literatureAvg.toFixed(2),
          cls.epsAvg.toFixed(2),
          cls.generalAvg.toFixed(2),
          `${cls.bestStudentName} (${cls.bestStudentAvg.toFixed(2)})`,
        ]);
      });

      // Level total row
      tableRows.push([
        `TOTAL / MOYENNE ${lvl.level.toUpperCase()}`,
        `${lvl.classesCount} Classes`,
        lvl.totalStudents,
        lvl.sciencesAvg.toFixed(2),
        lvl.literatureAvg.toFixed(2),
        lvl.epsAvg.toFixed(2),
        lvl.generalAvg.toFixed(2),
        `Bilan ${lvl.level}`,
      ]);
    });

    // Grand total row
    tableRows.push([
      'GRAND TOTAL GÉNÉRAL ÉTABLISSEMENT',
      `${stats.totalClasses} Classes`,
      stats.totalStudents,
      stats.sciencesAvg.toFixed(2),
      stats.literatureAvg.toFixed(2),
      stats.epsAvg.toFixed(2),
      stats.generalAvg.toFixed(2),
      'Moyenne Établissement',
    ]);

    autoTable(doc, {
      startY: 33,
      head: [
        [
          'Cycle / Niveau',
          'Classe',
          'Effectif',
          'Moy. Sciences /20',
          'Moy. Littérature /20',
          'Moy. EPS /20',
          'Moyenne Générale /20',
          'Major de la Classe',
        ],
      ],
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 58, 95],
        textColor: 255,
        fontSize: 8.5,
        halign: 'center',
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 35 },
        1: { fontStyle: 'bold', cellWidth: 25 },
        2: { halign: 'center', cellWidth: 18 },
        3: { halign: 'center', cellWidth: 28 },
        4: { halign: 'center', cellWidth: 30 },
        5: { halign: 'center', cellWidth: 22 },
        6: { halign: 'center', fontStyle: 'bold', cellWidth: 32 },
        7: { cellWidth: 'auto' },
      },
      didParseCell: (data) => {
        const raw0 = String(data.row.raw[0] || '');
        if (raw0.includes('GRAND TOTAL')) {
          data.cell.styles.fillColor = [30, 58, 95];
          data.cell.styles.textColor = [255, 255, 255];
          data.cell.styles.fontStyle = 'bold';
        } else if (raw0.includes('TOTAL / MOYENNE')) {
          data.cell.styles.fillColor = [224, 235, 250];
          data.cell.styles.textColor = [30, 58, 95];
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });

    doc.save(`CEMINACE_Total_General_Specialites_${trimester.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#1E3A5F]" />
            <h2 className="text-base md:text-lg font-bold text-slate-800">
              {isFrench
                ? 'Total Général & Moyennes par Spécialité'
                : 'General Total & Specialty Averages'}
            </h2>
            <span className="bg-[#1E3A5F] text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full">
              {trimester}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isFrench
              ? 'Synthèse complète des moyennes par spécialité (Sciences, Littérature, EPS) pour chaque classe de chaque cycle'
              : 'Complete summary of specialty averages (Sciences, Literature, PE) for each class across all school levels'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Trimester switch action button */}
          <button
            onClick={onCycleTrimester}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-xs rounded-lg shadow-xs transition-all cursor-pointer"
            title="Basculer vers le trimestre suivant"
          >
            <span>🔄</span>
            <span>{isFrench ? 'Basculer Trimestre' : 'Switch Trimester'}</span>
          </button>

          {/* Export PDF Button */}
          <MidnightButton onClick={handleExportPdf} size="sm">
            <Download className="w-4 h-4 mr-1.5 inline" />
            {isFrench ? 'Exporter Bilan PDF' : 'Export Summary PDF'}
          </MidnightButton>
        </div>
      </div>

      {/* Top Highlights Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. Grand Total Établissement */}
        <div className="bg-[#1E3A5F] text-white rounded-xl p-4 shadow-sm border border-slate-700">
          <div className="flex items-center justify-between text-sky-300 text-xs font-semibold mb-2">
            <span className="flex items-center gap-1.5">
              <School className="w-4 h-4" />
              CEMINACE Global
            </span>
            <span className="text-[11px] bg-sky-900/80 px-2 py-0.5 rounded">
              {stats.totalStudents} élèves
            </span>
          </div>
          <div className="text-2xl font-black">{stats.generalAvg.toFixed(2)} / 20</div>
          <div className="text-[11px] text-sky-200 mt-1 flex justify-between">
            <span>{stats.totalClasses} classes actives</span>
            <span>Moyenne Générale</span>
          </div>
        </div>

        {/* 2. Meilleure Classe Sciences */}
        <div className="bg-white rounded-xl p-4 shadow-xs border border-slate-200">
          <div className="flex items-center justify-between text-indigo-700 text-xs font-semibold mb-2">
            <span className="flex items-center gap-1.5">
              <FlaskConical className="w-4 h-4" />
              Major Sciences 🔬
            </span>
            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-bold">
              {bestSciClass ? bestSciClass.className : '-'}
            </span>
          </div>
          <div className="text-xl font-extrabold text-slate-800">
            {bestSciClass ? `${bestSciClass.sciencesAvg.toFixed(2)} / 20` : '-'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex justify-between">
            <span>Niveau {bestSciClass?.level}</span>
            <span className="text-indigo-600 font-semibold">Moy. Établ. : {stats.sciencesAvg.toFixed(2)}</span>
          </div>
        </div>

        {/* 3. Meilleure Classe Littérature */}
        <div className="bg-white rounded-xl p-4 shadow-xs border border-slate-200">
          <div className="flex items-center justify-between text-amber-700 text-xs font-semibold mb-2">
            <span className="flex items-center gap-1.5">
              <BookOpen className="w-4 h-4" />
              Major Littérature 📚
            </span>
            <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-bold">
              {bestLitClass ? bestLitClass.className : '-'}
            </span>
          </div>
          <div className="text-xl font-extrabold text-slate-800">
            {bestLitClass ? `${bestLitClass.literatureAvg.toFixed(2)} / 20` : '-'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex justify-between">
            <span>Niveau {bestLitClass?.level}</span>
            <span className="text-amber-600 font-semibold">Moy. Établ. : {stats.literatureAvg.toFixed(2)}</span>
          </div>
        </div>

        {/* 4. Meilleure Classe EPS */}
        <div className="bg-white rounded-xl p-4 shadow-xs border border-slate-200">
          <div className="flex items-center justify-between text-emerald-700 text-xs font-semibold mb-2">
            <span className="flex items-center gap-1.5">
              <Activity className="w-4 h-4" />
              Major EPS 🏃‍♂️
            </span>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold">
              {bestEpsClass ? bestEpsClass.className : '-'}
            </span>
          </div>
          <div className="text-xl font-extrabold text-slate-800">
            {bestEpsClass ? `${bestEpsClass.epsAvg.toFixed(2)} / 20` : '-'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex justify-between">
            <span>Niveau {bestEpsClass?.level}</span>
            <span className="text-emerald-600 font-semibold">Moy. Établ. : {stats.epsAvg.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <Filter className="w-4 h-4 text-slate-400 mr-1" />
        <span className="text-xs font-semibold text-slate-600">Filtrer par Cycle :</span>
        {(['ALL', 'Primaire', 'Collège', 'Lycée'] as const).map((lvl) => (
          <button
            key={lvl}
            onClick={() => setSelectedLevelFilter(lvl)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              selectedLevelFilter === lvl
                ? 'bg-[#1E3A5F] text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            {lvl === 'ALL' ? (isFrench ? 'Tous les Cycles' : 'All Levels') : lvl}
          </button>
        ))}
      </div>

      {/* Main Tables by Level */}
      <div className="space-y-6">
        {filteredLevels.map((lvlStat) => (
          <div
            key={lvlStat.level}
            className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden"
          >
            {/* Level Section Header */}
            <div className="bg-slate-100/90 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#1E3A5F]"></span>
                <h3 className="font-bold text-sm text-slate-800">
                  {isFrench ? `Cycle : ${lvlStat.level}` : `Level: ${lvlStat.level}`}
                </h3>
                <span className="text-xs text-slate-500">
                  ({lvlStat.classesCount} classes • {lvlStat.totalStudents} élèves inscrits)
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <span className="text-indigo-700 font-medium">
                  Sciences : <b>{lvlStat.sciencesAvg.toFixed(2)}</b>
                </span>
                <span className="text-amber-700 font-medium">
                  Littérature : <b>{lvlStat.literatureAvg.toFixed(2)}</b>
                </span>
                <span className="text-emerald-700 font-medium">
                  EPS : <b>{lvlStat.epsAvg.toFixed(2)}</b>
                </span>
                <span className="bg-[#1E3A5F] text-white px-2 py-0.5 rounded font-bold">
                  Moy. Cycle : {lvlStat.generalAvg.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Classes Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Classe</th>
                    <th className="py-2.5 px-3 text-center">Effectif</th>
                    <th className="py-2.5 px-3 text-center text-indigo-700">Moy. Sciences /20</th>
                    <th className="py-2.5 px-3 text-center text-amber-700">Moy. Littérature /20</th>
                    <th className="py-2.5 px-3 text-center text-emerald-700">Moy. EPS /20</th>
                    <th className="py-2.5 px-3 text-center font-bold text-slate-800">
                      Moyenne Générale /20
                    </th>
                    <th className="py-2.5 px-4">Major de la Classe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lvlStat.classes.map((cls) => (
                    <tr key={cls.className} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-4 font-bold text-[#1E3A5F]">{cls.className}</td>
                      <td className="py-2.5 px-3 text-center text-slate-600">{cls.studentCount}</td>
                      <td className="py-2.5 px-3 text-center font-semibold text-indigo-900 bg-indigo-50/20">
                        {cls.sciencesAvg.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-center font-semibold text-amber-900 bg-amber-50/20">
                        {cls.literatureAvg.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-center font-semibold text-emerald-900 bg-emerald-50/20">
                        {cls.epsAvg.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded ${
                            cls.generalAvg >= 14
                              ? 'bg-emerald-100 text-emerald-800'
                              : cls.generalAvg >= 10
                              ? 'bg-sky-100 text-sky-900'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {cls.generalAvg.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-700">
                        <div className="font-semibold text-slate-900">{cls.bestStudentName}</div>
                        <div className="text-[10px] text-amber-600 font-bold">
                          Moy. : {cls.bestStudentAvg.toFixed(2)} / 20
                        </div>
                      </td>
                    </tr>
                  ))}

                  {/* Level Summary Row */}
                  <tr className="bg-sky-50/60 font-bold border-t-2 border-slate-200">
                    <td className="py-3 px-4 text-[#1E3A5F]">
                      TOTAL / MOYENNE {lvlStat.level.toUpperCase()}
                    </td>
                    <td className="py-3 px-3 text-center text-slate-800">{lvlStat.totalStudents}</td>
                    <td className="py-3 px-3 text-center text-indigo-950">
                      {lvlStat.sciencesAvg.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-center text-amber-950">
                      {lvlStat.literatureAvg.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-center text-emerald-950">
                      {lvlStat.epsAvg.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-center text-[#1E3A5F] text-sm">
                      {lvlStat.generalAvg.toFixed(2)} / 20
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                      Moyenne générale pondérée du cycle
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {/* GRAND TOTAL GÉNÉRAL ÉTABLISSEMENT CEMINACE */}
        <div className="bg-[#1E3A5F] text-white rounded-xl p-5 shadow-lg border border-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-600/60 pb-4 mb-4">
            <div>
              <h3 className="text-base md:text-lg font-black tracking-wide text-sky-200">
                {isFrench
                  ? 'GRAND TOTAL GÉNÉRAL • COMPLEXE SCOLAIRE PRIVÉ CEMINACE'
                  : 'GRAND GENERAL TOTAL • CEMINACE PRIVATE SCHOOL COMPLEX'}
              </h3>
              <p className="text-xs text-sky-100">
                Consolidation globale de tous les niveaux scolaires (Primaire, Collège, Lycée) pour le{' '}
                {trimester}
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-sky-300">Effectif Global Établissement</div>
              <div className="text-xl font-black">
                {stats.totalStudents} Élèves • {stats.totalClasses} Classes
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3">
              <span className="text-xs text-sky-300 block mb-1">Moyenne Sciences</span>
              <span className="text-lg font-bold text-white">{stats.sciencesAvg.toFixed(2)} / 20</span>
            </div>

            <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3">
              <span className="text-xs text-amber-300 block mb-1">Moyenne Littérature</span>
              <span className="text-lg font-bold text-white">{stats.literatureAvg.toFixed(2)} / 20</span>
            </div>

            <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3">
              <span className="text-xs text-emerald-300 block mb-1">Moyenne EPS</span>
              <span className="text-lg font-bold text-white">{stats.epsAvg.toFixed(2)} / 20</span>
            </div>

            <div className="bg-amber-400 text-slate-900 rounded-lg p-3 shadow-md">
              <span className="text-xs font-bold block mb-1 text-slate-900 uppercase">
                Moyenne Générale École
              </span>
              <span className="text-xl font-black">{stats.generalAvg.toFixed(2)} / 20</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
