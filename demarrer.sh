#!/bin/bash
clear
echo "===================================================================="
echo "            PLATEFORME SCOLAIRE MONPILOT SCHOOL ERP (CEMINACE)"
echo "        Complexe Scolaire Privé CEMINACE - Brazzaville"
echo "===================================================================="
echo ""

if ! command -v node &> /dev/null; then
    echo "[ERREUR] Node.js n'est pas installé sur votre ordinateur."
    echo "Veuillez installer Node.js depuis https://nodejs.org"
    exit 1
fi

if [ ! -d "node_modules" ]; then
    echo "[INFO] Installation des dépendances npm..."
    npm install
fi

echo ""
echo "===================================================================="
echo "[OK] Démarrage du serveur MonPilot School ERP sur : http://localhost:3000"
echo "     Ouvrez votre navigateur web à l'adresse : http://localhost:3000"
echo "===================================================================="
echo ""
echo "Identifiants de connexion :"
echo "  - Les mots de passe sont définis dans le fichier .env"
echo ""

if command -v xdg-open &> /dev/null; then
    xdg-open "http://localhost:3000" &
elif command -v open &> /dev/null; then
    open "http://localhost:3000" &
fi

npm run dev
