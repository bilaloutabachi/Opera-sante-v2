@echo off
chcp 65001 >nul 2>&1
title Opera Sante - Compilation

echo.
echo ============================================================
echo      OPERA SANTE - Compilation installateur Windows
echo ============================================================
echo.
echo Ce script va creer votre installateur en 10 minutes.
echo Ne fermez pas cette fenetre !
echo.

python --version >nul 2>&1
if errorlevel 1 (
    echo ERREUR : Python n'est pas installe ou pas dans le PATH.
    echo Telechargez Python 3.11+ sur https://www.python.org/downloads/
    echo IMPORTANT : Cochez "Add Python to PATH" pendant l'installation
    echo.
    pause
    exit /b 1
)
echo OK - Python trouve

node --version >nul 2>&1
if errorlevel 1 (
    echo ERREUR : Node.js n'est pas installe.
    echo Telechargez Node.js 20+ sur https://nodejs.org/
    echo.
    pause
    exit /b 1
)
echo OK - Node.js trouve

npm --version >nul 2>&1
if errorlevel 1 (
    echo ERREUR : npm non disponible.
    pause
    exit /b 1
)
echo OK - npm trouve

set "PROJECT_ROOT=%~dp0"
cd /d "%PROJECT_ROOT%"

if not exist "backend\server.py" (
    echo ERREUR : Ce script doit etre dans le dossier racine du projet
    echo Le dossier doit contenir backend\, frontend\, electron\
    echo Dossier actuel : %CD%
    echo.
    pause
    exit /b 1
)
echo OK - Projet trouve dans : %CD%

echo.
echo [2/6] Installation PyInstaller et dependances Python...
echo Cela peut prendre 2-3 minutes la premiere fois...
echo.

pip install pyinstaller --quiet
if errorlevel 1 (
    echo ERREUR lors de l'installation de PyInstaller
    pause
    exit /b 1
)

cd backend

pip install fastapi uvicorn aiosqlite python-multipart pydantic python-dotenv starlette --quiet
if errorlevel 1 (
    echo ERREUR lors de l'installation des dependances Python
    pause
    exit /b 1
)
echo OK - Dependances Python installees

echo.
echo [3/6] Compilation du backend Python en .exe...
echo Cette etape prend 3-5 minutes, soyez patient...
echo.

pyinstaller --onefile ^
    --name opera-backend ^
    --hidden-import aiosqlite ^
    --hidden-import aiosqlite.sa_extras ^
    --hidden-import fastapi ^
    --hidden-import uvicorn ^
    --hidden-import uvicorn.logging ^
    --hidden-import uvicorn.loops ^
    --hidden-import uvicorn.loops.auto ^
    --hidden-import uvicorn.protocols ^
    --hidden-import uvicorn.protocols.http ^
    --hidden-import uvicorn.protocols.http.auto ^
    --hidden-import uvicorn.protocols.websockets ^
    --hidden-import uvicorn.protocols.websockets.auto ^
    --hidden-import uvicorn.lifespan ^
    --hidden-import uvicorn.lifespan.on ^
    --hidden-import starlette ^
    --hidden-import pydantic ^
    --hidden-import python_multipart ^
    --hidden-import dotenv ^
    --distpath dist ^
    --workpath build ^
    --specpath . ^
    --noconfirm ^
    server.py

if errorlevel 1 (
    echo ERREUR lors de la compilation PyInstaller.
    pause
    exit /b 1
)

if not exist "dist\opera-backend.exe" (
    echo ERREUR : dist\opera-backend.exe n'a pas ete cree.
    pause
    exit /b 1
)
echo OK - Backend compile : backend\dist\opera-backend.exe

echo.
echo [4/6] Build du frontend React...
echo Cela peut prendre 2-3 minutes...
echo.

cd ..\frontend

echo REACT_APP_BACKEND_URL=http://127.0.0.1:8001> .env.production

call npm install --legacy-peer-deps
if errorlevel 1 (
    echo ERREUR lors de npm install dans frontend
    pause
    exit /b 1
)

call npm run build
if errorlevel 1 (
    echo ERREUR lors du build React
    pause
    exit /b 1
)

if not exist "build\index.html" (
    echo ERREUR : Le build React n'a pas produit de fichiers.
    pause
    exit /b 1
)
echo OK - Frontend bati : frontend\build\

echo.
echo [5/6] Preparation du package Electron...
echo.

cd ..\electron

if not exist "backend-dist" mkdir backend-dist
copy /Y "..\backend\dist\opera-backend.exe" "backend-dist\opera-backend.exe"
echo OK - Backend copie dans electron\backend-dist\

if exist "frontend-dist" rmdir /s /q frontend-dist
xcopy /E /I /Q "..\frontend\build" "frontend-dist"
echo OK - Frontend copie dans electron\frontend-dist\

call npm install --legacy-peer-deps
if errorlevel 1 (
    echo ERREUR lors de npm install dans electron
    pause
    exit /b 1
)

echo.
echo [6/6] Generation de l'installateur Windows...
echo Encore 2-3 minutes...
echo.

call npm run build:win
if errorlevel 1 (
    echo ERREUR lors de la generation de l'installateur
    pause
    exit /b 1
)

echo.
echo ============================================================
echo                         SUCCES !
echo ============================================================
echo.
echo Votre installateur est pret dans :
echo %CD%\dist\
echo.
dir /b "dist\*.exe" 2>nul
echo.
echo ------------------------------------------------------------
echo POUR INSTALLER SUR L'ORDI DU CABINET :
echo 1. Copiez le .exe sur une cle USB
echo 2. Double-cliquez sur le .exe sur l'ordi du cabinet
echo 3. Si alerte Windows : cliquez "Informations complementaires"
echo    puis "Executer quand meme" - c'est normal
echo 4. Un raccourci "Opera Sante" apparait sur le bureau
echo.
echo VOS DONNEES sont dans : %APPDATA%\opera-sante\opera.db
echo Elles persistent apres fermeture et redemarrage du PC.
echo ------------------------------------------------------------
echo.
pause
