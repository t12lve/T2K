@echo off
setlocal
cd /d "%~dp0"
title T2K Raid
echo Lancement de l'assistant T2K...
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js est requis. Installez-le depuis https://nodejs.org/ puis reessayez.
  pause
  exit /b 1
)
node "%~dp0cli\raid-app.js"
pause
