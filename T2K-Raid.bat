@echo off
setlocal
cd /d "%~dp0"
title T2K — console debug (optionnel)
echo.
echo   T2K — mode CONSOLE (debug)
echo   -------------------------
echo   Pour un usage normal, prefere :
echo      T2K-Assistant.vbs
echo   (pas de fenetre noire)
echo.
echo   Cette fenetre doit rester ouverte pendant l'usage.
echo.
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js manquant — https://nodejs.org/
  pause
  exit /b 1
)
node "%~dp0cli\raid-app.js"
echo.
echo   Assistant arrete.
pause
