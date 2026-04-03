@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or not in PATH.
  echo Install from https://nodejs.org/ then run this again.
  pause
  exit /b 1
)
if not exist "node_modules\serve" (
  echo Installing local server ^(one-time^)...
  call npm install
)
echo.
echo Open in your browser: http://localhost:5500
echo If login fails: use InPrivate with extensions OFF ^(see DEV-SERVER.txt^).
echo Press Ctrl+C to stop the server.
echo.
call npm start
