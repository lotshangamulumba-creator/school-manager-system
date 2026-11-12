const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const outputDirectory = path.resolve(process.argv[2] || 'license-keys');
const privateKeyPath = path.join(outputDirectory, 'license-private.pem');
const publicKeyPath = path.join(outputDirectory, 'license-public.pem');

if (fs.existsSync(privateKeyPath) || fs.existsSync(publicKeyPath)) {
  console.error('Refus : un fichier de clé existe déjà dans le dossier cible.');
  process.exitCode = 1;
} else {
  try {
    fs.mkdirSync(outputDirectory, { recursive: true });
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    fs.writeFileSync(privateKeyPath, privateKey, { flag: 'wx', mode: 0o600 });
    fs.writeFileSync(publicKeyPath, publicKey, { flag: 'wx', mode: 0o644 });

    console.log(`Clé privée d’émission : ${privateKeyPath}`);
    console.log(`Clé publique de vérification : ${publicKeyPath}`);
    console.log('Conservez la clé privée hors du dépôt et du serveur MonPilot.');
    console.log('Configurez LICENSE_PUBLIC_KEY avec le contenu de la clé publique.');
  } catch (error) {
    console.error(`Échec de génération des clés : ${error.message}`);
    process.exitCode = 1;
  }
}
