# ================================================================
#  config.py — Central Configuration
#  Author: Motisha John Mafukashe — R2211825P
# ================================================================

import os
from dotenv import load_dotenv

load_dotenv()

# ── Mode: LOCAL or CLOUD ─────────────────────────────────────
MODE = "LOCAL"

# ── Local Ganache ─────────────────────────────────────────────
LOCAL_RPC      = os.getenv("LOCAL_RPC", "http://127.0.0.1:7545")
LOCAL_CHAIN_ID = 1337

# ── Auto select ───────────────────────────────────────────────
RPC_URL  = LOCAL_RPC
CHAIN_ID = LOCAL_CHAIN_ID

# ── Contract addresses ────────────────────────────────────────
REGISTRY_ADDRESS = os.getenv("LOCAL_REGISTRY_ADDRESS")
AID_ADDRESS      = os.getenv("LOCAL_AID_ADDRESS")

# ── Wallet ────────────────────────────────────────────────────
PRIVATE_KEY      = os.getenv("PRIVATE_KEY")

print(f"[CONFIG] Mode    : {MODE}")
print(f"[CONFIG] RPC     : {RPC_URL}")
print(f"[CONFIG] Registry: {REGISTRY_ADDRESS}")
print(f"[CONFIG] Aid     : {AID_ADDRESS}")