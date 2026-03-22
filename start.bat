@echo off
echo ================================================
echo   AidChain Zimbabwe — Starting System
echo   Author: Motisha John Mafukashe R2211825P
echo ================================================
echo.

echo [1/2] Starting Flask API...
start "Flask API" cmd /k "cd /d %~dp0flask_api && python app.py"

timeout /t 3 /nobreak > nul

echo [2/2] Starting React Dashboard...
start "React Dashboard" cmd /k "cd /d %~dp0dashboard && npm start"

echo.
echo ================================================
echo   System starting...
echo   Flask API  : http://127.0.0.1:5000
echo   Dashboard  : http://localhost:3000
echo   Remember to open Ganache if using LOCAL mode
echo ================================================