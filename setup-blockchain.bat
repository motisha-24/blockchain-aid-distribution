@echo off
REM ================================================================
REM  setup-blockchain.bat — Complete AidChain blockchain setup
REM  Supports both LOCAL Ganache and CLOUD Sepolia deployment
REM  Author: Motisha John Mafukashe — R2211825P
REM ================================================================

echo.
echo ========================================
echo    AidChain Blockchain Setup
echo ========================================
echo.

echo [1/4] Installing blockchain dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)
echo ✅ Dependencies installed
echo.

echo [2/4] Compiling smart contracts...
call npx truffle compile
if %errorlevel% neq 0 (
    echo ❌ Failed to compile contracts
    pause
    exit /b 1
)
echo ✅ Contracts compiled
echo.

echo [3/4] Starting Ganache (local blockchain)...
start "Ganache" cmd /k "npm run ganache"
timeout /t 5 /nobreak > nul
echo ✅ Ganache started (check the new window)
echo.

echo [4/4] Deploying contracts to local network...
call npm run deploy:local
if %errorlevel% neq 0 (
    echo ❌ Failed to deploy to local network
    pause
    exit /b 1
)
echo ✅ Contracts deployed to local network
echo.

echo.
echo ========================================
echo         Setup Complete!
echo ========================================
echo.
echo 📋 Contract addresses saved to:
echo    deployed-addresses-development.json
echo.
echo 🔄 To switch to Sepolia (production):
echo    1. Set MODE=CLOUD in flask_api/.env
echo    2. Add your INFURA_URL and PRIVATE_KEY
echo    3. Run: npm run deploy:sepolia
echo.
echo 🚀 Your AidChain system now supports both:
echo    • LOCAL: Ganache development network
echo    • CLOUD: Sepolia testnet
echo.
pause