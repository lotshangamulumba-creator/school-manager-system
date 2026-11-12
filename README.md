# MonPilot School ERP - Complexe Scolaire Privé CEMINACE (Brazzaville)

Plateforme centralisée de gestion scolaire, calculs officiels des moyennes pondérées selon le système éducatif du Congo-Brazzaville, saisie des notes et édition des bulletins officiels en PDF.

---

## 🚀 Démarrage Rapide sur votre Ordinateur

### 1. Prérequis
- Avoir installé **Node.js** (version 18 ou supérieure) téléchargeable gratuitement sur [nodejs.org](https://nodejs.org).

### 2. Lancement en un clic (Windows)
1. Décompressez le fichier ZIP dans un dossier sur votre ordinateur.
2. Double-cliquez sur le fichier **`demarrer.bat`**.
   - Le script installera automatiquement les dépendances au premier lancement.
   - Votre navigateur ouvrira automatiquement **`http://localhost:3000`**.

### 3. Lancement sous macOS ou Linux
Ouvrez un terminal dans le dossier décompressé et exécutez :
```bash
chmod +x demarrer.sh
./demarrer.sh
```

### 4. Lancement manuel par commandes (tous systèmes)
Dans votre terminal :
```bash
# 1. Installer les dépendances
npm install

# 2. Démarrer le serveur
npm run dev
```
Puis ouvrez votre navigateur à l'adresse : **`http://localhost:3000`**

---

## 🔑 Initialisation des comptes

Les mots de passe ne sont pas inclus dans le code ni dans la documentation. Avant une
première initialisation, copiez `.env.example` vers `.env` et définissez au minimum
`JWT_SECRET` et `LICENSE_PUBLIC_KEY` avec des valeurs appropriées. Les variables
`SEED_ADMIN_PASSWORD` et `SEED_TEACHER_PASSWORD` servent uniquement à initialiser une
nouvelle base lorsque `database/ceminace_data.json` n'existe pas encore. En développement,
si les mots de passe seed ne sont pas définis, des valeurs aléatoires sont générées et
affichées une seule fois dans la console du serveur.

## 🔐 Licences professionnelles

Chaque installation reçoit un identifiant d’école persistant. Une licence Ed25519 signée
lie cet identifiant à l’établissement, au plan mensuel ou annuel, ainsi qu’aux dates de
début et d’expiration. Le backend vérifie la signature et les dates pour chaque route ERP;
une licence absente, invalide ou expirée bloque les fonctions métier. L’authentification,
la consultation de l’état de licence et son installation restent accessibles pour permettre
le renouvellement. Les renouvellements et leur administrateur sont journalisés dans la base.
L’identifiant de l’école, la licence active et l’historique ne sont pas remplacés par une
restauration de sauvegarde d’un autre déploiement.

### Mise en service

1. Générez une paire Ed25519 dans un environnement sécurisé, **hors du dépôt** :
   ```powershell
   node scripts/generate-license-keypair.cjs "C:\secure\monpilot-license-issuer"
   ```
   Gardez `license-private.pem` uniquement dans l’environnement d’émission. Ne la déployez
   jamais sur le serveur de l’école. Le dossier `license-keys/` du dépôt est ignoré par Git.
2. Copiez le contenu de `license-public.pem` dans `LICENSE_PUBLIC_KEY` du `.env` du serveur
   (les retours à la ligne sont représentés par `\n`), puis redémarrez le serveur.
3. Connectez-vous avec le compte administrateur. L’écran de licence indique l’identifiant
   unique de l’école (`schoolId`). Transmettez cet identifiant et son nom exact à l’émetteur.
4. Sur l’environnement sécurisé qui détient la clé privée, créez un fichier de licence :
   ```powershell
   node scripts/issue-school-license.cjs --school-id ID_ECOLE --school-name "Nom de l’école" --plan monthly --starts-at 2026-11-12 --private-key "C:\secure\monpilot-license-issuer\license-private.pem" --out "C:\secure\school.license.json"
   ```
   Remplacez `monthly` par `annual` pour un abonnement annuel. La date d’expiration est
   calculée à partir de la date de début. L’outil refuse d’écraser un fichier existant.
5. Dans MonPilot, ouvrez **Licence**, collez le contenu JSON signé et installez-le. Le backend
   vérifie la signature, l’école ciblée et l’absence de rejeu avant d’enregistrer le document
   et l’historique de renouvellement.

Les licences sont émises hors ligne; le serveur utilise son horloge UTC pour l’expiration.
Pour une exploitation professionnelle, synchronisez l’horloge du serveur et protégez la
clé publique, les sauvegardes et l’accès administrateur. Une licence ne doit pas être
considérée comme une protection contre le propriétaire ayant le contrôle total du serveur.

---

## 📋 Fonctionnalités Principales
- **Écran de Connexion Sécurisé** : Authentification JWT avec rôles RBAC.
- **Règles Officielles CEMINACE (Congo)** : Moyenne de devoirs + composition coefficientée x2.
- **Saisie de Notes** : Saisie individuelle ou saisie groupée par classe entière.
- **Édition PDF** : Génération de bulletins officiels individuels et combinés pour toute la classe.
- **Sauvegarde & Restauration** : Export JSON complet de la base de données et journal d'audit.
