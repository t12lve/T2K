@echo off
setlocal
cd /d "%~dp0"
title T2K — Assistant Twitch to Kick
echo.
echo   T2K — lancement de l'assistant (wizard)...
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
if errorlevel 1 pause
