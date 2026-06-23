# 🌍 AidChain — Blockchain & Biometric Aid Distribution System

<div align="center">

![Solidity](https://img.shields.io/badge/Solidity-0.8.19-363636?style=for-the-badge&logo=solidity)
![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![React Native](https://img.shields.io/badge/React_Native-Expo-0088CC?style=for-the-badge&logo=react&logoColor=white)
![Ethereum](https://img.shields.io/badge/Ethereum-Sepolia-3C3C3D?style=for-the-badge&logo=ethereum)
![Arduino](https://img.shields.io/badge/ESP32-Arduino-00979D?style=for-the-badge&logo=arduino&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-REST_API-000000?style=for-the-badge&logo=flask)

**A dissertation capstone project** — Eliminating aid fraud and double-collection through blockchain immutability and biometric authentication.

*Author: Motisha John Mafukashe — R2211825P | Midlands State University | 2026*

</div>

---

## 🎯 Problem Statement

Humanitarian aid distribution in Zimbabwe suffers from:
- **Double-collection fraud** — beneficiaries collecting aid multiple times per cycle
- **Ghost beneficiaries** — fraudulent entries in paper-based registries
- **Zero accountability** — no immutable audit trail for NGO officers
- **Manual verification failures** — ID card fraud is easily executed

**AidChain** solves all of these through fingerprint biometrics + Ethereum smart contracts.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 🔐 **Biometric Auth** | AS608 fingerprint sensor — zero password, zero card fraud |
| ⛓️ **Blockchain Ledger** | Every distribution recorded immutably on Ethereum |
| 🚫 **Duplicate Prevention** | Smart contract rejects double-collection per aid type per cycle |
| 📱 **Offline Mobile App** | React Native app with offline-first SQLite sync engine |
| 📊 **Multi-Role Dashboard** | Separate views for Admin, NGO Officer, Donor, and Auditor |
| 📲 **SMS Notifications** | SIM800L GSM module sends SMS receipt after every distribution |
| 🌐 **Dual Network** | Local (Ganache) and cloud (Ethereum Sepolia) support |
| 🔄 **Auto Enrollment** | Field device polls for fingerprint enrollment jobs remotely |

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FIELD DEVICE                            │
│  ESP32-WROOM-32                                                 │
│  ├── AS608 Fingerprint Sensor (UART2 @ GPIO 16/17)             │
│  ├── SIM800L GSM Module (UART1 @ GPIO 18/19)                   │
│  └── Status LEDs (GPIO 21=Green, GPIO 22=Red)                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP/REST (WiFi)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     FLASK REST API (Python)                     │
│  ├── JWT Authentication for hardware devices                    │
│  ├── Fingerprint verification & enrollment orchestration        │
│  ├── Blockchain interaction via Web3.py                        │
│  ├── Offline transaction cache (JSON)                           │
│  └── SMS queue management (SIM800L + Cloud fallback)           │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Web3.py
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│               ETHEREUM SMART CONTRACTS (Solidity)               │
│  ├── BeneficiaryRegistry.sol — On-chain identity management    │
│  └── AidDistribution.sol — Immutable distribution ledger       │
│                                                                 │
│  Deployed on: Ganache (local) | Sepolia testnet (cloud)        │
└────────────────┬────────────────────────────┬───────────────────┘
                 │                            │
    ┌────────────▼────────────┐  ┌────────────▼────────────┐
    │  React Dashboard (Web)  │  │  React Native App (Mobile)│
    │  ├── Admin panel        │  │  ├── Offline-first SQLite │
    │  ├── NGO officer view   │  │  ├── Background sync      │
    │  ├── Donor view         │  │  ├── Manual distribution  │
    │  └── Auditor audit log  │  │  └── Beneficiary lookup   │
    └─────────────────────────┘  └───────────────────────────┘
```

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Hardware** | ESP32-WROOM-32 | Main microcontroller |
| **Biometrics** | AS608 Fingerprint Sensor | Identity verification |
| **GSM** | SIM800L | SMS receipts to beneficiaries |
| **Smart Contracts** | Solidity 0.8.19 | Immutable on-chain ledger |
| **Blockchain Tools** | Truffle, Ganache | Development & deployment |
| **Blockchain Network** | Ethereum Sepolia | Production testnet |
| **Backend** | Python 3.10+, Flask | REST API server |
| **Web3 Bridge** | Web3.py | Python ↔ Ethereum |
| **Frontend** | React 18, Recharts | NGO/Auditor web dashboard |
| **Mobile** | React Native, Expo | Field officer mobile app |
| **Database** | SQLite (local), SQLite (mobile) | User accounts & offline cache |
| **Auth** | JWT (RS256) | Stateless API authentication |

---

## 📸 Screenshots

| System View | Preview |
|---|---|
| ESP32 Auth Flow | ![Auth Flow](screenshots/esp32_fingerprint_auth_loop.png) |
| Flask Distribute Endpoint | ![Flask API](screenshots/flask_api_distribute_endpoint.png) |
| Mobile Offline Sync Engine | ![Mobile Sync](screenshots/mobile_offline_sync_engine.png) |
| BeneficiaryRegistry Contract | ![Smart Contract](screenshots/beneficiaryregistry_register_beneficiary.png) |

---

## 📂 Project Structure

```
blockchain-aid-distribution/
│
├── contracts/                    ← Solidity smart contracts
│   ├── AidDistribution.sol       ← Main distribution ledger (271 lines)
│   └── BeneficiaryRegistry.sol   ← On-chain identity store (185 lines)
│
├── migrations/                   ← Truffle deployment scripts
│
├── flask_api/                    ← Python Flask REST API
│   ├── app.py                    ← 74KB — All API endpoints
│   ├── blockchain.py             ← Web3.py blockchain interface
│   ├── database.py               ← SQLite ORM layer
│   ├── cache.py                  ← Offline transaction cache
│   ├── sms.py                    ← GSM/Cloud SMS service
│   ├── config.py                 ← Environment configuration
│   └── .env.example              ← Environment template
│
├── dashboard/                    ← React web dashboard
│   └── src/
│       ├── pages/                ← Admin, NGO, Donor, Auditor pages
│       ├── components/           ← Reusable UI components
│       └── services/             ← API client services
│
├── mobile_app/                   ← React Native (Expo) mobile app
│   └── src/
│       ├── screens/              ← App screens
│       ├── sync/                 ← Offline sync engine
│       ├── storage/              ← SQLite local storage
│       ├── api/                  ← API client
│       └── navigation/           ← React Navigation setup
│
├── hardware/
│   └── firmware/
│       └── firmware.ino          ← ESP32 firmware (1667 lines, C++)
│
├── screenshots/                  ← Architecture diagrams & demo images
├── truffle-config.js             ← Truffle network configuration
├── setup-blockchain.bat          ← One-command local setup
└── requirements.txt              ← Python dependencies
```

---

## ⚙️ Setup & Installation

### Prerequisites
- Python 3.10+
- Node.js v18+
- Truffle Suite (`npm install -g truffle`)
- Ganache (for local development)
- Arduino IDE with ESP32 board support (for firmware)

### Option 1 — Local Development (Ganache)

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/blockchain-aid-distribution.git
cd blockchain-aid-distribution

# One-command setup (Windows)
setup-blockchain.bat
```

This script will:
1. Install all Node.js dependencies
2. Start Ganache local blockchain
3. Compile and deploy smart contracts
4. Save deployed contract addresses

```bash
# Terminal 1 — Start Flask API
cd flask_api
cp .env.example .env        # Configure your environment
pip install -r requirements.txt
python app.py

# Terminal 2 — Start React Dashboard
cd dashboard
npm install
npm start
```

### Option 2 — Sepolia Testnet (Cloud)

```bash
# Install dependencies
npm install

# Configure .env with your Infura/Alchemy URL and wallet private key
cp .env.example .env

# Deploy to Sepolia
npm run deploy:sepolia

# Start Flask API in cloud mode
cd flask_api && python app.py
```

### ESP32 Firmware Upload

1. Open `hardware/firmware/firmware.ino` in Arduino IDE
2. Update WiFi credentials and API base URL at the top of the file
3. Install required libraries: `Adafruit_Fingerprint`, `ArduinoJson`, `WiFi`, `HTTPClient`
4. Select Board: `ESP32 Dev Module`
5. Upload firmware

> ⚠️ **Before uploading firmware**: Update `WIFI_SSID`, `WIFI_PASSWORD`, and `API_BASE_URL` constants. Never commit real credentials.

---

## 🔑 Default Demo Credentials

> These are for demo/testing purposes only. Change immediately in production.

| Role | Username | Password | Access |
|---|---|---|---|
| Admin | `admin` | `admin2024` | Full system control |
| NGO Officer | `ngo_officer` | `ngo2024` | Distribution management |
| Donor | `donor_view` | `donor2024` | Read-only analytics |
| Auditor | `auditor_01` | `audit2024` | Immutable audit trail |

---

## 🔐 Smart Contract Details

### `BeneficiaryRegistry.sol`
- Stores beneficiary identity data on-chain (name, national ID, phone, location)
- `registerBeneficiary()` — Owner-only registration
- `isRegistered()` / `isActive()` — Used by AidDistribution for validation
- Emits `BeneficiaryRegistered`, `BeneficiaryDeactivated`, `BeneficiaryReactivated` events

### `AidDistribution.sol`
- Records every aid transaction immutably on the blockchain
- Supports: `CASH (USD)`, `MAIZE (KG)`, `OIL (LITRES)`, `SEEDS (PACKETS)`, `CLOTHES (UNITS)`, `FERTILISER (KG)`, `BLANKETS (UNITS)`
- **Duplicate guard**: Nested mapping `beneficiaryId → cycle → aidType → bool` prevents double-collection
- `distribute()` — Officer-only, called by Flask API after fingerprint match
- `advanceCycle()` — Owner resets cycle to start new distribution round
- Emits `AidDistributed`, `DuplicateAttempt`, `CycleAdvanced` events

---

## 🌱 Environment Variables

Copy `flask_api/.env.example` to `flask_api/.env`:

```env
# Blockchain Mode: LOCAL or CLOUD
MODE=LOCAL

# Local Ganache (development)
LOCAL_RPC=http://127.0.0.1:7545
LOCAL_REGISTRY_ADDRESS=<deployed_address>
LOCAL_AID_ADDRESS=<deployed_address>

# Cloud Sepolia (production)
INFURA_URL=https://eth-sepolia.g.alchemy.com/v2/<YOUR_KEY>
CLOUD_REGISTRY_ADDRESS=<deployed_address>
CLOUD_AID_ADDRESS=<deployed_address>

# Wallet (NEVER commit your real private key)
PRIVATE_KEY=<your_wallet_private_key>

# JWT
JWT_SECRET=<your_random_secret>
JWT_EXP_DELTA_SECONDS=1800
```

---

## 🔒 Security Notes

- `.env` is in `.gitignore` — API keys and private keys are **never committed**
- `users.db` (SQLite database with hashed passwords) is in `.gitignore`
- `offline_cache.json` (encrypted transactions) is in `.gitignore`
- ESP32 firmware credentials should be updated before each deployment
- JWT tokens expire after 30 minutes (configurable)

---

## 📜 License

This project is a dissertation capstone submitted to **Midlands State University** for the degree of BSc Computer Systems Engineering.

**Author:** Motisha John Mafukashe — Student No. R2211825P

---

<div align="center">
Built with ❤️ to solve real humanitarian challenges in Zimbabwe
</div>
