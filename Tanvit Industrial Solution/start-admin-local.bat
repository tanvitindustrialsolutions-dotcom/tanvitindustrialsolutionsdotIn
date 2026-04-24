@echo off
title Tanvit — admin helper
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js install karo: https://nodejs.org
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Pehli baar: npm install...
  call npm install
  if errorlevel 1 (
    echo npm install fail.
    pause
    exit /b 1
  )
)

echo Server nayi window mein start ho raha hai. Band karne ke liye wo window band karo.
start "Tanvit server" /D "%~dp0" cmd /k npm run server

echo 5 second wait, phir admin browser mein khulega...
timeout /t 5 /nobreak >nul
start "" "http://127.0.0.1:8787/admin/"

echo Ho gaya. Ye helper window band kar sakte ho.
timeout /t 2 /nobreak >nul
