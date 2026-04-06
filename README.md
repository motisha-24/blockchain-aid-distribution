# Blockchain and Fingerprint-Backed Transparent Aid Distribution System

**Author:** Motisha John Mafukashe — R2211825P  
**Institution:** [Midlands State University]  
**Year:** 2026  
**Module:** Computer Systems Engineering — Capstone Project

---

## Project Overview

A blockchain-based aid distribution system that integrates
hardware-based biometric authentication with Ethereum smart
contracts to ensure transparent, tamper-proof, and fair
distribution of humanitarian aid in Zimbabwe.

---

## System Architecture
```
ESP32 + R307 Fingerprint Sensor
         ↓
    Flask REST API (Python)
         ↓
  Ethereum Smart Contracts (Solidity)
         ↓
      Ganache / Infura
         ↓
   React Dashboard (NGO / Donor / Auditor / Admin)
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| Hardware | ESP32-WROOM, R307 Fingerprint, SIM800L GSM |
| Smart Contracts | Solidity 0.8.19, Truffle, Ganache |
| Backend API | Python 3.10+, Flask, Web3.py |
| Frontend | React, Recharts, React Router |
| Database | SQLite (user accounts) |
| Blockchain | Ethereum (local Ganache / Infura Sepolia) |

---

## Installation — Dual Network Support

AidChain supports both **LOCAL development** (Ganache) and **CLOUD production** (Sepolia) networks.

### Prerequisites
- Python 3.10+
- Node.js v18+
- Truffle Suite
- Ganache (for local development)

### Quick Setup (Recommended)

#### Option 1: Local Development (Ganache)
```bash
# One-command setup for local development
setup-blockchain.bat
```

This will:
- Install all dependencies
- Start Ganache blockchain
- Deploy contracts to local network
- Save contract addresses

#### Option 2: Cloud Production (Sepolia)
```bash
# Install dependencies
npm install

# Deploy to Sepolia testnet
npm run deploy:sepolia
```

### Manual Setup

#### Step 1 — Install Dependencies
```bash
# Python dependencies
pip install -r flask_api/requirements.txt

# Blockchain dependencies
npm install
```

#### Step 2 — Configure Environment
Copy and configure environment files:

**For Local Development:**
```bash
cd flask_api
cp .env.example .env
# Edit .env to set MODE=LOCAL
```

**For Cloud Production:**
```bash
cd flask_api
cp .env.example .env
# Edit .env to set MODE=CLOUD
# Add your INFURA_URL and PRIVATE_KEY
```

#### Step 3 — Deploy Smart Contracts

**Local Network:**
```bash
# Start Ganache first
npm run ganache

# Deploy contracts
npm run deploy:local
```

**Sepolia Network:**
```bash
# Deploy to testnet
npm run deploy:sepolia
```

#### Step 4 — Update Contract Addresses
After deployment, update your `.env` file with the deployed addresses from:
- `deployed-addresses-development.json` (local)
- `deployed-addresses-sepolia.json` (cloud)

#### Step 5 — Start the System
```bash
# Terminal 1 — Start Flask API
cd flask_api && python app.py

# Terminal 2 — Start React Dashboard
cd dashboard && npm start

# Terminal 3 — Ganache (if using local mode)
# Already running from setup script
```

---

## Default Login Credentials

| Role | Username | Password |
|---|---|---|
| Admin | admin | admin2024 |
| NGO | ngo_officer | ngo2024 |
| Donor | donor_view | donor2024 |
| Auditor | auditor_01 | audit2024 |

---

## Project Structure
```
blockchain-aid-distribution/
├── contracts/              ← Solidity smart contracts
├── migrations/             ← Truffle deployment scripts
├── flask_api/              ← Python Flask REST API
│   ├── app.py
│   ├── blockchain.py
│   ├── cache.py
│   ├── sms.py
│   ├── database.py
│   └── config.py
├── dashboard/              ← React frontend
│   └── src/
│       ├── pages/
│       ├── components/
│       └── services/
├── config.py
├── truffle-config.js
└── README.md
