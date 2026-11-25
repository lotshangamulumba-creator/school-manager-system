import { db } from '../src/server/db.js';

await db.ready;
const data = db.getData();
const activeYears = data.academicYears.filter(year => year.status === 'active');
if (data.version < 3 || activeYears.length !== 1) {
  throw new Error('La migration des années scolaires n’a pas produit exactement une année active.');
}

console.log(`Migration académique terminée (version ${data.version}).`);
console.log(`Année active : ${activeYears[0].label}`);
console.log(`Années clôturées : ${data.academicYears.filter(year => year.status === 'closed').length}`);
