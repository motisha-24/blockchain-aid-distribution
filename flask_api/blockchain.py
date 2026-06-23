# ================================================================
#  blockchain.py — Web3 Connection and Contract Interaction
#  Updated to support aid types, units and location tracking
#  Author: Motisha John Mafukashe — R2211825P
# ================================================================

import json
import os
import re
import time
from web3 import Web3
from web3._utils.events import EventLogErrorFlags
from config import RPC_URL, REGISTRY_ADDRESS, AID_ADDRESS, PRIVATE_KEY, CHAIN_ID

# ── Caching Layer Setup ───────────────────────────────────────
_tx_cache = {}        # tx_id -> transaction details (immutable, cache forever)
_bene_cache = {}      # b_id -> beneficiary details (partially mutable)
_temp_cache = {}      # key -> (value, expiry_timestamp)

def get_temp_cached(key, max_age_seconds=5):
    if key in _temp_cache:
        val, expiry = _temp_cache[key]
        if time.time() < expiry:
            return val
    return None

def set_temp_cached(key, val, max_age_seconds=5):
    _temp_cache[key] = (val, time.time() + max_age_seconds)

# ── Connect to blockchain node ────────────────────────────────
w3 = Web3(Web3.HTTPProvider(RPC_URL)) if RPC_URL else Web3()

# Monkey-patch w3.is_connected to cache the connection check for 10 seconds
if hasattr(w3, 'is_connected'):
    _orig_is_connected = w3.is_connected
    _is_connected_cache = {"status": None, "expiry": 0}
    
    def cached_is_connected(*args, **kwargs):
        now = time.time()
        if _is_connected_cache["status"] is not None and now < _is_connected_cache["expiry"]:
            return _is_connected_cache["status"]
        try:
            status = _orig_is_connected(*args, **kwargs)
        except Exception:
            status = False
        _is_connected_cache["status"] = status
        _is_connected_cache["expiry"] = now + 10  # Cache for 10 seconds
        return status
        
    w3.is_connected = cached_is_connected

if w3.is_connected():
    print("[BLOCKCHAIN] Connected to node:", RPC_URL)
else:
    print("[BLOCKCHAIN] ERROR: Cannot connect to blockchain node")

# ── Clean blockchain error messages ──────────────────────────
def clean_blockchain_error(e):
    err_msg = str(e)
    if "Beneficiary not registered" in err_msg:
        return "Beneficiary not registered"
    if "Beneficiary already registered" in err_msg or "already registered" in err_msg.lower():
        return "Beneficiary is already registered"
    if "Beneficiary is inactive" in err_msg:
        return "Beneficiary is deactivated / inactive"
    if "Already collected" in err_msg or "duplicate" in err_msg.lower():
        return "Beneficiary already received this aid type in the current cycle"
    
    match = re.search(r"execution reverted:\s*([^'\",\)]+)", err_msg)
    if match:
        return match.group(1).strip()
        
    return err_msg

# ── Load contract ABIs from build folder ─────────────────────
BASE_DIR  = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD_DIR = os.path.join(BASE_DIR, "build", "contracts")

def load_contract(contract_name, address):
    if not address:
        print(f"[BLOCKCHAIN] WARNING: {contract_name} address not configured")
        return None

    abi_path = os.path.join(BUILD_DIR, f"{contract_name}.json")
    with open(abi_path) as f:
        artifact = json.load(f)
    return w3.eth.contract(
        address=Web3.to_checksum_address(address),
        abi=artifact["abi"]
    )

# ── Initialise contracts ──────────────────────────────────────
registry_contract = load_contract("BeneficiaryRegistry", REGISTRY_ADDRESS)
aid_contract      = load_contract("AidDistribution",     AID_ADDRESS)

# ── Get deployer account ──────────────────────────────────────
account = None
if PRIVATE_KEY:
    try:
        account = w3.eth.account.from_key(PRIVATE_KEY)
        print("[BLOCKCHAIN] Wallet address:", account.address)
    except Exception as e:
        print(f"[BLOCKCHAIN] ERROR: Invalid PRIVATE_KEY - {e}")
else:
    print("[BLOCKCHAIN] WARNING: Wallet not configured")


# ── HELPER: Build and send a transaction ─────────────────────
def send_transaction(contract_function, wait_for_receipt=True, manual_nonce=None):
    if not w3.is_connected():
        return {"success": False, "error": "Blockchain node is not reachable"}
    if account is None:
        return {"success": False, "error": "PRIVATE_KEY is missing or invalid"}

    try:
        if manual_nonce is not None:
            nonce = manual_nonce
        else:
            nonce = w3.eth.get_transaction_count(account.address)
            
        gas_price = int(w3.eth.gas_price * 1.1) # Bump by 10% for priority
        tx    = contract_function.build_transaction({
            "gas"     : 400000,
            "gasPrice": gas_price,
            "nonce"   : nonce,
            "from"    : account.address,
            "chainId" : int(CHAIN_ID),
        })
        signed  = w3.eth.account.sign_transaction(tx, PRIVATE_KEY)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        
        if not wait_for_receipt:
            return {
                "success" : True,
                "tx_hash" : tx_hash.hex(),
                "block"   : 0,
                "status"  : 1 # Assume success for pending
            }

        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        return {
            "success" : True,
            "tx_hash" : tx_hash.hex(),
            "block"   : receipt.blockNumber,
            "status"  : receipt.status   # 1 = success, 0 = failed
        }
    except Exception as e:
        # Include detailed debug context
        bal = "N/A"
        try:
            bal = w3.eth.get_balance(account.address)
        except:
            pass
        err_msg = str(e)
        debug_info = f" | Debug: Addr={account.address}, Bal={bal}, Chain={CHAIN_ID}, RPC={RPC_URL}, Mode={os.environ.get('BLOCKCHAIN_MODE', 'NOT_SET')}"
        return {"success": False, "error": err_msg + debug_info}


# ================================================================
#  BENEFICIARY FUNCTIONS
# ================================================================

# ── Register a new beneficiary ────────────────────────────────
# Updated: now includes national_id and location fields
def register_beneficiary(b_id, name, national_id, phone, location):
    try:
        # Check if already registered before sending transaction
        if b_id in _bene_cache:
            return {
                "success": False,
                "error"  : f"Beneficiary ID {b_id} is already registered"
            }
            
        already = registry_contract.functions.isRegistered(b_id).call()
        if already:
            return {
                "success": False,
                "error"  : f"Beneficiary ID {b_id} is already registered"
            }

        fn = registry_contract.functions.registerBeneficiary(
            b_id,
            name,
            national_id,
            phone,
            location
        )
        res = send_transaction(fn)
        if res.get("success") and res.get("status") == 1:
            _temp_cache.pop("total_beneficiaries", None)
            _temp_cache.pop("all_beneficiary_ids", None)
            _bene_cache[b_id] = {
                "success"    : True,
                "name"       : name,
                "national_id": national_id,
                "phone"      : phone,
                "location"   : location,
                "active"     : True
            }
        return res
    except Exception as e:
        error_msg = str(e)
        if "already registered" in error_msg.lower():
            return {
                "success": False,
                "error"  : f"Beneficiary ID {b_id} is already registered"
            }
        return {"success": False, "error": error_msg}


# ── Get beneficiary details ───────────────────────────────────
# Updated: returns national_id and location from updated contract
def get_beneficiary(b_id):
    if b_id in _bene_cache:
        return _bene_cache[b_id]
    try:
        result = registry_contract.functions.getBeneficiary(
            b_id
        ).call()
        data = {
            "success"    : True,
            "name"       : result[0],
            "national_id": result[1],
            "phone"      : result[2],
            "location"   : result[3],
            "active"     : result[4]
        }
        if data["success"] and data["name"]:
            _bene_cache[b_id] = data
        return data
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── Check if beneficiary is registered ───────────────────────
def is_registered(b_id):
    if b_id in _bene_cache:
        return {"success": True, "registered": True}
    try:
        result = registry_contract.functions.isRegistered(
            b_id
        ).call()
        return {"success": True, "registered": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── Deactivate a beneficiary ──────────────────────────────────
def deactivate_beneficiary(b_id):
    try:
        fn = registry_contract.functions.deactivateBeneficiary(b_id)
        res = send_transaction(fn)
        if res.get("success") and res.get("status") == 1:
            if b_id in _bene_cache:
                _bene_cache[b_id]["active"] = False
            else:
                _bene_cache.pop(b_id, None)
        return res
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── Reactivate a beneficiary ──────────────────────────────────
def reactivate_beneficiary(b_id):
    try:
        fn = registry_contract.functions.reactivateBeneficiary(b_id)
        res = send_transaction(fn)
        if res.get("success") and res.get("status") == 1:
            if b_id in _bene_cache:
                _bene_cache[b_id]["active"] = True
            else:
                _bene_cache.pop(b_id, None)
        return res
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── Get total registered beneficiaries ───────────────────────
def get_total_beneficiaries():
    cached = get_temp_cached("total_beneficiaries")
    if cached is not None:
        return cached
    try:
        total = registry_contract.functions.getTotalBeneficiaries().call()
        res = {"success": True, "total": total}
        set_temp_cached("total_beneficiaries", res)
        return res
    except Exception as e:
        return {"success": False, "error": str(e)}


# ================================================================
#  DISTRIBUTION FUNCTIONS
# ================================================================

# ── Distribute aid ────────────────────────────────────────────
# Updated: now accepts aid_type, aid_unit and location
# Examples:
#   distribute_aid(1, 50, "MAIZE",      "KG",      "Gweru Ward 5")
#   distribute_aid(1, 50, "CASH",       "USD",     "Gweru Ward 5")
#   distribute_aid(1, 5,  "OIL",        "LITRES",  "Gweru Ward 5")
#   distribute_aid(1, 3,  "SEEDS",      "PACKETS", "Gweru Ward 5")
#   distribute_aid(1, 2,  "CLOTHES",    "UNITS",   "Gweru Ward 5")
#   distribute_aid(1, 25, "FERTILISER", "KG",      "Gweru Ward 5")
#   distribute_aid(1, 1,  "BLANKETS",   "UNITS",   "Gweru Ward 5")
def distribute_aid(beneficiary_id, amount, aid_type, aid_unit, location, wait_for_receipt=True, manual_nonce=None):
    try:
        fn = aid_contract.functions.distribute(
            beneficiary_id,
            amount,
            aid_type.upper(),    # normalise to uppercase
            aid_unit.upper(),    # normalise to uppercase
            location
        )
        res = send_transaction(fn, wait_for_receipt=wait_for_receipt, manual_nonce=manual_nonce)
        if res.get("success"):
            # Invalidate cached transaction count and collection status
            _temp_cache.pop("total_transactions", None)
            _temp_cache.pop(f"has_collected_{beneficiary_id}_{aid_type.upper()}", None)
            _temp_cache.pop(f"collection_status_{beneficiary_id}", None)
        return res
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── Get transaction details ───────────────────────────────────
# Updated: returns aid_type, aid_unit and location fields
def get_transaction(tx_id):
    if tx_id in _tx_cache:
        return _tx_cache[tx_id]
    try:
        result = aid_contract.functions.getTransaction(tx_id).call()
        data = {
            "success"       : True,
            "beneficiary_id": result[0],
            "amount"        : result[1],
            "aid_type"      : result[2],
            "aid_unit"      : result[3],
            "location"      : result[4],
            "timestamp"     : result[5],
            "cycle"         : result[6],
            "officer"       : result[7],
            "status"        : result[8]
        }
        if data["success"] and data["timestamp"] > 0:
            _tx_cache[tx_id] = data
        return data
    except Exception as e:
        return {"success": False, "error": str(e)}


def get_transaction_by_hash(tx_hash):
    try:
        if not w3.is_connected():
            return {"success": False, "error": "Blockchain node is not reachable"}
        if not AID_ADDRESS:
            return {"success": False, "error": "Aid contract address is not configured"}
        if not isinstance(tx_hash, str) or not re.fullmatch(r"0x[a-fA-F0-9]{64}", tx_hash):
            return {"success": False, "error": "Invalid Ethereum transaction hash"}

        receipt = w3.eth.get_transaction_receipt(tx_hash)
        if not receipt:
            return {"success": False, "error": "Transaction receipt not found"}

        contract_address = Web3.to_checksum_address(AID_ADDRESS)
        matching_logs = [
            log for log in receipt.get("logs", [])
            if log.get("address") == contract_address
        ]
        if not matching_logs:
            return {
                "success": False,
                "error": "Transaction hash does not belong to AidDistribution"
            }

        decoded = aid_contract.events.AidDistributed().process_receipt(
            receipt,
            errors=EventLogErrorFlags.Discard
        )
        if not decoded:
            return {
                "success": False,
                "error": "No AidDistributed event found for this hash"
            }

        tx_id = decoded[0]["args"]["txId"]
        result = get_transaction(tx_id)
        if not result["success"]:
            return result

        result.update({
            "id": tx_id,
            "tx_hash": tx_hash,
            "block_number": receipt.blockNumber,
            "gas_used": receipt.gasUsed
        })
        return result
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── Check if beneficiary collected specific aid this cycle ────
# Updated: now requires aid_type parameter
# A beneficiary can receive MAIZE and CASH in the same cycle
# but cannot receive MAIZE twice in the same cycle
def has_collected(beneficiary_id, aid_type):
    key = f"has_collected_{beneficiary_id}_{aid_type.upper()}"
    cached = get_temp_cached(key)
    if cached is not None:
        return cached
    try:
        result = aid_contract.functions.hasCollectedThisCycle(
            beneficiary_id,
            aid_type.upper()
        ).call()
        res = {"success": True, "collected": result}
        set_temp_cached(key, res)
        return res
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── Check multiple aid types at once ─────────────────────────
# Useful for dashboard to show full collection status
def get_collection_status(beneficiary_id, aid_types):
    key = f"collection_status_{beneficiary_id}"
    cached = get_temp_cached(key)
    if cached is not None:
        return cached
    try:
        result = aid_contract.functions.getCollectionStatus(
            beneficiary_id,
            [t.upper() for t in aid_types]
        ).call()
        res = {
            "success": True,
            "status": {
                aid_types[i]: result[i]
                for i in range(len(aid_types))
            }
        }
        set_temp_cached(key, res)
        return res
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── Get total transactions ────────────────────────────────────
def get_total_transactions():
    cached = get_temp_cached("total_transactions")
    if cached is not None:
        return cached
    try:
        total = aid_contract.functions.getTotalTransactions().call()
        res = {"success": True, "total": total}
        set_temp_cached("total_transactions", res)
        return res
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── Get current distribution cycle ───────────────────────────
def get_current_cycle():
    cached = get_temp_cached("current_cycle")
    if cached is not None:
        return cached
    try:
        cycle = aid_contract.functions.getCurrentCycle().call()
        res = {"success": True, "cycle": cycle}
        set_temp_cached("current_cycle", res)
        return res
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── Advance to next cycle ─────────────────────────────────────
def advance_cycle():
    try:
        fn = aid_contract.functions.advanceCycle()
        res = send_transaction(fn)
        if res.get("success") and res.get("status") == 1:
            # Invalidate cycle cache and all collection caches
            _temp_cache.pop("current_cycle", None)
            keys_to_remove = [k for k in _temp_cache if k.startswith("has_collected_") or k.startswith("collection_status_")]
            for k in keys_to_remove:
                _temp_cache.pop(k, None)
        return res
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── Authorise a field officer ─────────────────────────────────
def authorise_officer(officer_address):
    try:
        fn = aid_contract.functions.authoriseOfficer(
            Web3.to_checksum_address(officer_address)
        )
        return send_transaction(fn)
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── Revoke a field officer ────────────────────────────────────
def revoke_officer(officer_address):
    try:
        fn = aid_contract.functions.revokeOfficer(
            Web3.to_checksum_address(officer_address)
        )
        return send_transaction(fn)
    except Exception as e:
        return {"success": False, "error": str(e)}
    
# ── Get all beneficiary IDs ───────────────────────────────
def get_all_beneficiary_ids():
    cached = get_temp_cached("all_beneficiary_ids")
    if cached is not None:
        return cached
    try:
        ids = registry_contract.functions.getAllIds().call()
        res = {"success": True, "ids": list(ids)}
        set_temp_cached("all_beneficiary_ids", res)
        return res
    except Exception as e:
        return {"success": False, "error": str(e)}
