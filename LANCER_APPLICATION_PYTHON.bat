@echo off
title MonPilot School ERP - Desktop Python Tkinter (980x683 px)
echo =====================================================================
echo   Lancement de l'Application MonPilot School ERP (Desktop Python Tkinter)
echo   Complexe Scolaire Prive CEMINACE - Brazzaville, Congo
echo =====================================================================
echo.

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERREUR] Python 3 n'est pas detecte sur votre machine.
    echo Telechargez Python 3 sur https://www.python.org/
    echo Pensez a cocher l'option "Add Python to PATH" lors de l'installation.
    pause
    exit /b 1
)

echo [INFO] Verification des modules optionnels (Excel, Word, PDF)...
pip install openpyxl python-docx reportlab --quiet 2>nul

echo [OK] Demarrage de l'interface MonPilot School ERP (980x683 pixels)...
python tic_tig.py

if %errorlevel% neq 0 (
    echo.
    echo [INFO] Fenetre fermee ou arret du programme.
    pause
)
