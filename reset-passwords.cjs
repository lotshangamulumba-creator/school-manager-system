const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');

const PASSWORD_TARGETS = [
  'admin@ceminace.cg',
  'prof.math@ceminace.cg',
  'prof.francais@ceminace.cg',
];

function resetPasswords(databasePath, passwords) {
  const resolvedPath = path.resolve(databasePath);
  const database = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));

  if (!database || !Array.isArray(database.users)) {
    throw new Error('Le fichier ne contient pas de tableau users valide.');
  }

  for (const email of PASSWORD_TARGETS) {
    const matches = database.users.filter((user) => user.email === email);
    if (matches.length !== 1) {
      throw new Error(`Le compte ${email} doit exister exactement une fois (trouvé : ${matches.length}).`);
    }
    if (typeof matches[0].passwordHash !== 'string') {
      throw new Error(`Le compte ${email} ne possède pas de passwordHash valide.`);
    }
  }

  if (!passwords.admin || !passwords.teacher) {
    throw new Error('Les mots de passe administrateur et enseignant sont obligatoires.');
  }

  const timestamp = new Date().toISOString();
  for (const user of database.users) {
    if (user.email === 'admin@ceminace.cg') {
      user.passwordHash = bcrypt.hashSync(passwords.admin, 10);
      user.updatedAt = timestamp;
    } else if (user.email === 'prof.math@ceminace.cg' || user.email === 'prof.francais@ceminace.cg') {
      user.passwordHash = bcrypt.hashSync(passwords.teacher, 10);
      user.updatedAt = timestamp;
    }
  }

  const fileStats = fs.statSync(resolvedPath);
  const uniqueSuffix = `${Date.now()}-${process.pid}`;
  const backupPath = `${resolvedPath}.backup-${uniqueSuffix}`;
  const tempPath = `${resolvedPath}.${uniqueSuffix}.tmp`;

  try {
    fs.writeFileSync(tempPath, `${JSON.stringify(database, null, 2)}\n`, { flag: 'wx' });
    fs.chmodSync(tempPath, fileStats.mode);
    fs.copyFileSync(resolvedPath, backupPath, fs.constants.COPYFILE_EXCL);
    fs.renameSync(tempPath, resolvedPath);
  } catch (error) {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    throw error;
  }

  return backupPath;
}

function readHidden(prompt) {
  const input = process.stdin;
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    throw new Error('Exécutez ce script dans un terminal interactif pour saisir les mots de passe sans les afficher.');
  }

  return new Promise((resolve, reject) => {
    let value = '';
    process.stdout.write(prompt);
    input.setRawMode(true);
    input.resume();

    const finish = (error) => {
      input.removeListener('data', onData);
      input.setRawMode(false);
      process.stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    };

    const onData = (chunk) => {
      for (const character of chunk.toString('utf8')) {
        if (character === '\u0003') {
          finish(new Error('Saisie annulée.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          finish();
          return;
        }
        if (character === '\u007f' || character === '\b') {
          value = value.slice(0, -1);
        } else if (character >= ' ') {
          value += character;
        }
      }
    };

    input.on('data', onData);
  });
}

async function promptPassword(label) {
  const password = await readHidden(`${label} — mot de passe : `);
  const confirmation = await readHidden(`${label} — confirmation : `);
  if (!password || password !== confirmation) {
    throw new Error(`Mot de passe vide ou confirmations différentes pour ${label.toLowerCase()}.`);
  }
  return password;
}

async function main() {
  const databasePath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(__dirname, 'database', 'ceminace_data.json');

  if (!fs.existsSync(databasePath)) {
    throw new Error(`Base de données introuvable : ${databasePath}`);
  }

  console.log('Réinitialisation ciblée des mots de passe MonPilot.');
  console.log('Les autres données ne seront pas modifiées.');
  const adminPassword = await promptPassword('admin@ceminace.cg');
  const teacherPassword = await promptPassword('Comptes enseignants (prof.math et prof.francais)');
  const backupPath = resetPasswords(databasePath, {
    admin: adminPassword,
    teacher: teacherPassword,
  });

  console.log('Les 3 mots de passe ont été réinitialisés.');
  console.log(`Sauvegarde créée : ${backupPath}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Échec : ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { resetPasswords };
