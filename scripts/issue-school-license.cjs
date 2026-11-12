const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function readArguments(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key || !key.startsWith('--') || !value || value.startsWith('--')) {
      throw new Error('Arguments invalides. Utilisez --help pour afficher la syntaxe.');
    }
    options[key.slice(2)] = value;
  }
  return options;
}

function parseDate(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} doit être au format YYYY-MM-DD.`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`${label} n’est pas une date valide.`);
  }
  return date;
}

function addPlanPeriod(startDate, plan) {
  const monthsToAdd = plan === 'annual' ? 12 : 1;
  const day = startDate.getUTCDate();
  const endDate = new Date(startDate);
  endDate.setUTCDate(1);
  endDate.setUTCMonth(endDate.getUTCMonth() + monthsToAdd);
  const lastDayOfMonth = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth() + 1, 0)).getUTCDate();
  endDate.setUTCDate(Math.min(day, lastDayOfMonth));
  return endDate;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.length === 0) {
    console.log('Usage: node scripts/issue-school-license.cjs --school-id ID --school-name NAME --plan monthly|annual --starts-at YYYY-MM-DD --private-key PATH --out PATH');
    return;
  }

  const options = readArguments(args);
  for (const required of ['school-id', 'school-name', 'plan', 'starts-at', 'private-key', 'out']) {
    if (!options[required]) throw new Error(`Argument obligatoire manquant : --${required}`);
  }
  if (options.plan !== 'monthly' && options.plan !== 'annual') {
    throw new Error('--plan doit valoir monthly ou annual.');
  }
  if (options['school-id'].length > 128) throw new Error('--school-id ne peut pas dépasser 128 caractères.');
  if (!options['school-name'].trim()) throw new Error('--school-name ne peut pas être vide.');
  if (options['school-name'].trim().length > 256) throw new Error('--school-name ne peut pas dépasser 256 caractères.');

  const privateKey = crypto.createPrivateKey(fs.readFileSync(path.resolve(options['private-key']), 'utf8'));
  if (privateKey.asymmetricKeyType !== 'ed25519') {
    throw new Error('La clé privée doit être au format Ed25519.');
  }

  const startDate = parseDate(options['starts-at'], '--starts-at');
  const expiresAt = addPlanPeriod(startDate, options.plan);
  const payload = {
    schemaVersion: 1,
    licenseId: crypto.randomUUID(),
    schoolId: options['school-id'],
    schoolName: options['school-name'].trim(),
    plan: options.plan,
    startsAt: startDate.toISOString(),
    expiresAt: expiresAt.toISOString(),
    issuedAt: new Date().toISOString(),
  };
  const signature = crypto.sign(null, Buffer.from(JSON.stringify(payload), 'utf8'), privateKey).toString('base64');
  const document = `${JSON.stringify({ payload, signature }, null, 2)}\n`;
  const outputPath = path.resolve(options.out);

  fs.writeFileSync(outputPath, document, { flag: 'wx', mode: 0o600 });
  console.log(`Licence signée créée : ${outputPath}`);
  console.log(`École : ${payload.schoolName} (${payload.schoolId})`);
  console.log(`Plan : ${payload.plan}; expiration UTC : ${payload.expiresAt}`);
  console.log('La clé privée n’est ni copiée ni envoyée avec le fichier de licence.');
}

try {
  main();
} catch (error) {
  console.error(`Émission refusée : ${error.message}`);
  process.exitCode = 1;
}
