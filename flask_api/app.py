# ================================================================
#  app.py — Flask REST API Server
#  Updated with auto-sync, failed attempt tracking and full auth
#  Author: Motisha John Mafukashe — R2211825P
# ================================================================

import sys
import os
import re
import time
import threading
import datetime
import json
from functools import wraps
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, request, jsonify, g
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import jwt
from env_loader import get_setting
from config import REGISTRY_ADDRESS, AID_ADDRESS, CHAIN_ID, RPC_URL
from blockchain import (
    register_beneficiary,
    distribute_aid,
    get_beneficiary,
    get_transaction,
    get_transaction_by_hash,
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
from sms      import get_sms_log, send_failure_alert, log_sms_event
from database import (
    init_database,
    verify_login,
    update_last_login,
    get_all_users,
    get_users_by_email,
    create_user,
    update_password,
    recover_password,
    deactivate_user,
    reactivate_user,
    delete_user_db,
    create_campaign,
    get_campaign,
    list_campaigns,
    reserve_campaign_budget,
    release_campaign_budget,
    get_hardware_profile,
    update_hardware_profile,
    queue_beneficiary_enrollment,
    get_enrollment_request,
    list_enrollment_requests,
    get_next_pending_enrollment,
    get_connection,
    update_enrollment_status,
    log_enrollment_status,
    get_latest_enrollment_status,
    log_hardware_event,
    get_recent_hardware_events,
    create_aid_package,
    get_active_aid_packages,
    delete_aid_package,
    activate_distribution_session,
    get_active_session,
    close_old_sessions,
    update_gsm_status,
    get_gsm_status,
    queue_sms,
    get_pending_sms_job,
    mark_sms_job
)
from flask_cors import CORS

app = Flask(__name__)
CORS(app, 
    origins=["http://localhost:3000", "http://127.0.0.1:3000", "https://your-dashboard-domain.com"],
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"]
)

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
        "iat": datetime.datetime.now(datetime.timezone.utc),
        "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=JWT_EXP_DELTA_SECONDS)
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


def require_auth(allowed_roles=None):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            token = get_token_from_request()
            user = verify_token(token)
            if not user:
                return jsonify({"error": "Unauthorised"}), 401

            if allowed_roles and user["role"] not in allowed_roles:
                roles_text = ", ".join(allowed_roles)
                return jsonify({
                    "error": f"Unauthorised - allowed roles: {roles_text}"
                }), 403

            g.current_user = user
            return func(*args, **kwargs)
        return wrapper
    return decorator


def current_user():
    return getattr(g, "current_user", None)


def hardware_response(success: bool, action: str, message: str, **extra):
    payload = {
        "success": success,
        "action": action,
        "message": message
    }
    payload.update(extra)
    return payload


def build_enrollment_status_payload(request_data):
    status = request_data.get("status", "")
    status_messages = {
        "PENDING_ENROLLMENT": "Beneficiary details saved. Ready to start fingerprint capture.",
        "WAITING_FOR_FINGERPRINT": "Please place finger on sensor",
        "ENROLLING": "Fingerprint capture in progress",
        "ENROLLED": "Fingerprint captured successfully",
        "ACTIVE": "Beneficiary registered",
        "FAILED_ENROLLMENT": request_data.get("error_message") or "Fingerprint enrollment failed",
        "FAILED_BLOCKCHAIN": request_data.get("error_message") or "Blockchain registration failed"
    }

    return {
        "beneficiary_id": request_data.get("beneficiary_id"),
        "device_id": request_data.get("device_id", ""),
        "status_code": status,
        "status_message": status_messages.get(status, "Enrollment status updated"),
        "created_at": request_data.get("updated_at", "")
    }


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
@require_auth(["ADMIN"])
def delete_user(username):
    user = current_user()
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


@app.route("/api/hardware/login", methods=["POST"])
def hardware_login():
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    device_id = data.get("device_id", "unknown").strip()

    if not username or not password:
        return jsonify({
            "success": False,
            "action": "LOGIN_FAILED",
            "message": "username and password are required"
        }), 400

    user = verify_login(username, password)
    if not user:
        return jsonify({
            "success": False,
            "action": "LOGIN_FAILED",
            "message": "Invalid credentials"
        }), 401

    if user["role"] not in ["ADMIN", "NGO"]:
        return jsonify({
            "success": False,
            "action": "LOGIN_FAILED",
            "message": "Hardware access requires NGO or ADMIN role"
        }), 403

    update_last_login(username)
    token = generate_token(username, user["role"])
    print(f"[AUTH] Hardware login: {username} ({user['role']}) device={device_id}")

    return jsonify({
        "success": True,
        "action": "LOGIN_OK",
        "message": "Hardware login successful",
        "token": token,
        "role": user["role"],
        "username": username,
        "device_id": device_id,
        "expires_in": JWT_EXP_DELTA_SECONDS
    }), 200


@app.route("/api/auth/recover/username", methods=["POST"])
@limiter.limit("5/minute")
def recover_username():
    data  = request.get_json() or {}
    email = data.get("email", "").strip().lower()

    if not email or "@" not in email:
        return jsonify({"error": "A valid email address is required"}), 400

    users = get_users_by_email(email)
    if not users:
        return jsonify({
            "success": False,
            "error": "No active account matched that email"
        }), 404

    return jsonify({
        "success": True,
        "accounts": users,
        "message": "Matching usernames found"
    }), 200


@app.route("/api/auth/recover/password", methods=["POST"])
@limiter.limit("5/minute")
def recover_account_password():
    data         = request.get_json() or {}
    username     = data.get("username", "").strip()
    email        = data.get("email", "").strip().lower()
    new_password = data.get("new_password", "").strip()

    if not username or len(username) < 3:
        return jsonify({"error": "Username must be at least 3 characters"}), 400
    if not email or "@" not in email:
        return jsonify({"error": "A valid email address is required"}), 400
    if len(new_password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    result = recover_password(username, email, new_password)
    return jsonify(result), 200 if result["success"] else 404


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


@app.route("/api/auth/refresh", methods=["POST"])
@require_auth(["ADMIN", "NGO", "DONOR", "AUDITOR"])
def refresh_token():
    user = current_user()
    token = generate_token(user["username"], user["role"])
    return jsonify({
        "success": True,
        "token": token,
        "role": user["role"],
        "username": user["username"],
        "expires_in": JWT_EXP_DELTA_SECONDS
    }), 200
@app.route("/api/auth/users", methods=["GET"])
@require_auth(["ADMIN"])
def get_users():
    return jsonify({"users": get_all_users()}), 200


@app.route("/api/auth/users/create", methods=["POST"])
@limiter.limit("10/minute")
@require_auth(["ADMIN"])
def create_new_user():
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
@require_auth(["ADMIN", "NGO", "DONOR", "AUDITOR"])
def campaigns_list():
    return jsonify(list_campaigns()), 200


@app.route("/api/campaign/<int:campaign_id>", methods=["GET"])
@require_auth(["ADMIN", "NGO", "DONOR", "AUDITOR"])
def campaign_details(campaign_id):
    return jsonify(get_campaign(campaign_id)), 200


@app.route("/api/campaign/create", methods=["POST"])
@require_auth(["ADMIN"])
def create_new_campaign():
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
@require_auth(["ADMIN", "NGO", "DONOR", "AUDITOR"])
def change_password():
    user = current_user()
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
@require_auth(["ADMIN"])
def disable_user(username):
    user = current_user()
    if username == user["username"]:
        return jsonify({
            "error": "Cannot deactivate your own account"
        }), 400
    return jsonify(deactivate_user(username)), 200


@app.route("/api/auth/users/<username>/reactivate", methods=["POST"])
@require_auth(["ADMIN"])
def enable_user(username):
    return jsonify(reactivate_user(username)), 200


# ================================================================
#  SECURITY ENDPOINTS
#  Handles failed fingerprint attempts from ESP32
# ================================================================

@app.route("/api/auth/failed-attempt", methods=["POST"])
@require_auth(["ADMIN", "NGO"])
def failed_attempt():
    data       = request.get_json() or {}
    b_id       = data.get("beneficiary_id", "unknown")
    attempts   = int(data.get("attempts", 0))
    location   = data.get("location", "unknown")
    officer_id = data.get("officer_id", "unknown")
    device_id  = data.get("device_id", "unknown")

    print(f"[SECURITY] Failed auth attempt {attempts} "
          f"for beneficiary {b_id} at {location}")

    if attempts >= 3:
        print(f"[SECURITY] SESSION LOCKED — "
              f"3 failed attempts for beneficiary {b_id}")
        send_failure_alert(officer_id, attempts)
        return jsonify(hardware_response(
            True,
            "SESSION_LOCKED",
            f"Session locked after {attempts} failed attempts",
            attempts=attempts,
            locked=True,
            beneficiary_id=b_id,
            location=location,
            officer_id=officer_id,
            device_id=device_id
        )), 200

    return jsonify(hardware_response(
        True,
        "RETRY_ALLOWED",
        f"Attempt {attempts} - retry allowed",
        attempts=attempts,
        locked=False,
        beneficiary_id=b_id,
        location=location,
        officer_id=officer_id,
        device_id=device_id
    )), 200


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
@require_auth(["ADMIN", "NGO"])
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
@require_auth(["ADMIN", "NGO", "DONOR", "AUDITOR"])
def get_beneficiary_route(b_id):
    if b_id <= 0:
        return jsonify({"error": "Invalid beneficiary ID"}), 400
    result = get_beneficiary(b_id)
    if result["success"]:
        return jsonify(result), 200
    return jsonify({"error": result["error"]}), 404


@app.route("/api/beneficiary/<int:b_id>/registered", methods=["GET"])
@require_auth(["ADMIN", "NGO", "DONOR", "AUDITOR"])
def check_registered(b_id):
    if b_id <= 0:
        return jsonify({"error": "Invalid beneficiary ID"}), 400
    return jsonify(is_registered(b_id)), 200


@app.route("/api/beneficiary/<int:b_id>/status", methods=["GET"])
@require_auth(["ADMIN", "NGO", "DONOR", "AUDITOR"])
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
@require_auth(["ADMIN", "NGO"])
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
@require_auth(["ADMIN", "NGO"])
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
@require_auth(["ADMIN", "NGO", "DONOR", "AUDITOR"])
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
@require_auth(["ADMIN", "NGO"])
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
        log_hardware_event(
            "DUPLICATE_BLOCKED",
            f"Beneficiary {b_id} already received {aid_type} this cycle",
            data.get("device_id", "web"),
            current_user()["username"]
        )
        return jsonify(hardware_response(
            False,
            "DUPLICATE_BLOCKED",
            f"Beneficiary already received {aid_type} this cycle",
            duplicate=True,
            mode="ONLINE",
            notification="NO_SMS",
            beneficiary_id=b_id,
            aid_type=aid_type,
            aid_unit=aid_unit,
            amount=amount,
            location=location,
            campaign_id=campaign_id
        )), 409

    # ── AUTO detect internet and route accordingly ────────────
    if w3.is_connected():
        if campaign_id:
            reserve = reserve_campaign_budget(campaign_id, amount)
            if not reserve["success"]:
                return jsonify({"error": reserve["error"]}), 400

        result = distribute_aid(b_id, amount, aid_type, aid_unit, location)

        if result["success"]:
            log_hardware_event(
                "AID_DISTRIBUTED",
                f"{aid_type} {amount} {aid_unit} distributed to beneficiary {b_id}",
                data.get("device_id", "web"),
                current_user()["username"],
                f"Tx: {result['tx_hash']}"
            )
            return jsonify(hardware_response(
                True,
                "DISTRIBUTED",
                "Aid distributed successfully",
                mode="ONLINE",
                notification="HANDLED_BY_HARDWARE",
                duplicate=False,
                beneficiary_id=b_id,
                aid_type=aid_type,
                aid_unit=aid_unit,
                amount=amount,
                location=location,
                campaign_id=campaign_id,
                tx_hash=result["tx_hash"],
                block=result["block"]
            )), 200
        else:
            log_hardware_event(
                "DISTRIBUTION_FAILED",
                f"Distribution failed for beneficiary {b_id}: {result['error']}",
                data.get("device_id", "web"),
                current_user()["username"]
            )
            if campaign_id:
                release_campaign_budget(campaign_id, amount)
            return jsonify(hardware_response(
                False,
                "DISTRIBUTION_FAILED",
                result["error"],
                mode="ONLINE",
                duplicate=False,
                beneficiary_id=b_id,
                aid_type=aid_type,
                aid_unit=aid_unit,
                amount=amount,
                location=location,
                campaign_id=campaign_id
            )), 500
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
        return jsonify(hardware_response(
            True,
            "CACHED_FOR_SYNC",
            "Blockchain unavailable - transaction cached by server",
            mode="OFFLINE",
            notification="HANDLED_BY_HARDWARE",
            duplicate=False,
            beneficiary_id=b_id,
            cache_id=cached["id"],
            aid_type=aid_type,
            aid_unit=aid_unit,
            amount=amount,
            location=location,
            campaign_id=campaign_id,
            status="PENDING"
        )), 200


@app.route("/api/distribute/batch", methods=["POST"])
@limiter.limit("15/minute")
@require_auth(["ADMIN", "NGO"])
def distribute_batch():
    data = request.get_json() or {}
    
    if "beneficiary_id" not in data or "items" not in data or "location" not in data:
        return jsonify({"error": "beneficiary_id, items, and location are required"}), 400

    b_id = int(data["beneficiary_id"])
    location = data["location"].strip()
    items = data["items"]
    officer_id = data.get("officer_id", "unknown")
    
    if not isinstance(items, list) or len(items) == 0:
        return jsonify({"error": "items must be a non-empty array"}), 400

    results = []
    
    # Get the current cycle number for stamping events
    current_cycle_num = get_current_cycle().get("cycle", 0)

    # Get the current nonce for the account to handle batching
    current_nonce = None
    if w3.is_connected():
        try:
            from blockchain import account
            current_nonce = w3.eth.get_transaction_count(account.address)
        except:
            pass

    # Process each item
    for item in items:
        aid_type = (item.get("aid_type") or item.get("type") or "").upper().strip()
        aid_unit = (item.get("aid_unit") or item.get("unit") or "").upper().strip()
        if not aid_unit:
            aid_unit = "UNITS"
        amount = int(item.get("amount", 0))
        campaign_id = item.get("campaign_id")
        
        # ── Duplicate check ───────────────────────────────────────
        check = has_collected(b_id, aid_type)
        if check["success"] and check["collected"]:
            results.append({
                "success": False,
                "action": "DUPLICATE_BLOCKED",
                "message": f"Beneficiary already received {aid_type} this cycle",
                "aid_type": aid_type
            })
            
            # Log duplicate block for mobile visibility
            log_hardware_event(
                "DUPLICATE_BLOCKED",
                f"Beneficiary {b_id} attempt for {aid_type} blocked (already received)",
                data.get("device_id", "mobile"),
                officer_id
            )
            continue
            
        if campaign_id:
            try:
                campaign_id = int(campaign_id)
            except:
                campaign_id = None
                
        if w3.is_connected():
            if campaign_id:
                reserve = reserve_campaign_budget(campaign_id, amount)
                if not reserve["success"]:
                    results.append({"success": False, "aid_type": aid_type, "error": reserve["error"]})
                    continue

            dist_result = distribute_aid(
                b_id, amount, aid_type, aid_unit, location, 
                wait_for_receipt=False, 
                manual_nonce=current_nonce
            )

            if dist_result["success"]:
                if current_nonce is not None:
                    current_nonce += 1
                
                results.append({
                    "success": True,
                    "action": "DISTRIBUTED",
                    "aid_type": aid_type,
                    "amount": amount,
                    "tx_hash": dist_result["tx_hash"]
                })
                
                # Log individual item success for real-time mobile tracking
                log_hardware_event(
                    "AID_DISTRIBUTED",
                    f"{aid_type} {amount} {aid_unit} distributed to beneficiary {b_id}",
                    data.get("device_id", "mobile"),
                    officer_id,
                    f"Tx: {dist_result['tx_hash']} | Nonce: {current_nonce-1} | Block: {dist_result.get('block', 'N/A')}",
                    cycle=current_cycle_num
                )
                
                import time
                time.sleep(2)
            else:
                if campaign_id:
                    release_campaign_budget(campaign_id, amount)
                results.append({
                    "success": False,
                    "action": "DISTRIBUTION_FAILED",
                    "aid_type": aid_type,
                    "error": dist_result["error"]
                })
        else:
            if campaign_id:
                reserve = reserve_campaign_budget(campaign_id, amount)
                if not reserve["success"]:
                    results.append({"success": False, "aid_type": aid_type, "error": reserve["error"]})
                    continue
                    
            cached = cache_transaction(
                b_id, amount, aid_type, aid_unit, location,
                officer_id, campaign_id
            )
            results.append({
                "success": True,
                "action": "CACHED_FOR_SYNC",
                "aid_type": aid_type,
                "cache_id": cached["id"]
            })

    any_success = any(r.get("success") for r in results)

    # --- SMART SMS DISPATCH ---
    # Works for ALL clients: ESP32, Mobile App, Web Dashboard
    if any_success:
        try:
            bene_res = get_enrollment_request(b_id)
            if not bene_res["success"]:
                print(f"[SMS-WARN] Could not find enrollment record for beneficiary {b_id}")
            else:
                phone = bene_res["request"].get("phone", "")
                name  = bene_res["request"].get("name", "Beneficiary")

                if not phone:
                    print(f"[SMS-WARN] No phone number for beneficiary {b_id}")
                else:
                    # Build SMS from original items list (not results) for reliability
                    successful_items = [
                        item for item, r in zip(items, results)
                        if r.get("success")
                    ]
                    if not successful_items:
                        successful_items = items[:1]

                    # Build a single description covering ALL items
                    item_parts = []
                    for it in successful_items:
                        aid_type_sms = str(it.get("aid_type", "Aid")).upper()
                        aid_unit_sms = str(it.get("aid_unit", ""))
                        amount_sms   = str(it.get("amount", ""))
                        if aid_type_sms == "CASH":
                            item_parts.append(f"USD {amount_sms}")
                        else:
                            item_parts.append(f"{amount_sms} {aid_unit_sms} of {aid_type_sms}")

                    item_desc = ", ".join(item_parts)

                    # Get tx ref safely
                    success_result = next((r for r in results if r.get("success")), {})
                    tx_ref = str(success_result.get("tx_hash") or success_result.get("cache_id") or "SUCCESS")[:12]

                    sms_msg = f"Dear {name}, you received {item_desc}. Ref: {tx_ref}. AidChain Zimbabwe."
                    print(f"[SMS] Building message: '{sms_msg}'")

                    gsm = get_gsm_status()
                    print(f"[SMS] GSM Status: online={gsm['online']} signal={gsm['signal']} registered={gsm['registered']}")

                    if gsm["online"]:
                        queue_sms(phone, sms_msg)
                        print(f"[SMS] Queued for GSM hardware delivery to {phone}")
                    else:
                        from sms import trigger_simgate_sms
                        result = trigger_simgate_sms(phone, sms_msg)
                        print(f"[SMS] SimGate result: {result}")
        except Exception as e:
            import traceback
            print(f"[SMS-ERROR] Smart dispatch failed: {str(e)}")
            print(traceback.format_exc())

    # Log event for the batch
    log_hardware_event(
        "BATCH_DISTRIBUTION_PROCESSED" if any_success else "BATCH_DISTRIBUTION_FAILED",
        f"Processed batch for beneficiary {b_id} ({len(items)} items)",
        data.get("device_id", "mobile"),
        officer_id,
        f"Success items: {len([r for r in results if r.get('success')])}"
    )

    if any_success:
        return jsonify(hardware_response(
            True,
            "BATCH_PROCESSED",
            "Batch distribution processed",
            beneficiary_id=b_id,
            results=results
        )), 200
    else:
        return jsonify(hardware_response(
            False,
            "BATCH_FAILED",
            "No items were successfully distributed",
            beneficiary_id=b_id,
            results=results
        )), 409


# ================================================================
#  PACKAGE AND SESSION ENDPOINTS
# ================================================================

@app.route("/api/packages/create", methods=["POST"])
@require_auth(["ADMIN", "NGO"])
def create_package():
    data = request.get_json() or {}
    cycle = get_current_cycle().get("cycle", "0")
    location = data.get("location", "").strip()
    items = data.get("items", [])
    
    if not location:
        return jsonify({"error": "Location is required"}), 400
        
    result = create_aid_package(str(cycle), location, items)
    return jsonify(result), 201 if result.get("success") else 400

@app.route("/api/packages/active", methods=["GET"])
@require_auth(["ADMIN", "NGO"])
def get_active_packages():
    location = request.args.get("location")
    result = get_active_aid_packages(location)
    return jsonify(result), 200

@app.route("/api/packages/<package_id>", methods=["DELETE"])
@require_auth(["ADMIN"])
def remove_package(package_id):
    result = delete_aid_package(package_id)
    code = 200 if result.get("success") else 404
    return jsonify(result), code

@app.route("/api/sessions/activate", methods=["POST"])
@require_auth(["ADMIN", "NGO"])
def activate_session():
    data = request.get_json() or {}
    user = current_user()
    officer_id = user["username"]
    location = data.get("location", "").strip()
    package_id = data.get("package_id", "").strip()
    
    if not location or not package_id:
        return jsonify({"error": "Location and package_id are required"}), 400
        
    result = activate_distribution_session(officer_id, location, package_id)
    return jsonify(result), 200 if result.get("success") else 400

@app.route("/api/sessions/active", methods=["GET"])
@require_auth(["ADMIN", "NGO"])
def get_session():
    user = current_user()
    officer_id = user["username"]
    result = get_active_session(officer_id)
    return jsonify(result), 200 if result.get("success") else 404

@app.route("/api/hardware/session", methods=["GET"])
@require_auth(["ADMIN", "NGO"])
def hardware_session():
    # Hardware check for ANY running session
    result = get_active_session()
    return jsonify(result), 200 if result.get("success") else 404


@app.route("/api/sync", methods=["POST"])
@require_auth(["ADMIN", "NGO"])
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
@require_auth(["ADMIN", "NGO"])
def pending():
    return jsonify({"pending": get_pending()}), 200


# ================================================================
#  TRANSACTION ENDPOINTS
# ================================================================

@app.route("/api/transaction/<int:tx_id>", methods=["GET"])
@require_auth(["ADMIN", "NGO", "DONOR", "AUDITOR"])
def transaction(tx_id):
    if tx_id <= 0:
        return jsonify({"error": "Invalid transaction ID"}), 400
    result = get_transaction(tx_id)
    if result["success"]:
        return jsonify(result), 200
    return jsonify({"error": result["error"]}), 404


@app.route("/api/transaction/hash/<tx_hash>", methods=["GET"])
@require_auth(["ADMIN", "NGO", "DONOR", "AUDITOR"])
def transaction_by_hash(tx_hash):
    result = get_transaction_by_hash(tx_hash)
    if result["success"]:
        return jsonify(result), 200
    return jsonify({"error": result["error"]}), 404


@app.route("/api/transactions/total", methods=["GET"])
@require_auth(["ADMIN", "NGO", "DONOR", "AUDITOR"])
def total_transactions():
    return jsonify(get_total_transactions()), 200


@app.route("/api/distributions/history", methods=["GET"])
@require_auth(["ADMIN", "NGO", "DONOR", "AUDITOR"])
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
@require_auth(["ADMIN", "NGO", "DONOR", "AUDITOR"])
def current_cycle():
    return jsonify(get_current_cycle()), 200


@app.route("/api/cycle/progress", methods=["GET"])
@require_auth(["ADMIN", "NGO", "DONOR", "AUDITOR"])
def get_cycle_progress():
    # 1. Get global stats from blockchain
    total_tx   = get_total_transactions().get("total", 0)
    cycle_info = get_current_cycle()
    total_b    = get_total_beneficiaries().get("total", 0)
    current_cycle_num = cycle_info.get("cycle", 0)

    # Allow querying a specific past cycle via ?cycle=N, defaults to current
    query_cycle = request.args.get("cycle", current_cycle_num, type=int)

    # 2. Get collectors filtered by the requested cycle number
    conn   = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT DISTINCT message
        FROM hardware_events
        WHERE event_type = 'AID_DISTRIBUTED'
          AND cycle = ?
    """, (query_cycle,))
    rows = cursor.fetchall()
    conn.close()

    beneficiaries_detail = []
    seen_ids = set()

    for row in rows:
        msg = row[0]
        match = re.search(r'beneficiary\s+(\d+)', msg, re.IGNORECASE)
        if match:
            try:
                b_id = int(match.group(1))
                if b_id not in seen_ids:
                    seen_ids.add(b_id)
                    beneficiaries_detail.append({
                        "id": b_id,
                        "status": "COLLECTED"
                    })
            except:
                continue

    return jsonify({
        "cycle":                  query_cycle,
        "current_cycle":          current_cycle_num,
        "total_beneficiaries":    total_b,
        "confirmed_on_blockchain": total_tx,
        "total_distributed":      len(beneficiaries_detail),
        "not_yet_distributed":    max(0, total_b - len(beneficiaries_detail)),
        "beneficiaries_detail":   beneficiaries_detail
    }), 200


@app.route("/api/cycle/advance", methods=["POST"])
@require_auth(["ADMIN", "NGO"])
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
@require_auth(["ADMIN"])
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
@require_auth(["ADMIN"])
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

@app.route("/api/hardware/ping", methods=["GET"])
@require_auth(["ADMIN", "NGO"])
def hardware_ping():
    user = current_user()
    cycle = get_current_cycle()
    profile = get_hardware_profile()
    return jsonify({
        "success": True,
        "action": "HARDWARE_READY",
        "message": "Hardware API reachable",
        "server_time": datetime.datetime.now(datetime.timezone.utc).isoformat() + "Z",
        "blockchain_online": w3.is_connected(),
        "current_cycle": cycle.get("cycle", 0),
        "hardware_profile_ready": profile.get("success", False),
        "role": user["role"],
        "username": user["username"]
    }), 200


@app.route("/api/hardware/enrollment/start", methods=["POST"])
@require_auth(["ADMIN", "NGO"])
def start_hardware_enrollment():
    data = request.get_json() or {}
    errors = validate(data, {
        "id": {"required": True, "type": "int", "min": 1001, "max": 1127},
        "name": {"required": True, "type": "str", "min": 2, "max": 100},
        "national_id": {"required": True, "national_id": True},
        "phone": {"required": True, "phone": True},
        "location": {"required": True, "type": "str", "min": 3, "max": 100},
        "officer_id": {"required": True, "type": "str", "min": 3, "max": 50},
        "device_id": {"required": True, "type": "str", "min": 3, "max": 100}
    })

    if errors:
        return jsonify(hardware_response(
            False,
            "ENROLLMENT_INVALID",
            " | ".join(errors)
        )), 400

    beneficiary_id = int(data["id"])
    already_exists = is_registered(beneficiary_id)
    if already_exists.get("registered"):
        return jsonify(hardware_response(
            False,
            "ALREADY_REGISTERED",
            f"Beneficiary ID {beneficiary_id} is already registered on blockchain"
        )), 409

    result = queue_beneficiary_enrollment(
        beneficiary_id,
        data["name"],
        data["national_id"],
        data["phone"],
        data["location"],
        data["officer_id"],
        data["device_id"]
    )

    if not result["success"]:
        return jsonify(hardware_response(
            False,
            "ENROLLMENT_INVALID",
            result["error"]
        )), 400

    return jsonify(hardware_response(
        True,
        "ENROLLMENT_QUEUED",
        "Beneficiary saved and queued for fingerprint enrollment",
        request=result["request"]
    )), 201


@app.route("/api/fingerprint/start-enroll", methods=["POST"])
@app.route("/api/hardware/enrollment/start-fingerprint", methods=["POST"])
@require_auth(["ADMIN", "NGO"])
def start_fingerprint_enrollment():
    data = request.get_json() or {}
    errors = validate(data, {
        "beneficiary_id": {"required": True, "type": "int", "min": 1001, "max": 1127},
        "device_id": {"required": True, "type": "str", "min": 3, "max": 100}
    })

    if errors:
        return jsonify(hardware_response(
            False,
            "FINGERPRINT_START_INVALID",
            " | ".join(errors)
        )), 400

    beneficiary_id = int(data["beneficiary_id"])
    device_id = data["device_id"].strip()

    # Get the enrollment request
    request_result = get_enrollment_request(beneficiary_id)
    if not request_result["success"]:
        return jsonify(hardware_response(
            False,
            "ENROLLMENT_NOT_FOUND",
            request_result["error"]
        )), 404

    request_data = request_result["request"]
    if request_data["device_id"] != device_id:
        return jsonify(hardware_response(
            False,
            "DEVICE_MISMATCH",
            "Enrollment request is for a different device"
        )), 409

    if request_data["status"] != "PENDING_ENROLLMENT":
        return jsonify(hardware_response(
            False,
            "INVALID_STATUS",
            f"Enrollment status is {request_data['status']}, expected PENDING_ENROLLMENT"
        )), 409

    # Update status to waiting for fingerprint
    update_result = update_enrollment_status(beneficiary_id, "WAITING_FOR_FINGERPRINT")
    if not update_result["success"]:
        return jsonify(hardware_response(
            False,
            "STATUS_UPDATE_FAILED",
            update_result["error"]
        )), 500

    log_enrollment_status(
        beneficiary_id,
        device_id,
        "WAITING_FOR_FINGERPRINT",
        "Please place finger on sensor"
    )

    log_hardware_event(
        "FINGERPRINT_WAITING",
        f"Waiting for fingerprint input for beneficiary {beneficiary_id}",
        device_id,
        request_data["officer_id"]
    )

    return jsonify(hardware_response(
        True,
        "FINGERPRINT_WAITING",
        "ESP32 is now waiting for fingerprint input",
        request=update_result["request"]
    )), 200


@app.route("/api/hardware/enrollment/list", methods=["GET"])
@require_auth(["ADMIN", "NGO"])
def enrollment_request_list():
    result = list_enrollment_requests()
    return jsonify(result), 200


@app.route("/api/hardware/enrollment/<int:beneficiary_id>", methods=["GET"])
@require_auth(["ADMIN", "NGO"])
def enrollment_request_status(beneficiary_id):
    result = get_enrollment_request(beneficiary_id)
    if not result["success"]:
        return jsonify(hardware_response(
            False,
            "ENROLLMENT_NOT_FOUND",
            result["error"]
        )), 404
    return jsonify(hardware_response(
        True,
        "ENROLLMENT_STATUS",
        "Enrollment request loaded",
        request=result["request"]
    )), 200


@app.route("/api/hardware/enrollment/next", methods=["GET"])
@require_auth(["ADMIN", "NGO"])
def next_enrollment_job():
    device_id = request.args.get("device_id", "").strip()
    if not device_id:
        return jsonify(hardware_response(
            False,
            "DEVICE_REQUIRED",
            "device_id query parameter is required"
        )), 400

    result = get_next_pending_enrollment(device_id)
    if not result["success"]:
        return jsonify(hardware_response(
            False,
            "NO_ENROLLMENT_JOB",
            result["error"],
            device_id=device_id
        )), 404

    return jsonify(hardware_response(
        True,
        "ENROLLMENT_JOB_READY",
        "Pending fingerprint enrollment job loaded",
        request=result["request"]
    )), 200


@app.route("/api/hardware/enrollment/result", methods=["POST"])
@require_auth(["ADMIN", "NGO"])
def enrollment_result():
    data = request.get_json() or {}
    errors = validate(data, {
        "beneficiary_id": {"required": True, "type": "int", "min": 1001, "max": 1127},
        "slot_id": {"required": True, "type": "int", "min": 1, "max": 127},
        "device_id": {"required": True, "type": "str", "min": 3, "max": 100},
        "success": {"required": True}
    })
    if errors:
        return jsonify(hardware_response(
            False,
            "RESULT_INVALID",
            " | ".join(errors)
        )), 400

    beneficiary_id = int(data["beneficiary_id"])
    slot_id = int(data["slot_id"])
    expected_slot = beneficiary_id - 1000
    request_result = get_enrollment_request(beneficiary_id)
    if not request_result["success"]:
        return jsonify(hardware_response(
            False,
            "ENROLLMENT_NOT_FOUND",
            request_result["error"]
        )), 404

    request_data = request_result["request"]
    if request_data["device_id"] != data["device_id"].strip():
        return jsonify(hardware_response(
            False,
            "DEVICE_MISMATCH",
            "Enrollment result came from an unexpected device"
        )), 409

    if slot_id != expected_slot:
        update_enrollment_status(
            beneficiary_id,
            "FAILED_ENROLLMENT",
            f"Slot mismatch. Expected {expected_slot}, got {slot_id}"
        )
        log_enrollment_status(
            beneficiary_id,
            data["device_id"].strip(),
            "FAILED_ENROLLMENT",
            f"Slot mismatch. Expected {expected_slot}, got {slot_id}"
        )
        log_hardware_event(
            "ENROLLMENT_FAILED",
            f"Slot mismatch for beneficiary {beneficiary_id}",
            data["device_id"],
            request_data["officer_id"],
            f"Expected slot {expected_slot}, got {slot_id}"
        )
        return jsonify(hardware_response(
            False,
            "SLOT_MISMATCH",
            f"Slot mismatch. Expected {expected_slot}, got {slot_id}"
        )), 409

    if not bool(data["success"]):
        error_message = str(data.get("error", "Fingerprint enrollment failed"))
        update_enrollment_status(
            beneficiary_id,
            "FAILED_ENROLLMENT",
            error_message
        )
        log_enrollment_status(
            beneficiary_id,
            data["device_id"].strip(),
            "FAILED_ENROLLMENT",
            error_message
        )
        log_hardware_event(
            "ENROLLMENT_FAILED",
            f"Fingerprint enrollment failed for beneficiary {beneficiary_id}",
            data["device_id"],
            request_data["officer_id"],
            error_message
        )
        return jsonify(hardware_response(
            False,
            "ENROLLMENT_FAILED",
            error_message
        )), 200

    update_enrollment_status(beneficiary_id, "ENROLLED")
    log_enrollment_status(
        beneficiary_id,
        data["device_id"].strip(),
        "ENROLLED",
        "Fingerprint captured successfully"
    )
    log_hardware_event(
        "ENROLLMENT_SUCCESS",
        f"Fingerprint enrolled for beneficiary {beneficiary_id} in slot {slot_id}",
        data["device_id"],
        request_data["officer_id"]
    )
    registration = register_beneficiary(
        beneficiary_id,
        request_data["name"],
        request_data["national_id"],
        request_data["phone"],
        request_data["location"]
    )

    if not registration["success"]:
        update_enrollment_status(
            beneficiary_id,
            "FAILED_BLOCKCHAIN",
            registration.get("error", "Blockchain registration failed")
        )
        log_enrollment_status(
            beneficiary_id,
            data["device_id"].strip(),
            "FAILED_BLOCKCHAIN",
            registration.get("error", "Blockchain registration failed")
        )
        log_hardware_event(
            "BLOCKCHAIN_FAILED",
            f"Blockchain registration failed for beneficiary {beneficiary_id}",
            data["device_id"],
            request_data["officer_id"],
            registration.get("error", "Blockchain registration failed")
        )
        return jsonify(hardware_response(
            False,
            "BLOCKCHAIN_REGISTRATION_FAILED",
            registration.get("error", "Blockchain registration failed")
        )), 500

    final_status = update_enrollment_status(
        beneficiary_id,
        "ACTIVE",
        blockchain_tx=registration.get("tx_hash", "")
    )
    log_enrollment_status(
        beneficiary_id,
        data["device_id"].strip(),
        "ACTIVE",
        "Beneficiary registered"
    )
    log_hardware_event(
        "BENEFICIARY_REGISTERED",
        f"Beneficiary {beneficiary_id} fully registered on blockchain",
        data["device_id"],
        request_data["officer_id"],
        f"Tx: {registration.get('tx_hash', '')}"
    )
    return jsonify(hardware_response(
        True,
        "BENEFICIARY_REGISTERED",
        "Fingerprint enrolled and beneficiary registered on blockchain",
        request=final_status.get("request"),
        tx_hash=registration.get("tx_hash"),
        block=registration.get("block")
    )), 200


@app.route("/api/fingerprint/status", methods=["POST"])
@app.route("/api/hardware/enrollment/status", methods=["POST"])
@require_auth(["ADMIN", "NGO"])
def update_enrollment_status_message():
    data = request.get_json() or {}
    errors = validate(data, {
        "beneficiary_id": {"required": True, "type": "int", "min": 1001, "max": 1127},
        "device_id": {"required": True, "type": "str", "min": 3, "max": 100},
        "status_message": {"required": True, "type": "str", "min": 1, "max": 200}
    })

    if errors:
        return jsonify(hardware_response(
            False,
            "STATUS_UPDATE_INVALID",
            " | ".join(errors)
        )), 400

    beneficiary_id = int(data["beneficiary_id"])
    device_id = data["device_id"].strip()
    status_code = str(data.get("status_code", "ENROLLING")).strip().upper() or "ENROLLING"
    status_message = data["status_message"].strip()

    log_result = log_enrollment_status(
        beneficiary_id,
        device_id,
        status_code,
        status_message
    )

    return jsonify(hardware_response(
        True,
        "STATUS_UPDATED",
        "Enrollment status updated",
        beneficiary_id=beneficiary_id,
        status=log_result["status"]
    )), 200


@app.route("/api/fingerprint/status", methods=["GET"])
@app.route("/api/hardware/enrollment/status", methods=["GET"])
@require_auth(["ADMIN", "NGO"])
def get_enrollment_status_message():
    beneficiary_id_str = request.args.get("beneficiary_id", "").strip()
    if not beneficiary_id_str:
        return jsonify(hardware_response(
            False,
            "BENEFICIARY_ID_REQUIRED",
            "beneficiary_id query parameter is required"
        )), 400

    try:
        beneficiary_id = int(beneficiary_id_str)
    except ValueError:
        return jsonify(hardware_response(
            False,
            "INVALID_BENEFICIARY_ID",
            "beneficiary_id must be an integer"
        )), 400

    status_result = get_latest_enrollment_status(beneficiary_id)
    if status_result["success"]:
        status_data = status_result["status"]
    else:
        request_result = get_enrollment_request(beneficiary_id)
        if not request_result["success"]:
            return jsonify(hardware_response(
                False,
                "STATUS_NOT_FOUND",
                "No status available for this beneficiary"
            )), 404
        status_data = build_enrollment_status_payload(request_result["request"])

    return jsonify(hardware_response(
        True,
        "STATUS_RETRIEVED",
        "Enrollment status retrieved",
        status=status_data
    )), 200


@app.route("/api/hardware/profile", methods=["GET"])
@require_auth(["ADMIN", "NGO"])
def hardware_profile():
    # If there is an active session for this officer, return its details as the profile
    user = current_user()
    session_res = get_active_session(user["username"])
    if session_res.get("success"):
        session = session_res["session"]
        pkg = session.get("package", {})
        profile = {
            "location": session["location"],
            "officer_id": session["officer_id"],
            "device_id": "aidchain-field-01",
            "items": pkg.get("items", [])
        }
        return jsonify(hardware_response(
            True,
            "PROFILE_READY",
            "Active session loaded",
            profile=profile
        )), 200

    # Fallback to old hardware profile if no active session exists
    result = get_hardware_profile()
    if not result["success"]:
        return jsonify(hardware_response(
            False,
            "PROFILE_MISSING",
            result["error"]
        )), 404

    profile = result["profile"]
    return jsonify(hardware_response(
        True,
        "PROFILE_READY",
        "Hardware profile loaded",
        profile=profile
    )), 200


@app.route("/api/hardware/profile", methods=["POST"])
@require_auth(["ADMIN", "NGO"])
def update_hardware_profile_route():
    data = request.get_json() or {}
    
    if "items" not in data or not isinstance(data["items"], list) or len(data["items"]) == 0:
        return jsonify(hardware_response(
            False,
            "PROFILE_INVALID",
            "items must be a non-empty list"
        )), 400
        
    errors = validate(data, {
        "location": {"required": True, "type": "str", "min": 3, "max": 100},
        "officer_id": {"required": True, "type": "str", "min": 3, "max": 50},
        "device_id": {"required": True, "type": "str", "min": 3, "max": 100}
    })

    if errors:
        return jsonify(hardware_response(
            False,
            "PROFILE_INVALID",
            " | ".join(errors)
        )), 400

    result = update_hardware_profile(
        data["items"],
        data["location"],
        data["officer_id"],
        data["device_id"]
    )

    if not result["success"]:
        return jsonify(hardware_response(
            False,
            "PROFILE_INVALID",
            result["error"]
        )), 400

    return jsonify(hardware_response(
        True,
        "PROFILE_UPDATED",
        "Hardware profile updated",
        profile=result["profile"]
    )), 200

@app.route("/api/hardware/sms-log", methods=["POST"])
@require_auth(["ADMIN", "NGO"])
def hardware_sms_log():
    data = request.get_json() or {}
    phone = data.get("phone", "").strip()
    message = data.get("message", "").strip()
    status = data.get("status", "SENT").strip().upper()

    if not phone:
        return jsonify({"error": "phone is required"}), 400
    if not message:
        return jsonify({"error": "message is required"}), 400

    metadata = {
        "beneficiary_id": data.get("beneficiary_id"),
        "device_id": data.get("device_id", "unknown"),
        "tx_hash": data.get("tx_hash"),
        "source": "HARDWARE"
    }

    result = log_sms_event(phone, message, status=status, metadata=metadata)
    return jsonify(result), 200


@app.route("/api/sms/log", methods=["GET"])
@require_auth(["ADMIN", "NGO", "DONOR", "AUDITOR"])
def sms_log():
    return jsonify({"sms_log": get_sms_log()}), 200


# ================================================================
#  STATS ENDPOINT
# ================================================================

def build_distribution_analytics(total_transactions, limit=100):
    aid_totals = {}
    recent_totals = {}

    try:
        total = int(total_transactions or 0)
    except (TypeError, ValueError):
        total = 0

    if total <= 0:
        return {
            "aid_type_breakdown": [],
            "recent_activity": []
        }

    start = max(1, total - limit + 1)
    recent_start = max(1, total - 19)

    for tx_id in range(total, start - 1, -1):
        result = get_transaction(tx_id)
        if not result.get("success"):
            continue

        aid_type = str(result.get("aid_type") or "UNKNOWN").upper()
        amount = int(result.get("amount") or 0)
        aid_totals[aid_type] = aid_totals.get(aid_type, 0) + amount

        if tx_id >= recent_start:
            recent_totals[aid_type] = recent_totals.get(aid_type, 0) + amount

    return {
        "aid_type_breakdown": [
            {"name": aid_type, "value": amount}
            for aid_type, amount in aid_totals.items()
        ],
        "recent_activity": [
            {"name": aid_type, "amount": amount}
            for aid_type, amount in recent_totals.items()
        ]
    }


@app.route("/api/stats", methods=["GET"])
@require_auth(["ADMIN", "NGO", "DONOR", "AUDITOR"])
def stats():
    total_tx      = get_total_transactions()
    total_benes   = get_total_beneficiaries()
    cycle         = get_current_cycle()
    pending_txs   = get_pending()
    campaigns_res = list_campaigns()
    distribution_analytics = build_distribution_analytics(
        total_tx.get("total", 0)
    )

    active_session = get_active_session()
    
    return jsonify({
        "blockchain_online"  : w3.is_connected(),
        "current_cycle"      : cycle.get("cycle", 0),
        "total_transactions" : total_tx.get("total", 0),
        "total_beneficiaries": total_benes.get("total", 0),
        "pending_cache"      : len(pending_txs),
        "total_campaigns"    : len(campaigns_res.get("campaigns", [])),
        "active_session"     : active_session if active_session.get("success") else None,
        "chain_id"           : CHAIN_ID,
        "rpc_url"            : RPC_URL,
        "registry_address"   : REGISTRY_ADDRESS,
        "aid_address"        : AID_ADDRESS,
        "aid_type_breakdown" : distribution_analytics["aid_type_breakdown"],
        "recent_activity"    : distribution_analytics["recent_activity"]
    }), 200


# ================================================================
#  RUN SERVER
# ================================================================
@app.route("/api/hardware/events", methods=["GET"])
@require_auth(["ADMIN", "NGO", "DONOR", "AUDITOR"])
def get_hardware_events():
    limit = request.args.get("limit", 50, type=int)
    if limit < 1 or limit > 200:
        limit = 50

    result = get_recent_hardware_events(limit)
    if not result["success"]:
        return jsonify({"error": result["error"]}), 500

    return jsonify({"events": result["events"]}), 200

@app.route("/api/hardware/events", methods=["POST"])
@require_auth(["ADMIN", "NGO"])
def log_event():
    data = request.get_json() or {}
    event_type = data.get("event_type", "UNKNOWN")
    message = data.get("message", "")
    device_id = data.get("device_id", "unknown")
    details = data.get("details", "")
    
    user = current_user()
    officer_id = user["username"]
    
    log_hardware_event(event_type, message, device_id, officer_id, details)
    return jsonify({"success": True}), 200


@app.route("/api/sms/fallback", methods=["POST"])
@require_auth(["ADMIN", "NGO"])
def sms_fallback_trigger():
    data = request.get_json() or {}
    phone = data.get("phone")
    message = data.get("message")
    if not phone or not message:
        return jsonify({"success": False, "error": "phone and message are required"}), 400
    from sms import trigger_simgate_sms
    result = trigger_simgate_sms(phone, message)
    return jsonify(result), (200 if result["success"] else 500)


@app.route("/api/hardware/gsm-status", methods=["POST"])
@require_auth(["ADMIN", "NGO"])
def report_gsm_status():
    """ESP32 calls this every ~5 minutes to report its GSM signal."""
    data = request.get_json() or {}
    device_id  = data.get("device_id", "unknown")
    signal     = int(data.get("signal", 0))
    registered = int(data.get("registered", 0))
    update_gsm_status(device_id, signal, registered)
    return jsonify({"success": True, "message": "GSM status updated"}), 200


@app.route("/api/hardware/sms-queue", methods=["GET"])
@require_auth(["ADMIN", "NGO"])
def poll_sms_queue():
    """ESP32 polls this to check if the server has an SMS job for it to send."""
    result = get_pending_sms_job()
    if not result["success"]:
        return jsonify({"pending": False}), 200
    return jsonify({"pending": True, "job": result["job"]}), 200


@app.route("/api/hardware/sms-queue/result", methods=["POST"])
@require_auth(["ADMIN", "NGO"])
def sms_queue_result():
    """ESP32 reports back whether it successfully sent the queued SMS."""
    data   = request.get_json() or {}
    job_id = data.get("job_id")
    sent   = data.get("sent", False)
    if not job_id:
        return jsonify({"success": False, "error": "job_id required"}), 400

    if sent:
        mark_sms_job(job_id, "SENT")
    else:
        # Hardware failed — immediately fall back to SimGate
        job_res = get_pending_sms_job()
        mark_sms_job(job_id, "HW_FAILED")
        # Retry via gateway using data passed from ESP32
        phone   = data.get("phone", "")
        message = data.get("message", "")
        if phone and message:
            from sms import trigger_simgate_sms
            trigger_simgate_sms(phone, message)
            print(f"[SMS] HW failed. SimGate fallback triggered for {phone}")
    return jsonify({"success": True}), 200


@app.route("/api/hardware/gsm-status", methods=["GET"])
@require_auth(["ADMIN", "NGO", "DONOR", "AUDITOR"])
def get_gsm_status_route():
    """Dashboard can call this to display GSM module health."""
    return jsonify(get_gsm_status()), 200


if __name__ == "__main__":
    print("=" * 55)
    print("  Blockchain Aid Distribution API v2.0")
    print("  Author : Motisha John Mafukashe R2211825P")
    print("  Server : http://127.0.0.1:5000")
    print("=" * 55)
    app.run(debug=False, host="0.0.0.0", port=5000, threaded=True)
