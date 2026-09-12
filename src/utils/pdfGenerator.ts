import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { StudentTrimesterResult, SchoolLevel } from '../types';
import { Language } from './translations';

/**
 * Helper to render the watermark on the current page
 */
function drawWatermark(doc: jsPDF, pageWidth: number) {
  doc.saveGraphicsState();
  doc.setTextColor(230, 236, 245);
  doc.setFontSize(54);
  doc.setFont('helvetica', 'bold');
  doc.text('MonPilot', pageWidth / 2, 140, { align: 'center', angle: 45 });
  doc.setFontSize(14);
  doc.text('CEMINACE - BRAZZAVILLE', pageWidth / 2, 160, { align: 'center', angle: 45 });
  doc.restoreGraphicsState();
}

/**
 * Renders a complete student report card on the current page of doc
 */
export function renderStudentBulletinPage(
  doc: jsPDF,
  res: StudentTrimesterResult,
  className: string,
  level: SchoolLevel,
  trimester: string,
  classTotalStudents: number,
  lang: Language = 'fr'
) {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Watermark MonPilot
  drawWatermark(doc, pageWidth);

  const isEn = lang === 'en';

  // Official Header - République du Congo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(isEn ? 'REPUBLIC OF THE CONGO' : 'RÉPUBLIQUE DU CONGO', 14, 14);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(isEn ? 'Unity - Work - Progress' : 'Unité - Travail - Progrès', 14, 18);
  doc.text(
    isEn
      ? 'MINISTRY OF PRESCHOOL, PRIMARY, SECONDARY'
      : "MINISTÈRE DE L'ENSEIGNEMENT PRÉSCOLAIRE,",
    14,
    22
  );
  doc.text(
    isEn ? 'EDUCATION AND LITERACY' : 'PRIMAIRE, SECONDAIRE ET DE L’ALPHABÉTISATION',
    14,
    26
  );

  // School Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 58, 95);
  doc.text('COMPLEXE SCOLAIRE PRIVÉ CEMINACE', pageWidth - 14, 14, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    isEn
      ? 'Ministerial Accreditation • General Education'
      : 'Agrément Ministériel • Enseignement Général',
    pageWidth - 14,
    18,
    { align: 'right' }
  );
  doc.text('Brazzaville - République du Congo', pageWidth - 14, 22, { align: 'right' });
  doc.text(isEn ? 'Academic Year: 2025 - 2026' : 'Année Scolaire : 2025 - 2026', pageWidth - 14, 26, {
    align: 'right',
  });

  // Divider Line
  doc.setDrawColor(30, 58, 95);
  doc.setLineWidth(0.7);
  doc.line(14, 29, pageWidth - 14, 29);

  // Bulletin Title Box
  doc.setFillColor(30, 58, 95);
  doc.roundedRect(14, 32, pageWidth - 28, 10, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  const titleText = isEn
    ? `STUDENT REPORT CARD - ${trimester.toUpperCase()}`
    : `BULLETIN DE NOTES DU ${trimester.toUpperCase()}`;
  doc.text(titleText, pageWidth / 2, 38.5, { align: 'center' });

  // Student Identity Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, 45, pageWidth - 28, 19, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `${isEn ? 'Student' : 'Élève'} : ${res.student.lastName.toUpperCase()} ${res.student.firstName}`,
    18,
    51
  );
  doc.text(`${isEn ? 'ID' : 'Matricule'} : ${res.student.id}`, pageWidth - 60, 51);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `${isEn ? 'Level & Class' : 'Niveau & Classe'} : ${level} - ${className} (${isEn ? 'Enrolled' : 'Effectif'} : ${classTotalStudents})`,
    18,
    56
  );
  doc.text(
    `${isEn ? 'Gender' : 'Sexe'} : ${res.student.gender}  |  ${isEn ? 'DOB' : 'Né(e) le'} : ${res.student.dob}`,
    pageWidth - 60,
    56
  );

  doc.text(`${isEn ? 'Parent Phone' : 'Contact Parents'} : ${res.student.parentPhone}`, 18, 61);
  doc.text(`${isEn ? 'Term' : 'Session'} : ${isEn ? 'Regular Trimester' : 'Trimestrielle Régulière'}`, pageWidth - 60, 61);

  // Subject Grades Table
  const subjectRows = res.subjectResults.map((sr) => [
    `${sr.subjectName} (${sr.specialty})`,
    sr.coeff.toString(),
    sr.evalAvg.toFixed(2),
    sr.devAvg.toFixed(2),
    sr.subjectAvg.toFixed(2),
    sr.points.toFixed(2),
    `${sr.rank}e / ${classTotalStudents}`,
    sr.appreciation,
  ]);

  const headers = isEn
    ? [['Subjects & Specialties', 'Coeff', 'Evals', 'HW', 'Avg/20', 'Points', 'Subject Rank', 'Appreciation']]
    : [['Matières & Spécialités', 'Coeff', 'Éval.', 'Devoirs', 'Moy./20', 'Points', 'Rang Matière', 'Appréciation']];

  autoTable(doc, {
    startY: 67,
    head: headers,
    body: subjectRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 58, 95],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 48 },
      1: { halign: 'center', cellWidth: 14 },
      2: { halign: 'center', cellWidth: 16 },
      3: { halign: 'center', cellWidth: 16 },
      4: { halign: 'center', fontStyle: 'bold', cellWidth: 18 },
      5: { halign: 'center', cellWidth: 18 },
      6: { halign: 'center', fontStyle: 'bold', cellWidth: 26 },
      7: { cellWidth: 26 },
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
  });

  const tableFinalY = (doc as any).lastAutoTable?.finalY || 160;

  // Specialty Breakdown & General Summary Table
  const summaryRows = [
    [
      isEn ? 'SCIENCES Specialty (Math, Physics, SVT)' : 'Spécialité SCIENCES (Maths, Phys., SVT)',
      `${res.sciencesAvg.toFixed(2)} / 20`,
      `${res.sciencesRank}e ${isEn ? 'out of' : 'sur'} ${classTotalStudents}`,
      isEn ? 'Total Points :' : 'Total des Points :',
      `${res.totalPoints.toFixed(2)}`,
    ],
    [
      isEn ? 'LITERATURE Specialty (French, English, Hist-Geo)' : 'Spécialité LITTÉRATURE (Français, Anglais, H-G)',
      `${res.literatureAvg.toFixed(2)} / 20`,
      `${res.literatureRank}e ${isEn ? 'out of' : 'sur'} ${classTotalStudents}`,
      isEn ? 'Total Coefficients :' : 'Total Coefficients :',
      `${res.totalCoeff}`,
    ],
    [
      isEn ? 'PHYSICAL EDUCATION Specialty (PE)' : 'Spécialité SPORTIVE (EPS)',
      `${res.epsAvg.toFixed(2)} / 20`,
      `${res.epsRank}e ${isEn ? 'out of' : 'sur'} ${classTotalStudents}`,
      isEn ? 'TRIMESTER AVERAGE :' : 'MOYENNE TRIMESTRIELLE :',
      `${res.generalAvg.toFixed(2)} / 20`,
    ],
    [
      isEn ? 'Council Official Honors :' : 'Mention Officielle du Conseil :',
      res.mention.split('(')[0].trim(),
      '',
      isEn ? 'OVERALL CLASS RANK :' : 'RANG GÉNÉRAL :',
      `${res.generalRank}e ${isEn ? 'out of' : 'sur'} ${classTotalStudents}`,
    ],
  ];

  const summaryHeaders = isEn
    ? [['RANKING BY SPECIALTY', 'AVERAGE', 'SPECIALTY RANK', 'GENERAL RECAP', 'RESULT']]
    : [['CLASSEMENT PAR SPÉCIALITÉ', 'MOYENNE', 'RANG SPÉCIALITÉ', 'RÉCAPITULATIF GÉNÉRAL', 'RÉSULTAT']];

  autoTable(doc, {
    startY: tableFinalY + 5,
    head: summaryHeaders,
    body: summaryRows,
    theme: 'grid',
    headStyles: {
      fillColor: [51, 65, 85],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      halign: 'center',
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { halign: 'center', cellWidth: 24 },
      2: { halign: 'center', cellWidth: 32 },
      3: { fontStyle: 'bold', cellWidth: 42 },
      4: { halign: 'center', fontStyle: 'bold', cellWidth: 24 },
    },
  });

  const summaryFinalY = (doc as any).lastAutoTable?.finalY || 215;

  // Signatures Section
  const sigY = summaryFinalY + 12;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(isEn ? 'Head Teacher / Homeroom' : 'Le Titulaire / Professeur Principal', 25, sigY);
  doc.text(isEn ? 'Parents / Guardians Signature' : 'Signature des Parents / Tuteurs', pageWidth / 2, sigY, {
    align: 'center',
  });
  doc.text(isEn ? 'CEMINACE Administration' : 'La Direction CEMINACE (Brazzaville)', pageWidth - 25, sigY, {
    align: 'right',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(isEn ? 'Observation & Stamp' : 'Observation & Visa', 32, sigY + 16);
  doc.text(isEn ? 'Date & Signature' : 'Date & Signature', pageWidth / 2, sigY + 16, { align: 'center' });
  doc.text(isEn ? 'School Principal' : 'Le Directeur Général', pageWidth - 32, sigY + 16, { align: 'right' });
}

/**
 * Exports one single individual bulletin PDF
 */
export function generateStudentBulletinPDF(
  res: StudentTrimesterResult,
  className: string,
  level: SchoolLevel,
  trimester: string,
  classTotalStudents: number,
  lang: Language = 'fr'
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  renderStudentBulletinPage(doc, res, className, level, trimester, classTotalStudents, lang);

  const fileName = `Bulletin_${res.student.lastName}_${res.student.firstName}_${className.replace(/\s+/g, '_')}_${trimester.replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
}

/**
 * EXPORTS A SINGLE COMBINED PDF CONTAINING ALL CLASS BULLETINS ASSEMBLED PER TRIMESTER
 * Uses jsPDF and doc.addPage() for a clean, unified multi-page publication document
 */
export function generateAllClassBulletinsCombinedPDF(
  results: StudentTrimesterResult[],
  className: string,
  level: SchoolLevel,
  trimester: string,
  lang: Language = 'fr'
) {
  if (!results || results.length === 0) return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  results.forEach((res, index) => {
    if (index > 0) {
      doc.addPage();
    }
    renderStudentBulletinPage(doc, res, className, level, trimester, results.length, lang);
  });

  const fileName =
    lang === 'en'
      ? `All_Bulletins_Combined_${className.replace(/\s+/g, '_')}_${trimester.replace(/\s+/g, '_')}.pdf`
      : `Bulletins_Complets_Classe_${className.replace(/\s+/g, '_')}_${trimester.replace(/\s+/g, '_')}.pdf`;

  doc.save(fileName);
}

/**
 * Exports Class Summary / Palmarès PDF
 */
export function generateClassResultsPDF(
  results: StudentTrimesterResult[],
  className: string,
  level: SchoolLevel,
  trimester: string,
  lang: Language = 'fr'
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const isEn = lang === 'en';

  // Watermark MonPilot
  drawWatermark(doc, pageWidth);

  // Header - République du Congo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(isEn ? 'REPUBLIC OF THE CONGO' : 'RÉPUBLIQUE DU CONGO', 14, 15);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(isEn ? 'Unity - Work - Progress' : 'Unité - Travail - Progrès', 14, 19);
  doc.text(
    isEn
      ? 'MINISTRY OF PRESCHOOL, PRIMARY, SECONDARY'
      : "MINISTÈRE DE L'ENSEIGNEMENT PRÉSCOLAIRE,",
    14,
    23
  );
  doc.text(
    isEn ? 'EDUCATION AND LITERACY' : 'PRIMAIRE, SECONDAIRE ET DE L’ALPHABÉTISATION',
    14,
    27
  );

  // Header - School CEMINACE
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 58, 95);
  doc.text('COMPLEXE SCOLAIRE PRIVÉ CEMINACE', pageWidth - 14, 15, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Brazzaville - République du Congo', pageWidth - 14, 19, { align: 'right' });
  doc.text(
    `${isEn ? 'Cycle' : 'Cycle'} : ${level.toUpperCase()}  •  ${isEn ? 'Academic Year' : 'Année Scolaire'} 2025-2026`,
    pageWidth - 14,
    23,
    { align: 'right' }
  );
  doc.text(`${isEn ? 'Class' : 'Classe'} : ${className}`, pageWidth - 14, 27, { align: 'right' });

  // Divider
  doc.setDrawColor(30, 58, 95);
  doc.setLineWidth(0.8);
  doc.line(14, 31, pageWidth - 14, 31);

  // Title Box
  doc.setFillColor(30, 58, 95);
  doc.roundedRect(14, 35, pageWidth - 28, 12, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  const palmaresTitle = isEn
    ? `CLASS PALMARÈS (ACADEMIC RESULTS) - ${trimester.toUpperCase()}`
    : `PALMARÈS DES RÉSULTATS TRIMESTRIELS - ${trimester.toUpperCase()}`;
  doc.text(palmaresTitle, pageWidth / 2, 42.5, { align: 'center' });

  // Table Data
  const tableRows = results.map((r) => [
    `${r.generalRank}e`,
    r.student.id,
    `${r.student.lastName.toUpperCase()} ${r.student.firstName}`,
    `${r.sciencesAvg.toFixed(2)} (${r.sciencesRank}e)`,
    `${r.literatureAvg.toFixed(2)} (${r.literatureRank}e)`,
    `${r.epsAvg.toFixed(2)} (${r.epsRank}e)`,
    `${r.generalAvg.toFixed(2)} / 20`,
    r.mention.split('(')[0].trim(),
  ]);

  const headers = isEn
    ? [['Rank', 'ID', 'Student Full Name', 'Sciences', 'Literature', 'PE', 'Average', 'CEMINACE Honors']]
    : [['Rang', 'Matricule', 'Nom & Prénom de l’Élève', 'Sciences', 'Littérature', 'EPS', 'Moyenne', 'Mention CEMINACE']];

  autoTable(doc, {
    startY: 51,
    head: headers,
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 58, 95],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 14 },
      1: { halign: 'center', cellWidth: 20 },
      2: { cellWidth: 50 },
      3: { halign: 'center', cellWidth: 25 },
      4: { halign: 'center', cellWidth: 25 },
      5: { halign: 'center', cellWidth: 18 },
      6: { halign: 'center', fontStyle: 'bold', cellWidth: 22 },
      7: { cellWidth: 28 },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 160;

  // Class Statistics Summary
  if (results.length > 0) {
    const moys = results.map((r) => r.generalAvg);
    const classAvg = (moys.reduce((a, b) => a + b, 0) / moys.length).toFixed(2);
    const highest = Math.max(...moys).toFixed(2);
    const lowest = Math.min(...moys).toFixed(2);
    const passCount = moys.filter((m) => m >= 10).length;
    const passRate = ((passCount / moys.length) * 100).toFixed(1);

    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(14, finalY + 6, pageWidth - 28, 14, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 58, 95);

    const statsText = isEn
      ? `STATISTICS: Enrolled: ${results.length} students | Class Average: ${classAvg}/20 | Highest: ${highest} | Lowest: ${lowest} | Pass (>=10): ${passRate}% (${passCount}/${results.length})`
      : `STATISTIQUES : Effectif: ${results.length} élèves | Moyenne de Classe: ${classAvg}/20 | Plus Forte: ${highest} | Plus Faible: ${lowest} | Réussite (>=10): ${passRate}% (${passCount}/${results.length})`;

    doc.text(statsText, pageWidth / 2, finalY + 14.5, { align: 'center' });
  }

  // Signatures
  const sigY = finalY + 28;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(isEn ? 'Head Teacher / Homeroom' : 'Le Professeur Principal', 35, sigY);
  doc.text(isEn ? 'CEMINACE Director of Studies' : 'Le Directeur des Études CEMINACE', pageWidth - 70, sigY);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(isEn ? 'Visa & Signature' : 'Visa & Signature', 40, sigY + 15);
  doc.text(isEn ? 'Official School Stamp' : 'Cachet de l’Établissement', pageWidth - 65, sigY + 15);

  doc.save(`Palmares_CEMINACE_${className.replace(/\s+/g, '_')}_${trimester.replace(/\s+/g, '_')}.pdf`);
}
