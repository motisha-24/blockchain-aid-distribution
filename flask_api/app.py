# ================================================================
#  app.py — Flask REST API Server
#  Updated with auto-sync, failed attempt tracking and full auth
#  Author: Motisha John Mafukashe — R2211825P
# ================================================================

import sys
import os
import re
import hashlib
import time
import threading
import datetime
import json
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, request, jsonify
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import jwt
from env_loader import get_setting
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
    get_all_beneficiary_ids,
    w3
)
from cache    import cache_transaction, sync_pending_to_blockchain, get_pending
from sms      import send_sms, get_sms_log, send_failure_alert
from database import (
    init_database,
    verify_login,
    update_last_login,
    get_all_users,
    create_user,
    update_password,
    deactivate_user,
    reactivate_user,
    delete_user_db,
    create_campaign,
    get_campaign,
    list_campaigns,
    reserve_campaign_budget,
    release_campaign_budget
)
from flask_cors import CORS

app = Flask(__name__)
CORS(app, origins=[
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://your-dashboard-domain.com"  # Replace with actual domain
])

JWT_SECRET = get_setting("JWT_SECRET", prefer="local")
if not JWT_SECRET:
    print("[ERROR] JWT_SECRET not set in environment variables")
    exit(1)
JWT_ALGORITHM = get_setting("JWT_ALGORITHM", default="HS256", prefer="local")
JWT_EXP_DELTA_SECONDS = int(
    get_setting("JWT_EXP_DELTA_SECONDS", default="1800", prefer="local")
)  # 30 minutes default

limiter = Limiter(key_func=get_remote_address)
limiter.init_app(app)
REVOKED_TOKENS_FILE = os.path.join(os.path.dirname(__file__), "revoked_tokens.json")
REVOKED_TOKENS = set()

def load_revoked_tokens():
    global REVOKED_TOKENS
    if os.path.exists(REVOKED_TOKENS_FILE):
        try:
            with open(REVOKED_TOKENS_FILE, 'r') as f:
                REVOKED_TOKENS = set(json.load(f))
        except:
            REVOKED_TOKENS = set()

def save_revoked_tokens():
    with open(REVOKED_TOKENS_FILE, 'w') as f:
        json.dump(list(REVOKED_TOKENS), f)

load_revoked_tokens()

# Initialise SQLite database on startup
init_database()


# ================================================================
#  BACKGROUND AUTO-SYNC THREAD
#  Automatically syncs cached transactions when internet returns
#  Matches activity diagram: "await reconnection" → auto sync
# ================================================================

def auto_sync_loop():
    while True:
        time.sleep(30)  # check every 30 seconds
        try:
            if w3.is_connected():
                pending = get_pending()
                if pending:
                    print(f"[AUTO-SYNC] Found {len(pending)} pending "
                          f"transactions — syncing...")
                    result = sync_pending_to_blockchain()
                    if result["synced"] > 0:
                        print(f"[AUTO-SYNC] Synced {result['synced']} "
                              f"transactions successfully")
        except Exception as e:
            print(f"[AUTO-SYNC] Error: {e}")

# Start background sync thread
sync_thread = threading.Thread(target=auto_sync_loop, daemon=True)
sync_thread.start()
print("[AUTO-SYNC] Background sync thread started — checks every 30s")


# ================================================================
#  TOKEN MANAGEMENT
# ================================================================

def generate_token(username, role):
    payload = {
        "sub": username,
        "role": role,
        "iat": datetime.datetime.utcnow(),
        "exp": datetime.datetime.utcnow() + datetime.timedelta(seconds=JWT_EXP_DELTA_SECONDS)
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return token


def verify_token(token):
    if not token or token in REVOKED_TOKENS:
        return None
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return {
            "username": payload.get("sub"),
            "role": payload.get("role")
        }
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def get_token_from_request():
    auth = request.headers.get("Authorization", "")
    return auth.replace("Bearer ", "").strip()


# ================================================================
#  VALIDATION HELPER
# ================================================================

def validate(data, rules):
    errors = []

    for field, rule in rules.items():
        value = data.get(field)

        if rule.get("required") and not value and value != 0:
            errors.append(f"{field} is required")
            continue

        if value is None:
            continue

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

        if rule.get("phone"):
            pattern = r'^\+?[0-9]{10,15}$'
            if not re.match(pattern, str(value).replace(" ", "")):
                errors.append(
                    f"{field} must be a valid phone number "
                    f"e.g. +263771234001"
                )

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

# ── Delete user permanently — admin only ──────────────────
@app.route("/api/auth/users/<username>", methods=["DELETE"])
def delete_user(username):
    token = get_token_from_request()
    user  = verify_token(token)
    if not user or user["role"] != "ADMIN":
        return jsonify({"error": "Unauthorised — Admin only"}), 403
    if username == user["username"]:
        return jsonify({
            "error": "Cannot delete your own account"
        }), 400
    return jsonify(delete_user_db(username)), 200

@app.route("/api/auth/login", methods=["POST"])
@limiter.limit("5/minute")
def login():
    data     = request.get_json()
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()

    if not username or len(username) < 3:
        return jsonify({
            "error": "Username must be at least 3 characters"
        }), 400

    if not password or len(password) < 6:
        return jsonify({
            "error": "Password must be at least 6 characters"
        }), 400

    user = verify_login(username, password)
    if not user:
        return jsonify({"error": "Invalid credentials"}), 401

    update_last_login(username)
    token = generate_token(username, user["role"])
    print(f"[AUTH] Login: {username} ({user['role']})")

    return jsonify({
        "success" : True,
        "token"   : token,
        "role"    : user["role"],
        "name"    : user["name"],
        "username": username
    }), 200


@app.route("/api/auth/logout", methods=["POST"])
def logout():
    token = get_token_from_request()
    if token:
        REVOKED_TOKENS.add(token)
        save_revoked_tokens()
    return jsonify({"success": True, "message": "Logged out"}), 200


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


@app.route("/api/auth/users", methods=["GET"])
def get_users():
    token = get_token_from_request()
    user  = verify_token(token)
    if not user or user["role"] != "ADMIN":
        return jsonify({"error": "Unauthorised — Admin only"}), 403
    return jsonify({"users": get_all_users()}), 200


@app.route("/api/auth/users/create", methods=["POST"])
@limiter.limit("10/minute")
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


@app.route("/api/campaigns", methods=["GET"])
def campaigns_list():
    token = get_token_from_request()
    user  = verify_token(token)
    if not user or user["role"] not in ["ADMIN", "NGO"]:
        return jsonify({"error": "Unauthorised — Admin or NGO only"}), 403
    return jsonify(list_campaigns()), 200


@app.route("/api/campaign/<int:campaign_id>", methods=["GET"])
def campaign_details(campaign_id):
    token = get_token_from_request()
    user  = verify_token(token)
    if not user or user["role"] not in ["ADMIN", "NGO"]:
        return jsonify({"error": "Unauthorised — Admin or NGO only"}), 403
    return jsonify(get_campaign(campaign_id)), 200


@app.route("/api/campaign/create", methods=["POST"])
def create_new_campaign():
    token = get_token_from_request()
    user  = verify_token(token)
    if not user or user["role"] != "ADMIN":
        return jsonify({"error": "Unauthorised — Admin only"}), 403

    data = request.get_json()
    errors = validate(data, {
        "name": {"required": True, "type": "str", "min": 3, "max": 100},
        "donor_label": {"required": True, "type": "str", "min": 2, "max": 100},
        "aid_type": {"required": True, "type": "str", "min": 2, "max": 50},
        "budget_total": {"required": True, "type": "int", "min": 1}
    })

    if errors:
        return jsonify({"error": " | ".join(errors)}), 400

    result = create_campaign(
        data["name"].strip(),
        data["donor_label"].strip(),
        data["aid_type"].strip(),
        int(data["budget_total"])
    )
    return jsonify(result), 201 if result["success"] else 400


@app.route("/api/auth/users/password", methods=["POST"])
def change_password():
    token = get_token_from_request()
    user  = verify_token(token)
    if not user:
        return jsonify({"error": "Unauthorised"}), 401

    data         = request.get_json()
    target_user  = data.get("username", "").strip()
    new_password = data.get("new_password", "").strip()
    current_pass = data.get("current_password", "").strip()

    if not target_user or not new_password:
        return jsonify({
            "error": "Username and new_password are required"
        }), 400

    if user["role"] != "ADMIN":
        if not current_pass:
            return jsonify({
                "error": "Current password is required"
            }), 400
        verified = verify_login(target_user, current_pass)
        if not verified:
            return jsonify({
                "error": "Current password is incorrect"
            }), 401

    if user["role"] != "ADMIN" and user["username"] != target_user:
        return jsonify({"error": "Unauthorised"}), 403

    if len(new_password) < 8:
        return jsonify({
            "error": "Password must be at least 8 characters"
        }), 400

    return jsonify(update_password(target_user, new_password)), 200


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


@app.route("/api/auth/users/<username>/reactivate", methods=["POST"])
def enable_user(username):
    token = get_token_from_request()
    user  = verify_token(token)
    if not user or user["role"] != "ADMIN":
        return jsonify({"error": "Unauthorised — Admin only"}), 403
    return jsonify(reactivate_user(username)), 200


# ================================================================
#  SECURITY ENDPOINTS
#  Handles failed fingerprint attempts from ESP32
# ================================================================

@app.route("/api/auth/failed-attempt", methods=["POST"])
def failed_attempt():
    data       = request.get_json()
    b_id       = data.get("beneficiary_id", "unknown")
    attempts   = int(data.get("attempts", 0))
    location   = data.get("location", "unknown")
    officer_id = data.get("officer_id", "unknown")

    print(f"[SECURITY] Failed auth attempt {attempts} "
          f"for beneficiary {b_id} at {location}")

    if attempts >= 3:
        print(f"[SECURITY] SESSION LOCKED — "
              f"3 failed attempts for beneficiary {b_id}")
        send_failure_alert(officer_id, attempts)
        return jsonify({
            "success": True,
            "action" : "SESSION_LOCKED",
            "message": f"Session locked after {attempts} failed attempts"
        }), 200

    return jsonify({
        "success": True,
        "action" : "RETRY",
        "message": f"Attempt {attempts} — retry allowed"
    }), 200


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
@limiter.limit("10/minute")
def register():
    data   = request.get_json()
    errors = validate(data, {
        "id"         : {"required": True, "type": "int",  "min": 1},
        "name"       : {"required": True, "type": "str",  "min": 2, "max": 100},
        "national_id": {"required": True, "national_id": True},
        "phone"      : {"required": True, "phone": True},
        "location"   : {"required": True, "type": "str",  "min": 3, "max": 100},
    })

    if errors:
        return jsonify({"error": " | ".join(errors)}), 400

    b_id = int(data["id"])

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
        "success"      : True,
        "total"        : len(beneficiaries),
        "beneficiaries": beneficiaries
    }), 200


# ================================================================
#  DISTRIBUTION ENDPOINTS
#  Single endpoint — auto detects online/offline mode
#  Matches activity diagram internet available decision
# ================================================================

@app.route("/api/distribute", methods=["POST"])
@limiter.limit("15/minute")
def distribute():
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

    b_id       = int(data["beneficiary_id"])
    amount     = int(data["amount"])
    aid_type   = data["aid_type"].upper().strip()
    aid_unit   = data["aid_unit"].upper().strip()
    location   = data["location"].strip()
    campaign_id = data.get("campaign_id")

    if campaign_id is not None and campaign_id != "":
        try:
            campaign_id = int(campaign_id)
        except (ValueError, TypeError):
            return jsonify({"error": "campaign_id must be a valid number"}), 400
    else:
        campaign_id = None

    if campaign_id:
        campaign_res = get_campaign(campaign_id)
        if not campaign_res["success"]:
            return jsonify({"error": campaign_res["error"]}), 400
        campaign = campaign_res["campaign"]
        if not campaign["active"]:
            return jsonify({"error": "Campaign is inactive"}), 400
        if campaign["aid_type"] != aid_type:
            return jsonify({"error": "Selected campaign does not match the chosen aid type"}), 400
        if amount > campaign["remaining"]:
            return jsonify({"error": "Selected campaign does not have enough remaining budget"}), 400

    # ── Duplicate check ───────────────────────────────────────
    check = has_collected(b_id, aid_type)
    if check["success"] and check["collected"]:
        return jsonify({
            "error": f"DUPLICATE: Beneficiary already received "
                     f"{aid_type} this cycle"
        }), 409

    # ── AUTO detect internet and route accordingly ────────────
    if w3.is_connected():
        if campaign_id:
            reserve = reserve_campaign_budget(campaign_id, amount)
            if not reserve["success"]:
                return jsonify({"error": reserve["error"]}), 400

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
                "message"     : "Aid distributed successfully",
                "mode"        : "ONLINE",
                "aid_type"    : aid_type,
                "aid_unit"    : aid_unit,
                "amount"      : amount,
                "location"    : location,
                "campaign_id" : campaign_id,
                "tx_hash"     : result["tx_hash"],
                "block"       : result["block"]
            }), 200
        else:
            if campaign_id:
                release_campaign_budget(campaign_id, amount)
            return jsonify({"error": result["error"]}), 500
    else:
        if campaign_id:
            reserve = reserve_campaign_budget(campaign_id, amount)
            if not reserve["success"]:
                return jsonify({"error": reserve["error"]}), 400

        cached = cache_transaction(
            b_id, amount, aid_type, aid_unit, location,
            data.get("officer_id", "unknown"),
            campaign_id
        )
        bene = get_beneficiary(b_id)
        if bene["success"]:
            send_sms(
                bene["phone"], bene["name"],
                amount, f"PENDING-{cached['id']}",
                aid_type, aid_unit
            )
        return jsonify({
            "message"     : "No internet — transaction cached automatically",
            "mode"        : "OFFLINE",
            "cache_id"    : cached["id"],
            "aid_type"    : aid_type,
            "aid_unit"    : aid_unit,
            "amount"      : amount,
            "campaign_id" : campaign_id,
            "status"      : "PENDING"
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

        limit  = min(int(request.args.get("limit", 50)), 100)
        start  = max(1, total - limit + 1)

        distributions = []
        for tx_id in range(total, start - 1, -1):
            result = get_transaction(tx_id)
            if result["success"]:
                bene = get_beneficiary(result["beneficiary_id"])
                distributions.append({
                    "tx_id"           : tx_id,
                    "beneficiary_id"  : result["beneficiary_id"],
                    "beneficiary_name": bene["name"]
                        if bene["success"] else "Unknown",
                    "amount"          : result["amount"],
                    "aid_type"        : result["aid_type"],
                    "aid_unit"        : result["aid_unit"],
                    "location"        : result["location"],
                    "cycle"           : result["cycle"],
                    "officer"         : result["officer"],
                    "timestamp"       : result["timestamp"],
                    "status"          : result["status"]
                })

        return jsonify({
            "success"      : True,
            "total"        : total,
            "distributions": distributions
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


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
    total_tx      = get_total_transactions()
    total_benes   = get_total_beneficiaries()
    cycle         = get_current_cycle()
    pending_txs   = get_pending()
    campaigns_res = list_campaigns()

    return jsonify({
        "blockchain_online"  : w3.is_connected(),
        "current_cycle"      : cycle.get("cycle", 0),
        "total_transactions" : total_tx.get("total", 0),
        "total_beneficiaries": total_benes.get("total", 0),
        "pending_cache"      : len(pending_txs),
        "total_campaigns"    : len(campaigns_res.get("campaigns", []))
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
