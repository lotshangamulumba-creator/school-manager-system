@echo off
setlocal enabledelayedexpansion
title TIC-TiG - Complexe Scolaire Prive CEMINACE
color 0B
cls

echo =====================================================================
echo   Lancement de la Plateforme Scolaire TIC-TiG - CEMINACE
echo   Complexe Scolaire Prive CEMINACE - Brazzaville, Congo
echo =====================================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ATTENTION] Node.js n'a pas ete detecte sur votre ordinateur.
    echo Veuillez telecharger Node.js gratuitement sur : https://nodejs.org
    echo.
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo [INFO] Premiere execution : installation des composants...
    call npm install
)

echo.
echo [OK] Demarrage du serveur TIC-TiG sur http://localhost:3000
echo Ouverture automatique de votre navigateur dans quelques secondes...
echo.

start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"

call npm run dev
pause
