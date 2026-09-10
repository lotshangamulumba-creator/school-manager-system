@echo off
setlocal enabledelayedexpansion
title TIC-TiG Scolaire - Complexe Scolaire Prive CEMINACE
color 0B
cls

echo ====================================================================
echo             PLATEFORME SCOLAIRE TIC-TiG - CEMINACE
echo         Complexe Scolaire Prive CEMINACE - Brazzaville
echo ====================================================================
echo.

REM 1. Verification de Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERREUR] Node.js n'est pas installe sur votre ordinateur.
    echo Veuillez telecharger et installer Node.js depuis https://nodejs.org
    echo.
    pause
    exit /b 1
)

REM 2. Verification des dependances
if not exist "node_modules\" (
    echo [INFO] Premier lancement : Installation des composants requis...
    call npm install
)

if not exist "node_modules\" (
    echo [ERREUR] Echec lors de l'installation des dependances.
    pause
    exit /b 1
)

echo.
echo ====================================================================
echo [OK] Demarrage du serveur TIC-TiG sur http://localhost:3000
echo      L'application va s'ouvrir dans votre navigateur web.
echo ====================================================================
echo.
echo Identifiants de test :
echo   - Administrateur : admin@ceminace.cg    / admin1234
echo   - Enseignant     : prof.math@ceminace.cg / prof1234
echo.

start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"

call npm run dev

if %errorlevel% neq 0 (
    echo.
    echo [ATTENTION] Le serveur s'est arrete.
    pause
)
