@echo off
setlocal
cd /d "%~dp0"
title T2K — Assistant (ne pas fermer)
echo.
echo   ========================================
echo    T2K — Assistant Twitch vers Kick
echo   ========================================
echo.
echo   IMPORTANT : laisse cette fenetre OUVERTE
echo   pendant que tu utilises le guide dans
echo   le navigateur. La fermer = "Failed to fetch".
echo.
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js est requis.
  echo Telechargez LTS sur https://nodejs.org/ puis reessayez.
  echo.
  pause
  exit /b 1
)
node "%~dp0cli\raid-app.js"
echo.
echo   Assistant arrete.
pause
