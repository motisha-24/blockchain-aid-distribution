# ================================================================
#  config.py — Central Configuration
#  Switch MODE to change between LOCAL and CLOUD blockchain
#  Author: Motisha John Mafukashe — R2211825P
# ================================================================

import os
from env_loader import get_setting

# ── MODE SWITCH ──────────────────────────────────────────────────
# Change to "CLOUD" when using Alchemy Sepolia
# Change to "LOCAL" when using Ganache
MODE = (
    get_setting("BLOCKCHAIN_MODE", "MODE")
    or "CLOUD"
).strip().upper()
if MODE not in {"LOCAL", "CLOUD"}:
    print(f"[CONFIG] WARNING: Invalid blockchain mode '{MODE}', defaulting to CLOUD")
    MODE = "CLOUD"

# ── Local Ganache Settings ───────────────────────────────────────
LOCAL_RPC              = get_setting("LOCAL_RPC", default="http://127.0.0.1:7545")
LOCAL_REGISTRY_ADDRESS = get_setting("LOCAL_REGISTRY_ADDRESS")
LOCAL_AID_ADDRESS      = get_setting("LOCAL_AID_ADDRESS")
LOCAL_CHAIN_ID         = 1337

# ── Cloud Alchemy Sepolia Settings ───────────────────────────────
CLOUD_RPC = (
    get_setting("CLOUD_RPC")
    or get_setting("ALCHEMY_URL")
    or get_setting("INFURA_URL")
    or get_setting("RPC_URL")
)
CLOUD_REGISTRY_ADDRESS = get_setting("CLOUD_REGISTRY_ADDRESS")
CLOUD_AID_ADDRESS      = get_setting("CLOUD_AID_ADDRESS")
CLOUD_CHAIN_ID         = 11155111

# ── Wallet ────────────────────────────────────────────────────────
if MODE == "LOCAL":
    PRIVATE_KEY = get_setting("LOCAL_PRIVATE_KEY", "PRIVATE_KEY")
else:
    PRIVATE_KEY = get_setting("PRIVATE_KEY", "LOCAL_PRIVATE_KEY")

# ── Auto select based on MODE ────────────────────────────────────
if MODE == "LOCAL":
    RPC_URL          = LOCAL_RPC
    REGISTRY_ADDRESS = LOCAL_REGISTRY_ADDRESS
    AID_ADDRESS      = LOCAL_AID_ADDRESS
    CHAIN_ID         = LOCAL_CHAIN_ID
    print("[CONFIG] Mode     : LOCAL — Ganache")
else:
    RPC_URL          = CLOUD_RPC
    REGISTRY_ADDRESS = CLOUD_REGISTRY_ADDRESS
    AID_ADDRESS      = CLOUD_AID_ADDRESS
    CHAIN_ID         = CLOUD_CHAIN_ID
    print("[CONFIG] Mode     : CLOUD — Alchemy Sepolia")

print(f"[CONFIG] RPC      : {RPC_URL}")
print(f"[CONFIG] Registry : {REGISTRY_ADDRESS}")
print(f"[CONFIG] Aid      : {AID_ADDRESS}")
print(f"[CONFIG] Chain ID : {CHAIN_ID}")

# ── Validation warnings ───────────────────────────────────────────
if not PRIVATE_KEY:
    print("[CONFIG] WARNING: PRIVATE_KEY not set in .env")
if not RPC_URL:
    print("[CONFIG] WARNING: RPC URL not set in .env")
if not REGISTRY_ADDRESS:
    print("[CONFIG] WARNING: REGISTRY_ADDRESS not set in .env")
if not AID_ADDRESS:
    print("[CONFIG] WARNING: AID_ADDRESS not set in .env")
