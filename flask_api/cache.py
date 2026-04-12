# ================================================================
#  cache.py — Offline Transaction Cache (Firebase simulation)
#  Updated to support aid types, units and location
#  Author: Motisha John Mafukashe — R2211825P
# ================================================================

import json
import os
import time
from Crypto.Cipher   import AES
from Crypto.Util.Padding import pad, unpad
import hashlib
from database import release_campaign_budget
from env_loader import get_setting

# ── Cache file location ───────────────────────────────────────
CACHE_FILE = os.path.join(
    os.path.dirname(__file__), "offline_cache.json"
)

# ── AES-256 encryption key ────────────────────────────────────
CACHE_SECRET = get_setting("CACHE_SECRET", prefer="local")
if not CACHE_SECRET:
    print("[ERROR] CACHE_SECRET not set in environment variables")
    exit(1)
SECRET_KEY = hashlib.sha256(CACHE_SECRET.encode()).digest()


# ── FUNCTION: Encrypt data ────────────────────────────────────
def encrypt_data(data: str) -> str:
    cipher   = AES.new(SECRET_KEY, AES.MODE_CBC)
    ct_bytes = cipher.encrypt(pad(data.encode(), AES.block_size))
    iv_hex   = cipher.iv.hex()
    ct_hex   = ct_bytes.hex()
    return iv_hex + ":" + ct_hex


# ── FUNCTION: Decrypt data ────────────────────────────────────
def decrypt_data(encrypted: str) -> str:
    iv_hex, ct_hex = encrypted.split(":")
    iv     = bytes.fromhex(iv_hex)
    ct     = bytes.fromhex(ct_hex)
    cipher = AES.new(SECRET_KEY, AES.MODE_CBC, iv)
    pt     = unpad(cipher.decrypt(ct), AES.block_size)
    return pt.decode()


# ── FUNCTION: Load cache from file ────────────────────────────
def load_cache() -> list:
    if not os.path.exists(CACHE_FILE):
        return []
    with open(CACHE_FILE, "r") as f:
        return json.load(f)


# ── FUNCTION: Save cache to file ──────────────────────────────
def save_cache(cache: list):
    with open(CACHE_FILE, "w") as f:
        json.dump(cache, f, indent=2)


# ── FUNCTION: Add transaction to cache ────────────────────────
# Updated: now stores aid_type, aid_unit and location
# These are needed when syncing back to blockchain
def cache_transaction(beneficiary_id, amount, aid_type,
                      aid_unit, location, officer_id,
                      campaign_id=None):
    cache = load_cache()

    # Payload to encrypt — sensitive transaction data
    payload = {
        "beneficiary_id": beneficiary_id,
        "amount"        : amount,
        "aid_type"      : aid_type.upper(),
        "aid_unit"      : aid_unit.upper(),
        "location"      : location,
        "campaign_id"   : campaign_id,
        "timestamp"     : int(time.time())
    }

    tx = {
        "id"            : len(cache) + 1,
        "beneficiary_id": beneficiary_id,
        "amount"        : amount,
        "aid_type"      : aid_type.upper(),
        "aid_unit"      : aid_unit.upper(),
        "location"      : location,
        "campaign_id"   : campaign_id,
        "officer_id"    : officer_id,
        "timestamp"     : int(time.time()),
        "status"        : "PENDING",
        "tx_hash"       : None,
        "encrypted"     : encrypt_data(json.dumps(payload))
    }

    cache.append(tx)
    save_cache(cache)

    print(f"[CACHE] Cached — ID:{tx['id']} "
          f"| {aid_type.upper()} {amount} {aid_unit.upper()} "
          f"| Beneficiary:{beneficiary_id} "
          f"| Status:PENDING")

    return tx


# ── FUNCTION: Get all pending transactions ────────────────────
def get_pending() -> list:
    cache = load_cache()
    return [tx for tx in cache if tx["status"] == "PENDING"]


# ── FUNCTION: Get all transactions (for dashboard) ────────────
def get_all_cached() -> list:
    return load_cache()


# ── FUNCTION: Mark transaction as confirmed ───────────────────
def confirm_transaction(cache_id: int, tx_hash: str):
    cache = load_cache()
    for tx in cache:
        if tx["id"] == cache_id:
            tx["status"]  = "CONFIRMED"
            tx["tx_hash"] = tx_hash
            break
    save_cache(cache)
    print(f"[CACHE] TX {cache_id} confirmed — Hash: {tx_hash[:20]}...")


# ── FUNCTION: Mark transaction as failed ─────────────────────
def fail_transaction(cache_id: int, error: str):
    cache = load_cache()
    for tx in cache:
        if tx["id"] == cache_id:
            tx["status"] = "FAILED"
            tx["error"]  = error
            break
    save_cache(cache)
    print(f"[CACHE] TX {cache_id} marked as FAILED — {error}")


# ── FUNCTION: Sync pending transactions to blockchain ─────────
# Updated: passes aid_type, aid_unit and location to distribute_aid
def sync_pending_to_blockchain():
    from blockchain import distribute_aid

    pending = get_pending()

    if not pending:
        print("[SYNC] No pending transactions to sync.")
        return {
            "synced"       : 0,
            "failed"       : 0,
            "total_pending": 0
        }

    synced = 0
    failed = 0

    print(f"[SYNC] Found {len(pending)} pending transactions...")

    for tx in pending:
        print(f"[SYNC] Syncing TX {tx['id']} — "
              f"{tx['aid_type']} {tx['amount']} "
              f"{tx['aid_unit']} for "
              f"beneficiary {tx['beneficiary_id']}...")

        result = distribute_aid(
            tx["beneficiary_id"],
            tx["amount"],
            tx["aid_type"],
            tx["aid_unit"],
            tx["location"]
        )

        if result["success"]:
            confirm_transaction(tx["id"], result["tx_hash"])
            synced += 1
            print(f"[SYNC] ✓ TX {tx['id']} synced "
                  f"→ Hash: {result['tx_hash'][:20]}...")
        else:
            if tx.get("campaign_id"):
                release_campaign_budget(tx["campaign_id"], tx["amount"])
            fail_transaction(tx["id"], result["error"])
            failed += 1
            print(f"[SYNC] ✗ TX {tx['id']} failed "
                  f"→ {result['error']}")

    print(f"[SYNC] Complete — Synced:{synced} Failed:{failed}")

    return {
        "synced"       : synced,
        "failed"       : failed,
        "total_pending": len(pending)
    }


# ── FUNCTION: Clear entire cache ─────────────────────────────
def clear_cache():
    save_cache([])
    print("[CACHE] Cache cleared.")
    return {"success": True, "message": "Cache cleared"}
