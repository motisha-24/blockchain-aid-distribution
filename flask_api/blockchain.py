# ================================================================
#  blockchain.py — Web3 Connection and Contract Interaction
#  Updated to support aid types, units and location tracking
#  Author: Motisha John Mafukashe — R2211825P
# ================================================================

import json
import os
from web3 import Web3
from config import RPC_URL, REGISTRY_ADDRESS, AID_ADDRESS, PRIVATE_KEY

# ── Connect to blockchain node ────────────────────────────────
w3 = Web3(Web3.HTTPProvider(RPC_URL))

if w3.is_connected():
    print("[BLOCKCHAIN] Connected to node:", RPC_URL)
else:
    print("[BLOCKCHAIN] ERROR: Cannot connect to blockchain node")

# ── Load contract ABIs from build folder ─────────────────────
BASE_DIR  = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD_DIR = os.path.join(BASE_DIR, "build", "contracts")

def load_contract(contract_name, address):
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
account = w3.eth.account.from_key(PRIVATE_KEY)
print("[BLOCKCHAIN] Wallet address:", account.address)


# ── HELPER: Build and send a transaction ─────────────────────
def send_transaction(contract_function):
    try:
        nonce = w3.eth.get_transaction_count(account.address)
        tx    = contract_function.build_transaction({
            "gas"     : 400000,
            "gasPrice": w3.to_wei("20", "gwei"),
            "nonce"   : nonce,
        })
        signed  = w3.eth.account.sign_transaction(tx, PRIVATE_KEY)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        return {
            "success" : True,
            "tx_hash" : tx_hash.hex(),
            "block"   : receipt.blockNumber,
            "status"  : receipt.status   # 1 = success, 0 = failed
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


# ================================================================
#  BENEFICIARY FUNCTIONS
# ================================================================

# ── Register a new beneficiary ────────────────────────────────
# Updated: now includes national_id and location fields
def register_beneficiary(b_id, name, national_id, phone, location):
    try:
        # Check if already registered before sending transaction
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
        return send_transaction(fn)
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
    try:
        result = registry_contract.functions.getBeneficiary(
            b_id
        ).call()
        return {
            "success"    : True,
            "name"       : result[0],
            "national_id": result[1],
            "phone"      : result[2],
            "location"   : result[3],
            "active"     : result[4]
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── Check if beneficiary is registered ───────────────────────
def is_registered(b_id):
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
        return send_transaction(fn)
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── Reactivate a beneficiary ──────────────────────────────────
def reactivate_beneficiary(b_id):
    try:
        fn = registry_contract.functions.reactivateBeneficiary(b_id)
        return send_transaction(fn)
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── Get total registered beneficiaries ───────────────────────
def get_total_beneficiaries():
    try:
        total = registry_contract.functions.getTotalBeneficiaries().call()
        return {"success": True, "total": total}
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
def distribute_aid(beneficiary_id, amount, aid_type, aid_unit, location):
    try:
        fn = aid_contract.functions.distribute(
            beneficiary_id,
            amount,
            aid_type.upper(),    # normalise to uppercase
            aid_unit.upper(),    # normalise to uppercase
            location
        )
        return send_transaction(fn)
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── Get transaction details ───────────────────────────────────
# Updated: returns aid_type, aid_unit and location fields
def get_transaction(tx_id):
    try:
        result = aid_contract.functions.getTransaction(tx_id).call()
        return {
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
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── Check if beneficiary collected specific aid this cycle ────
# Updated: now requires aid_type parameter
# A beneficiary can receive MAIZE and CASH in the same cycle
# but cannot receive MAIZE twice in the same cycle
def has_collected(beneficiary_id, aid_type):
    try:
        result = aid_contract.functions.hasCollectedThisCycle(
            beneficiary_id,
            aid_type.upper()
        ).call()
        return {"success": True, "collected": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── Check multiple aid types at once ─────────────────────────
# Useful for dashboard to show full collection status
def get_collection_status(beneficiary_id, aid_types):
    try:
        result = aid_contract.functions.getCollectionStatus(
            beneficiary_id,
            [t.upper() for t in aid_types]
        ).call()
        return {
            "success": True,
            "status": {
                aid_types[i]: result[i]
                for i in range(len(aid_types))
            }
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── Get total transactions ────────────────────────────────────
def get_total_transactions():
    try:
        total = aid_contract.functions.getTotalTransactions().call()
        return {"success": True, "total": total}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── Get current distribution cycle ───────────────────────────
def get_current_cycle():
    try:
        cycle = aid_contract.functions.getCurrentCycle().call()
        return {"success": True, "cycle": cycle}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── Advance to next cycle ─────────────────────────────────────
def advance_cycle():
    try:
        fn = aid_contract.functions.advanceCycle()
        return send_transaction(fn)
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
    try:
        ids = registry_contract.functions.getAllIds().call()
        return {"success": True, "ids": list(ids)}
    except Exception as e:
        return {"success": False, "error": str(e)}