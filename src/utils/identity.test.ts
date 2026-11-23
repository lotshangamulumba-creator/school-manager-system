import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const visibleSourceFiles = [
  'src/utils/translations.ts',
  'src/data/pythonSource.ts',
  'src/components/AdminDashboardView.tsx',
  'src/components/AuditBackupModal.tsx',
  'src/components/GeneralTotalView.tsx',
  'src/components/GradeEditModal.tsx',
  'src/components/ImportModal.tsx',
  'src/components/StudentModal.tsx',
  'src/components/SubjectsModal.tsx',
  'src/components/TeacherManagementModal.tsx',
  'src/server/routes.ts',
];

test('visible interface and exports do not contain historical CEMINACE branding', () => {
  for (const file of visibleSourceFiles) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /CEMINACE|Ceminace|ceminace/i, file);
  }
});

test('decorative emoji stickers are absent from visible interface source', () => {
  const stickerPattern = /🔬|📚|🏃|🏆|🥇|🥈|🥉|⭐|🎓|📌|📋|✅|❌|⚠️|🎉|💼|📈|📱|⚽|📊|✍️|🔄/u;
  for (const file of visibleSourceFiles) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, stickerPattern, file);
  }
});

test('module header uses one school theme background and no tab gradients', () => {
  const appSource = fs.readFileSync('src/App.tsx', 'utf8');
  assert.match(appSource, /backgroundColor: 'var\(--school-secondary\)'/);
  assert.doesNotMatch(appSource, /bg-gradient-to-r|bg-gradient-to-b|drop-shadow-/);
  assert.match(appSource, /var\(--school-primary\)/);
  assert.match(appSource, /var\(--school-on-primary\)/);
});
