@echo off
REM ================================================================
REM  switch-network.bat — Switch between LOCAL and CLOUD networks
REM  Author: Motisha John Mafukashe — R2211825P
REM ================================================================

if "%1"=="" (
    echo Usage: switch-network.bat [local^|cloud]
    echo.
    echo Examples:
    echo   switch-network.bat local   - Switch to Ganache development
    echo   switch-network.bat cloud   - Switch to Sepolia production
    echo.
    goto :eof
)

cd flask_api

if "%1"=="local" (
    echo 🔄 Switching to LOCAL (Ganache) mode...
    powershell -Command "(Get-Content .env) -replace '^MODE=.*', 'MODE=LOCAL' | Set-Content .env"
    echo ✅ Switched to LOCAL mode
    echo.
    echo 📋 Make sure Ganache is running on http://127.0.0.1:7545
    echo 📋 Contract addresses should be in deployed-addresses-development.json
    goto :check_addresses
)

if "%1"=="cloud" (
    echo 🔄 Switching to CLOUD (Sepolia) mode...
    powershell -Command "(Get-Content .env) -replace '^MODE=.*', 'MODE=CLOUD' | Set-Content .env"
    echo ✅ Switched to CLOUD mode
    echo.
    echo ⚠️  Make sure you have set INFURA_URL and PRIVATE_KEY in .env
    echo 📋 Contract addresses should be in deployed-addresses-sepolia.json
    goto :check_addresses
)

echo ❌ Invalid option. Use 'local' or 'cloud'
goto :eof

:check_addresses
echo.
echo 📍 Current contract addresses in .env:
findstr "ADDRESS" .env
echo.
echo 🚀 Restart your Flask API to apply changes
echo    python app.py
echo.