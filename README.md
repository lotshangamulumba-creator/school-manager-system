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

# 2. Démarrer en développement (Vite)
npm run dev
```
Pour un lancement de production, construisez puis démarrez le serveur :
```bash
npm run build
npm start
```
`npm start` active `NODE_ENV=production` sur Windows, macOS et Linux. En production, le
serveur sert uniquement les fichiers construits dans `dist/` et refuse de démarrer si
`JWT_SECRET` est absent ou contient moins de 32 caractères. Copiez `.env.example` vers
`.env` et configurez au minimum `JWT_SECRET` et `ALLOWED_ORIGINS` avant le démarrage.
`HOST` vaut `127.0.0.1` et `PORT` vaut `3000` par défaut. `ALLOWED_ORIGINS` est une liste
d’origines séparées par des virgules; seules ces origines peuvent appeler l’API depuis un
navigateur.

---

## 🔑 Initialisation des comptes

Les mots de passe ne sont pas inclus dans le code ni dans la documentation. Avant une
première initialisation, copiez `.env.example` vers `.env` et définissez au minimum
`JWT_SECRET`, `ALLOWED_ORIGINS` et `LICENSE_PUBLIC_KEY` avec des valeurs appropriées. Les variables
`SEED_ADMIN_EMAIL` et `SEED_ADMIN_PASSWORD` définissent le compte administrateur initial
uniquement lorsqu’une nouvelle base est créée. Les enseignants et élèves d’exemple CEMINACE
ne sont ajoutés que si `SEED_DEMO_DATA=true`; leur mot de passe est alors contrôlé par
`SEED_TEACHER_PASSWORD`. En développement, les mots de passe manquants sont générés et
affichés une seule fois dans la console du serveur.

## 🔐 Licences professionnelles

Chaque installation reçoit un identifiant d’école persistant. Une licence Ed25519 signée
lie cet identifiant à l’établissement, au plan mensuel ou annuel, ainsi qu’aux dates de
début et d’expiration. Après expiration, une période de grâce de 14 jours laisse fonctionner
l’application avec un avertissement; ensuite les écritures sont bloquées en HTTP 402, tandis
que les consultations et exports restent disponibles. Sans licence, l’application reste en
lecture seule et les exports restent disponibles. L’authentification, la consultation de
l’état de licence et son installation restent accessibles pour permettre le renouvellement.
Les renouvellements et leur administrateur sont journalisés dans la base.
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

## 🏫 Déploiements personnalisés par établissement

MonPilot utilise une base de code et une installation isolée par école : chaque déploiement
possède son fichier de données, ses comptes, son identifiant `schoolId` et sa licence. Ce
mode évite les forks tout en empêchant une école d’accéder aux données d’une autre. La
version actuelle n’est pas un tenant partagé : ne mettez pas plusieurs écoles dans le même
fichier JSON et ne réutilisez pas une copie de la base d’une école pour en créer une autre.

Pour héberger chaque installation sur son propre serveur ou répertoire, configurez pour
chaque déploiement un `DATABASE_FILE` différent dans son `.env`. Le chemin relatif est
résolu depuis le dossier du projet :

```env
DATABASE_FILE=database/ecole-exemple.json
```

Au premier démarrage avec un chemin de base neuf, MonPilot initialise une base et un
identifiant d’école indépendants; créez ensuite les comptes et la licence de cette école.
Pour personnaliser l’installation, connectez-vous comme administrateur et ouvrez
**Établissement**. Vous pouvez y enregistrer le nom, les coordonnées, le logo PNG/JPEG,
la palette principale/secondaire/d’accentuation, la devise (slogan) et les signataires.
Ces paramètres sont sauvegardés dans la base de l’école, appliqués à l’interface et repris
sur les bulletins PDF. Les anciennes bases sont migrées automatiquement avec les valeurs
CEMINACE existantes, sans supprimer leurs données.

La migration crée une année 2025-2026 clôturée pour les données existantes et une année
2026-2027 active; elle copie d’abord le fichier de base en
`<fichier>.pre-academic-years-<UUID>.bak`. Elle s’exécute automatiquement au démarrage
et peut être lancée/contrôlée séparément avec `npm run migrate:academic-years`.
Les nouvelles saisies utilisent l’année active. Une année clôturée conserve ses bulletins
en lecture seule; l’administration des années se trouve dans le bouton **Années**.

---

## 📋 Fonctionnalités Principales
- **Écran de Connexion Sécurisé** : Authentification JWT avec rôles RBAC.
- **Règles Officielles CEMINACE (Congo)** : Moyenne de devoirs + composition coefficientée x2.
- **Saisie de Notes** : Saisie individuelle ou saisie groupée par classe entière.
- **Édition PDF** : Génération de bulletins officiels individuels et combinés pour toute la classe.
- **Sauvegarde & Restauration** : Export JSON complet de la base de données et journal d'audit.
