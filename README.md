# TIC-TiG Scolaire - Complexe Scolaire Privé CEMINACE (Brazzaville)

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

## 🔑 Comptes de Démonstration Préconfigurés

| Profil | Email | Mot de passe | Permissions |
|---|---|---|---|
| **Administrateur** | `admin@ceminace.cg` | `admin1234` | Accès complet (Élèves, Enseignants, Classes, Sauvegardes, Bulletins) |
| **Enseignant** | `prof.math@ceminace.cg` | `prof1234` | Saisie des notes de sa matière, consultation de ses classes |
| **Directeur** | `direction@ceminace.cg` | `direct1234` | Tableau de bord général, statistiques, consultation globale |

---

## 📋 Fonctionnalités Principales
- **Écran de Connexion Sécurisé** : Authentification JWT avec rôles RBAC.
- **Règles Officielles CEMINACE (Congo)** : Moyenne de devoirs + composition coefficientée x2.
- **Saisie de Notes** : Saisie individuelle ou saisie groupée par classe entière.
- **Édition PDF** : Génération de bulletins officiels individuels et combinés pour toute la classe.
- **Sauvegarde & Restauration** : Export JSON complet de la base de données et journal d'audit.
