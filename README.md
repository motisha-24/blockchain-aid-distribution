# Blockchain and Fingerprint-Backed Transparent Aid Distribution System

**Author:** Motisha John Mafukashe — R2211825P  
**Institution:** [Your University Name]  
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

## Installation — Local Development

### Prerequisites
- Python 3.10+
- Node.js v18+
- Ganache
- Truffle

### Step 1 — Clone the repository
```bash
git clone https://github.com/YourUsername/blockchain-aid-distribution.git
cd blockchain-aid-distribution
```

### Step 2 — Install Python dependencies
```bash
pip install flask web3 python-dotenv pycryptodome firebase-admin flask-cors
```

### Step 3 — Install Node dependencies
```bash
npm install -g truffle
cd dashboard && npm install
```

### Step 4 — Configure environment
Create a `.env` file in the root folder:
```
LOCAL_RPC=http://127.0.0.1:7545
LOCAL_REGISTRY_ADDRESS=your_registry_contract_address
LOCAL_AID_ADDRESS=your_aid_contract_address
PRIVATE_KEY=your_ganache_account_private_key
```

### Step 5 — Deploy smart contracts
```bash
truffle compile
truffle migrate --network development
```

### Step 6 — Start the system
Open three terminals:
```bash
# Terminal 1 — Start Ganache (open the app)

# Terminal 2 — Start Flask API
python flask_api/app.py

# Terminal 3 — Start React Dashboard
cd dashboard && npm start
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
