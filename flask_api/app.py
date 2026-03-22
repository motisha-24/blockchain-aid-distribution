# ================================================================
#  app.py — Flask REST API Server
#  Updated with SQLite database, input validation and full auth
#  Author: Motisha John Mafukashe — R2211825P
# ================================================================

from blockchain import (
    
    get_all_beneficiary_ids,   # ← add this
    )

import sys
import os
import re
import hashlib
import time
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, request, jsonify
from blockchain import (
    register_beneficiary,
    distribute_aid,
    get_beneficiary,
    get_transaction,
    has_collected,
    get_total_transactions,
    get_total_beneficiaries,
    get_current_cycle,
    advance_cycle,
    authorise_officer,
    revoke_officer,
    deactivate_beneficiary,
    reactivate_beneficiary,
    get_collection_status,
    is_registered,
    w3
)
from cache    import cache_transaction, sync_pending_to_blockchain, get_pending
from sms      import send_sms, get_sms_log
from database import (
    init_database,
    verify_login,
    update_last_login,
    get_all_users,
    create_user,
    update_password,
    deactivate_user,
    reactivate_user
)
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Initialise SQLite database on startup
# Creates tables and seeds default users if empty
init_database()

# ================================================================
#  TOKEN MANAGEMENT
# ================================================================

# In-memory token store — resets when Flask restarts
# Acceptable for prototype — use Redis or JWT in production
ACTIVE_TOKENS = {}


def generate_token(username, role):
    raw   = f"{username}{role}{time.time()}"
    token = hashlib.sha256(raw.encode()).hexdigest()
    ACTIVE_TOKENS[token] = {
        "username": username,
        "role"    : role
    }
    return token


def verify_token(token):
    return ACTIVE_TOKENS.get(token)


def get_token_from_request():
    auth = request.headers.get("Authorization", "")
    return auth.replace("Bearer ", "").strip()


# ================================================================
#  VALIDATION HELPER
# ================================================================

def validate(data, rules):
    """
    Validates incoming request data against a set of rules.
    Returns a list of error messages.
    Empty list means all fields are valid.

    Rule options:
      required    : bool   — field must be present and non-empty
      type        : str    — 'int' or 'str'
      min         : int    — minimum value (int) or length (str)
      max         : int    — maximum value (int) or length (str)
      phone       : bool   — must be valid phone number
      national_id : bool   — must be valid Zimbabwe national ID
    """
    errors = []

    for field, rule in rules.items():
        value = data.get(field)

        # ── Required check ────────────────────────────────────
        if rule.get("required") and not value and value != 0:
            errors.append(f"{field} is required")
            continue

        if value is None:
            continue

        # ── Type: integer ─────────────────────────────────────
        if rule.get("type") == "int":
            try:
                value = int(value)
                if rule.get("min") is not None and value < rule["min"]:
                    errors.append(
                        f"{field} must be at least {rule['min']}"
                    )
                if rule.get("max") is not None and value > rule["max"]:
                    errors.append(
                        f"{field} cannot exceed {rule['max']}"
                    )
            except (ValueError, TypeError):
                errors.append(f"{field} must be a valid number")
            continue

        # ── Type: string ──────────────────────────────────────
        if rule.get("type") == "str":
            str_val = str(value).strip()
            if not str_val:
                errors.append(f"{field} cannot be empty")
                continue
            if rule.get("min") and len(str_val) < rule["min"]:
                errors.append(
                    f"{field} must be at least {rule['min']} characters"
                )
            if rule.get("max") and len(str_val) > rule["max"]:
                errors.append(
                    f"{field} cannot exceed {rule['max']} characters"
                )

        # ── Phone number validation ───────────────────────────
        # Accepts formats: +263771234001, 0771234001, 263771234001
        if rule.get("phone"):
            pattern = r'^\+?[0-9]{10,15}$'
            if not re.match(pattern, str(value).replace(" ", "")):
                errors.append(
                    f"{field} must be a valid phone number "
                    f"e.g. +263771234001"
                )

        # ── Zimbabwe National ID validation ───────────────────
        # Accepts format: 63-123456A78 or 12-345678B90
        if rule.get("national_id"):
            pattern = r'^\d{2}-\d{6,7}[A-Z]\d{2}$'
            if not re.match(pattern, str(value).strip()):
                errors.append(
                    f"{field} must be valid Zimbabwe ID format "
                    f"e.g. 63-123456A78"
                )

    return errors


# ================================================================
#  AUTH ENDPOINTS
# ================================================================

# ── Get distribution history (last N transactions) ────────
@app.route("/api/distributions/history", methods=["GET"])
def distribution_history():
    try:
        total_result = get_total_transactions()
        total        = total_result.get("total", 0)

        if total == 0:
            return jsonify({
                "success"      : True,
                "total"        : 0,
                "distributions": []
            }), 200

        # Get last 50 transactions — adjust as needed
        limit  = min(int(request.args.get("limit", 50)), 100)
        start  = max(1, total - limit + 1)

        distributions = []
        for tx_id in range(total, start - 1, -1):
            result = get_transaction(tx_id)
            if result["success"]:
                # Get beneficiary name for display
                bene = get_beneficiary(result["beneficiary_id"])
                distributions.append({
                    "tx_id"         : tx_id,
                    "beneficiary_id": result["beneficiary_id"],
                    "beneficiary_name": bene["name"]
                        if bene["success"] else "Unknown",
                    "amount"        : result["amount"],
                    "aid_type"      : result["aid_type"],
                    "aid_unit"      : result["aid_unit"],
                    "location"      : result["location"],
                    "cycle"         : result["cycle"],
                    "officer"       : result["officer"],
                    "timestamp"     : result["timestamp"],
                    "status"        : result["status"]
                })

        return jsonify({
            "success"      : True,
            "total"        : total,
            "distributions": distributions
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
# ── Get all beneficiaries list ────────────────────────────
@app.route("/api/beneficiaries", methods=["GET"])
def get_all_beneficiaries():
    id_result = get_all_beneficiary_ids()
    if not id_result["success"]:
        return jsonify({"error": id_result["error"]}), 500

    beneficiaries = []
    for b_id in id_result["ids"]:
        if b_id == 0:
            continue
        result = get_beneficiary(b_id)
        if result["success"]:
            beneficiaries.append({
                "id"         : b_id,
                "name"       : result["name"],
                "national_id": result["national_id"],
                "phone"      : result["phone"],
                "location"   : result["location"],
                "active"     : result["active"]
            })

    return jsonify({
        "success"       : True,
        "total"         : len(beneficiaries),
        "beneficiaries" : beneficiaries
    }), 200

# ── Login ─────────────────────────────────────────────────────
@app.route("/api/auth/login", methods=["POST"])
def login():
    data     = request.get_json()
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()

    # Basic validation
    if not username or len(username) < 3:
        return jsonify({
            "error": "Username must be at least 3 characters"
        }), 400

    if not password or len(password) < 6:
        return jsonify({
            "error": "Password must be at least 6 characters"
        }), 400

    # Verify against database
    user = verify_login(username, password)
    if not user:
        return jsonify({"error": "Invalid credentials"}), 401

    # Update last login timestamp in database
    update_last_login(username)

    # Generate session token
    token = generate_token(username, user["role"])

    print(f"[AUTH] Login: {username} ({user['role']})")

    return jsonify({
        "success" : True,
        "token"   : token,
        "role"    : user["role"],
        "name"    : user["name"],
        "username": username
    }), 200


# ── Logout ────────────────────────────────────────────────────
@app.route("/api/auth/logout", methods=["POST"])
def logout():
    token = get_token_from_request()
    if token in ACTIVE_TOKENS:
        username = ACTIVE_TOKENS[token].get("username")
        del ACTIVE_TOKENS[token]
        print(f"[AUTH] Logout: {username}")
    return jsonify({"success": True, "message": "Logged out"}), 200


# ── Verify token ──────────────────────────────────────────────
@app.route("/api/auth/verify", methods=["GET"])
def verify():
    token = get_token_from_request()
    user  = verify_token(token)
    if not user:
        return jsonify({"valid": False}), 401
    return jsonify({
        "valid"   : True,
        "role"    : user["role"],
        "username": user["username"]
    }), 200


# ── Get all users — admin only ────────────────────────────────
@app.route("/api/auth/users", methods=["GET"])
def get_users():
    token = get_token_from_request()
    user  = verify_token(token)
    if not user or user["role"] != "ADMIN":
        return jsonify({"error": "Unauthorised — Admin only"}), 403
    return jsonify({"users": get_all_users()}), 200


# ── Create new user — admin only ─────────────────────────────
@app.route("/api/auth/users/create", methods=["POST"])
def create_new_user():
    token = get_token_from_request()
    user  = verify_token(token)
    if not user or user["role"] != "ADMIN":
        return jsonify({"error": "Unauthorised — Admin only"}), 403

    data   = request.get_json()
    errors = validate(data, {
        "username": {"required": True, "type": "str", "min": 3, "max": 50},
        "password": {"required": True, "type": "str", "min": 8, "max": 100},
        "role"    : {"required": True, "type": "str"},
        "name"    : {"required": True, "type": "str", "min": 2, "max": 100},
    })

    if errors:
        return jsonify({"error": " | ".join(errors)}), 400

    valid_roles = ["ADMIN", "NGO", "DONOR", "AUDITOR"]
    if data["role"].upper() not in valid_roles:
        return jsonify({
            "error": f"Invalid role. Must be one of: {valid_roles}"
        }), 400

    result = create_user(
        data["username"].strip(),
        data["password"],
        data["role"].upper(),
        data["name"].strip(),
        data.get("email", "").strip()
    )

    return jsonify(result), 201 if result["success"] else 400


# ── Update password ───────────────────────────────────────────
@app.route("/api/auth/users/password", methods=["POST"])
def change_password():
    token = get_token_from_request()
    user  = verify_token(token)
    if not user:
        return jsonify({"error": "Unauthorised"}), 401

    data         = request.get_json()
    target_user  = data.get("username", "").strip()
    new_password = data.get("new_password", "").strip()

    if not target_user or not new_password:
        return jsonify({
            "error": "Username and new_password are required"
        }), 400

    # Users can only change their own password
    # Admin can change anyone's password
    if user["role"] != "ADMIN" and user["username"] != target_user:
        return jsonify({"error": "Unauthorised"}), 403

    if len(new_password) < 8:
        return jsonify({
            "error": "Password must be at least 8 characters"
        }), 400

    return jsonify(update_password(target_user, new_password)), 200


# ── Deactivate user — admin only ──────────────────────────────
@app.route("/api/auth/users/<username>/deactivate", methods=["POST"])
def disable_user(username):
    token = get_token_from_request()
    user  = verify_token(token)
    if not user or user["role"] != "ADMIN":
        return jsonify({"error": "Unauthorised — Admin only"}), 403
    if username == user["username"]:
        return jsonify({
            "error": "Cannot deactivate your own account"
        }), 400
    return jsonify(deactivate_user(username)), 200


# ── Reactivate user — admin only ──────────────────────────────
@app.route("/api/auth/users/<username>/reactivate", methods=["POST"])
def enable_user(username):
    token = get_token_from_request()
    user  = verify_token(token)
    if not user or user["role"] != "ADMIN":
        return jsonify({"error": "Unauthorised — Admin only"}), 403
    return jsonify(reactivate_user(username)), 200


# ================================================================
#  ROOT — Health check
# ================================================================
@app.route("/", methods=["GET"])
def index():
    cycle = get_current_cycle()
    total = get_total_transactions()
    benes = get_total_beneficiaries()
    return jsonify({
        "system"             : "Blockchain Aid Distribution System",
        "author"             : "Motisha John Mafukashe R2211825P",
        "version"            : "2.0",
        "status"             : "running",
        "blockchain"         : w3.is_connected(),
        "current_cycle"      : cycle.get("cycle", "N/A"),
        "total_tx"           : total.get("total", 0),
        "total_beneficiaries": benes.get("total", 0)
    })


# ================================================================
#  BENEFICIARY ENDPOINTS
# ================================================================

@app.route("/api/beneficiary/register", methods=["POST"])
def register():
    data   = request.get_json()
    errors = validate(data, {
        "id"         : {"required": True, "type": "int", "min": 1},
        "name"       : {"required": True, "type": "str", "min": 2, "max": 100},
        "national_id": {"required": True, "national_id": True},
        "phone"      : {"required": True, "phone": True},
        "location"   : {"required": True, "type": "str", "min": 3, "max": 100},
    })

    if errors:
        return jsonify({"error": " | ".join(errors)}), 400

    b_id = int(data["id"])

    # ── Check if ID already registered ───────────────────────
    already_exists = is_registered(b_id)
    if already_exists.get("registered"):
        return jsonify({
            "error": f"Beneficiary ID {b_id} is already "
                     f"registered on the blockchain"
        }), 409

    result = register_beneficiary(
        b_id,
        data["name"].strip(),
        data["national_id"].strip(),
        data["phone"].strip(),
        data["location"].strip()
    )

    if result["success"]:
        return jsonify({
            "message": "Beneficiary registered successfully",
            "tx_hash": result["tx_hash"],
            "block"  : result["block"]
        }), 201
    else:
        error_msg = result.get("error", "Registration failed")
        if "already registered" in error_msg.lower():
            return jsonify({
                "error": f"Beneficiary ID {b_id} is already registered"
            }), 409
        return jsonify({"error": error_msg}), 500

@app.route("/api/beneficiary/<int:b_id>", methods=["GET"])
def get_beneficiary_route(b_id):
    if b_id <= 0:
        return jsonify({"error": "Invalid beneficiary ID"}), 400
    result = get_beneficiary(b_id)
    if result["success"]:
        return jsonify(result), 200
    return jsonify({"error": result["error"]}), 404


@app.route("/api/beneficiary/<int:b_id>/registered", methods=["GET"])
def check_registered(b_id):
    if b_id <= 0:
        return jsonify({"error": "Invalid beneficiary ID"}), 400
    return jsonify(is_registered(b_id)), 200


@app.route("/api/beneficiary/<int:b_id>/status", methods=["GET"])
def collection_status(b_id):
    if b_id <= 0:
        return jsonify({"error": "Invalid beneficiary ID"}), 400
    aid_types  = request.args.get(
        "types",
        "CASH,MAIZE,OIL,SEEDS,CLOTHES,FERTILISER,BLANKETS"
    )
    types_list = [t.strip().upper() for t in aid_types.split(",")]
    return jsonify(get_collection_status(b_id, types_list)), 200


@app.route("/api/beneficiary/<int:b_id>/deactivate", methods=["POST"])
def deactivate(b_id):
    if b_id <= 0:
        return jsonify({"error": "Invalid beneficiary ID"}), 400
    result = deactivate_beneficiary(b_id)
    if result["success"]:
        return jsonify({
            "message": f"Beneficiary {b_id} deactivated",
            "tx_hash": result["tx_hash"]
        }), 200
    return jsonify({"error": result["error"]}), 500


@app.route("/api/beneficiary/<int:b_id>/reactivate", methods=["POST"])
def reactivate(b_id):
    if b_id <= 0:
        return jsonify({"error": "Invalid beneficiary ID"}), 400
    result = reactivate_beneficiary(b_id)
    if result["success"]:
        return jsonify({
            "message": f"Beneficiary {b_id} reactivated",
            "tx_hash": result["tx_hash"]
        }), 200
    return jsonify({"error": result["error"]}), 500


# ================================================================
#  DISTRIBUTION ENDPOINTS
# ================================================================

@app.route("/api/distribute", methods=["POST"])
def distribute():
    data   = request.get_json()
    errors = validate(data, {
        "beneficiary_id": {"required": True, "type": "int", "min": 1},
        "amount"        : {"required": True, "type": "int", "min": 1},
        "aid_type"      : {"required": True, "type": "str", "min": 2,
                           "max": 50},
        "aid_unit"      : {"required": True, "type": "str", "min": 1,
                           "max": 20},
        "location"      : {"required": True, "type": "str", "min": 3,
                           "max": 100},
    })

    if errors:
        return jsonify({"error": " | ".join(errors)}), 400

    b_id     = int(data["beneficiary_id"])
    amount   = int(data["amount"])
    aid_type = data["aid_type"].upper().strip()
    aid_unit = data["aid_unit"].upper().strip()
    location = data["location"].strip()

    check = has_collected(b_id, aid_type)
    if check["success"] and check["collected"]:
        return jsonify({
            "error": f"DUPLICATE: Beneficiary already received "
                     f"{aid_type} this cycle"
        }), 409

    result = distribute_aid(b_id, amount, aid_type, aid_unit, location)

    if result["success"]:
        bene = get_beneficiary(b_id)
        if bene["success"]:
            send_sms(
                bene["phone"], bene["name"],
                amount, result["tx_hash"],
                aid_type, aid_unit
            )
        return jsonify({
            "message" : "Aid distributed successfully",
            "aid_type": aid_type,
            "aid_unit": aid_unit,
            "amount"  : amount,
            "location": location,
            "tx_hash" : result["tx_hash"],
            "block"   : result["block"]
        }), 200
    return jsonify({"error": result["error"]}), 500


@app.route("/api/distribute/offline", methods=["POST"])
def distribute_offline():
    data   = request.get_json()
    errors = validate(data, {
        "beneficiary_id": {"required": True, "type": "int", "min": 1},
        "amount"        : {"required": True, "type": "int", "min": 1},
        "aid_type"      : {"required": True, "type": "str", "min": 2},
        "aid_unit"      : {"required": True, "type": "str", "min": 1},
        "location"      : {"required": True, "type": "str", "min": 3},
    })

    if errors:
        return jsonify({"error": " | ".join(errors)}), 400

    cached = cache_transaction(
        int(data["beneficiary_id"]),
        int(data["amount"]),
        data["aid_type"].upper().strip(),
        data["aid_unit"].upper().strip(),
        data["location"].strip(),
        data.get("officer_id", "unknown")
    )

    bene = get_beneficiary(int(data["beneficiary_id"]))
    if bene["success"]:
        send_sms(
            bene["phone"], bene["name"],
            int(data["amount"]),
            f"PENDING-{cached['id']}",
            data["aid_type"].upper(),
            data["aid_unit"].upper()
        )

    return jsonify({
        "message" : "Transaction cached — will sync when online",
        "cache_id": cached["id"],
        "aid_type": data["aid_type"].upper(),
        "aid_unit": data["aid_unit"].upper(),
        "amount"  : data["amount"],
        "status"  : "PENDING"
    }), 200


@app.route("/api/sync", methods=["POST"])
def sync():
    if not w3.is_connected():
        return jsonify({
            "error": "Still offline — cannot sync to blockchain"
        }), 503
    result = sync_pending_to_blockchain()
    return jsonify({
        "message"      : "Sync complete",
        "synced"       : result["synced"],
        "failed"       : result.get("failed", 0),
        "total_pending": result["total_pending"]
    }), 200


@app.route("/api/cache/pending", methods=["GET"])
def pending():
    return jsonify({"pending": get_pending()}), 200


# ================================================================
#  TRANSACTION ENDPOINTS
# ================================================================

@app.route("/api/transaction/<int:tx_id>", methods=["GET"])
def transaction(tx_id):
    if tx_id <= 0:
        return jsonify({"error": "Invalid transaction ID"}), 400
    result = get_transaction(tx_id)
    if result["success"]:
        return jsonify(result), 200
    return jsonify({"error": result["error"]}), 404


@app.route("/api/transactions/total", methods=["GET"])
def total_transactions():
    return jsonify(get_total_transactions()), 200


# ================================================================
#  CYCLE ENDPOINTS
# ================================================================

@app.route("/api/cycle", methods=["GET"])
def current_cycle():
    return jsonify(get_current_cycle()), 200


@app.route("/api/cycle/advance", methods=["POST"])
def next_cycle():
    result = advance_cycle()
    if result["success"]:
        new_cycle = get_current_cycle()
        return jsonify({
            "message"  : "Cycle advanced successfully",
            "new_cycle": new_cycle.get("cycle"),
            "tx_hash"  : result["tx_hash"]
        }), 200
    return jsonify({"error": result["error"]}), 500


# ================================================================
#  OFFICER MANAGEMENT ENDPOINTS
# ================================================================

@app.route("/api/officer/authorise", methods=["POST"])
def auth_officer():
    data = request.get_json()
    if not data.get("address", "").strip():
        return jsonify({"error": "Officer address is required"}), 400
    result = authorise_officer(data["address"].strip())
    if result["success"]:
        return jsonify({
            "message": "Officer authorised successfully",
            "tx_hash": result["tx_hash"]
        }), 200
    return jsonify({"error": result["error"]}), 500


@app.route("/api/officer/revoke", methods=["POST"])
def rev_officer():
    data = request.get_json()
    if not data.get("address", "").strip():
        return jsonify({"error": "Officer address is required"}), 400
    result = revoke_officer(data["address"].strip())
    if result["success"]:
        return jsonify({
            "message": "Officer revoked successfully",
            "tx_hash": result["tx_hash"]
        }), 200
    return jsonify({"error": result["error"]}), 500


# ================================================================
#  SMS ENDPOINTS
# ================================================================

@app.route("/api/sms/log", methods=["GET"])
def sms_log():
    return jsonify({"sms_log": get_sms_log()}), 200


# ================================================================
#  STATS ENDPOINT
# ================================================================

@app.route("/api/stats", methods=["GET"])
def stats():
    total_tx    = get_total_transactions()
    total_benes = get_total_beneficiaries()
    cycle       = get_current_cycle()
    pending_txs = get_pending()

    return jsonify({
        "blockchain_online"  : w3.is_connected(),
        "current_cycle"      : cycle.get("cycle", 0),
        "total_transactions" : total_tx.get("total", 0),
        "total_beneficiaries": total_benes.get("total", 0),
        "pending_cache"      : len(pending_txs)
    }), 200


# ================================================================
#  RUN SERVER
# ================================================================
if __name__ == "__main__":
    print("=" * 55)
    print("  Blockchain Aid Distribution API v2.0")
    print("  Author : Motisha John Mafukashe R2211825P")
    print("  Server : http://127.0.0.1:5000")
    print("=" * 55)
    app.run(debug=True, host="0.0.0.0", port=5000)