# ================================================================
#  database.py — SQLite User Database
#  Manages system user accounts with role-based access
#  Author: Motisha John Mafukashe — R2211825P
# ================================================================

import sqlite3
import hashlib
import os
import datetime
import bcrypt
import json

# ── Database file location ────────────────────────────────────
DB_PATH = os.path.join(os.path.dirname(__file__), "users.db")


# ── Hash password ─────────────────────────────────────────────
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def legacy_hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, stored_hash: str) -> bool:
    if not stored_hash:
        return False

    if stored_hash.startswith("$2"):
        try:
            return bcrypt.checkpw(password.encode(), stored_hash.encode())
        except ValueError:
            return False

    return stored_hash == legacy_hash_password(password)


# ── Get database connection ───────────────────────────────────
def get_connection():
    # Added timeout and WAL mode to prevent 'database is locked' errors
    conn = sqlite3.connect(DB_PATH, timeout=30, check_same_thread=False)
    conn.row_factory = sqlite3.Row  # allows dict-like access
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


# ── Create tables on first run ────────────────────────────────
def init_database():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id          INTEGER  PRIMARY KEY AUTOINCREMENT,
            username    TEXT     UNIQUE NOT NULL,
            password    TEXT     NOT NULL,
            role        TEXT     NOT NULL,
            name        TEXT     NOT NULL,
            email       TEXT     DEFAULT '',
            created_at  TEXT     NOT NULL,
            last_login  TEXT     DEFAULT '',
            active      INTEGER  DEFAULT 1
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS campaigns (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            name         TEXT    NOT NULL,
            donor_label  TEXT    NOT NULL,
            aid_type     TEXT    NOT NULL,
            budget_total INTEGER NOT NULL,
            budget_used  INTEGER NOT NULL DEFAULT 0,
            active       INTEGER NOT NULL DEFAULT 1,
            created_at   TEXT    NOT NULL,
            updated_at   TEXT    NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS hardware_profile (
            id          INTEGER PRIMARY KEY CHECK (id = 1),
            items       TEXT    NOT NULL,
            location    TEXT    NOT NULL,
            officer_id  TEXT    NOT NULL DEFAULT 'ngo_officer',
            device_id   TEXT    NOT NULL DEFAULT 'aidchain-field-01',
            updated_at  TEXT    NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS beneficiary_enrollment_queue (
            beneficiary_id INTEGER PRIMARY KEY,
            slot_id        INTEGER NOT NULL,
            name           TEXT    NOT NULL,
            national_id    TEXT    NOT NULL,
            phone          TEXT    NOT NULL,
            location       TEXT    NOT NULL,
            officer_id     TEXT    NOT NULL,
            device_id      TEXT    NOT NULL,
            status         TEXT    NOT NULL,
            error_message  TEXT    DEFAULT '',
            blockchain_tx  TEXT    DEFAULT '',
            created_at     TEXT    NOT NULL,
            updated_at     TEXT    NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS hardware_events (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type  TEXT    NOT NULL,
            message     TEXT    NOT NULL,
            device_id   TEXT    NOT NULL,
            officer_id  TEXT    NOT NULL,
            timestamp   TEXT    NOT NULL,
            details     TEXT    DEFAULT ''
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS enrollment_status_updates (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            beneficiary_id   INTEGER NOT NULL,
            device_id        TEXT    NOT NULL,
            status_code      TEXT    NOT NULL,
            status_message   TEXT    NOT NULL,
            created_at       TEXT    NOT NULL
        )
    """)

    # Patch older database schema if the hardware_events table was created before officer_id/timestamp/details existed
    existing_columns = {row[1] for row in cursor.execute("PRAGMA table_info(hardware_events)")}
    if 'officer_id' not in existing_columns:
        cursor.execute("ALTER TABLE hardware_events ADD COLUMN officer_id TEXT NOT NULL DEFAULT ''")
    if 'timestamp' not in existing_columns:
        cursor.execute("ALTER TABLE hardware_events ADD COLUMN timestamp TEXT NOT NULL DEFAULT ''")
    if 'details' not in existing_columns:
        cursor.execute("ALTER TABLE hardware_events ADD COLUMN details TEXT DEFAULT ''")

    # New Aid Distribution Schema
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS aid_packages (
            id          TEXT     PRIMARY KEY,
            cycle_id    TEXT     NOT NULL,
            location    TEXT     NOT NULL,
            items       TEXT     NOT NULL,
            is_active   INTEGER  DEFAULT 1,
            created_at  TEXT     NOT NULL,
            updated_at  TEXT     NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS distribution_sessions (
            id                TEXT     PRIMARY KEY,
            officer_id        TEXT     NOT NULL,
            location          TEXT     NOT NULL,
            active_package_id TEXT     NOT NULL,
            start_time        TEXT     NOT NULL,
            end_time          TEXT,
            status            TEXT     NOT NULL DEFAULT 'RUNNING'
        )
    """)

    # GSM Module Status — updated by ESP32 heartbeat every few minutes
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS gsm_status (
            id          INTEGER PRIMARY KEY CHECK (id = 1),
            device_id   TEXT    NOT NULL DEFAULT '',
            signal      INTEGER NOT NULL DEFAULT 0,
            registered  INTEGER NOT NULL DEFAULT 0,
            updated_at  TEXT    NOT NULL DEFAULT ''
        )
    """)

    # SMS Queue — jobs created by server, picked up and sent by ESP32
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sms_queue (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            phone       TEXT    NOT NULL,
            message     TEXT    NOT NULL,
            status      TEXT    NOT NULL DEFAULT 'PENDING',
            created_at  TEXT    NOT NULL,
            sent_at     TEXT    DEFAULT ''
        )
    """)

    conn.commit()

    # ── Seed default users if table is empty ─────────────────
    cursor.execute("SELECT COUNT(*) FROM users")
    count = cursor.fetchone()[0]

    if count == 0:
        print("[DB] Seeding default users...")
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        default_users = [
            ("admin",       "admin2024",  "ADMIN",   "System Administrator",  "admin@aidchain.zw"),
            ("ngo_officer", "ngo2024",    "NGO",     "NGO Field Officer",      "ngo@aidchain.zw"),
            ("donor_view",  "donor2024",  "DONOR",   "Donor Representative",   "donor@aidchain.zw"),
            ("auditor_01",  "audit2024",  "AUDITOR", "Independent Auditor",    "auditor@aidchain.zw"),
        ]

        for username, password, role, name, email in default_users:
            cursor.execute("""
                INSERT INTO users
                (username, password, role, name, email, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                username,
                hash_password(password),
                role, name, email, now
            ))
            print(f"[DB] Created user: {username} ({role})")

        conn.commit()
        print("[DB] Default users created successfully")

    cursor.execute("SELECT COUNT(*) FROM hardware_profile")
    profile_count = cursor.fetchone()[0]
    if profile_count == 0:
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute("""
            INSERT INTO hardware_profile
            (id, items, location, officer_id, device_id, updated_at)
            VALUES (1, ?, ?, ?, ?, ?)
        """, (
            json.dumps([{"aid_type": "MAIZE", "aid_unit": "KG", "amount": 50, "campaign_id": None}]),
            "Gweru Ward 5",
            "ngo_officer",
            "aidchain-field-01",
            now
        ))
        conn.commit()
        print("[DB] Default hardware profile created")

    conn.close()


# ── Get user by username ──────────────────────────────────────
def get_user(username: str):
    conn   = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM users WHERE username = ? AND active = 1",
        (username,)
    )
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return None


def get_users_by_email(email: str):
    conn   = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT username, role, name, email
        FROM users
        WHERE LOWER(email) = LOWER(?) AND active = 1
        ORDER BY username ASC
        """,
        (email.strip(),)
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


# ── Verify login credentials ──────────────────────────────────
def verify_login(username: str, password: str):
    user = get_user(username)
    if not user:
        return None
    if not verify_password(password, user["password"]):
        return None
    return user


# ── Update last login timestamp ───────────────────────────────
def update_last_login(username: str):
    conn   = get_connection()
    cursor = conn.cursor()
    now    = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute(
        "UPDATE users SET last_login = ? WHERE username = ?",
        (now, username)
    )
    conn.commit()
    conn.close()


# ── Get all users ─────────────────────────────────────────────
def get_all_users():
    conn   = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, username, role, name, email, created_at, last_login, active FROM users"
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


# ── Create a new user ─────────────────────────────────────────
def create_user(username, password, role, name, email=""):
    conn   = get_connection()
    cursor = conn.cursor()
    now    = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Validate role
    valid_roles = ["ADMIN", "NGO", "DONOR", "AUDITOR"]
    if role.upper() not in valid_roles:
        conn.close()
        return {"success": False, "error": f"Invalid role. Must be one of: {valid_roles}"}

    try:
        cursor.execute("""
            INSERT INTO users
            (username, password, role, name, email, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            username.strip(),
            hash_password(password),
            role.upper(),
            name.strip(),
            email.strip(),
            now
        ))
        conn.commit()
        conn.close()
        return {"success": True, "message": f"User {username} created"}
    except sqlite3.IntegrityError:
        conn.close()
        return {"success": False, "error": "Username already exists"}
    except Exception as e:
        conn.close()
        return {"success": False, "error": str(e)}


# ── Update user password ──────────────────────────────────────
def update_password(username, new_password):
    conn   = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE users SET password = ? WHERE username = ?",
        (hash_password(new_password), username)
    )
    conn.commit()
    conn.close()
    return {"success": True, "message": "Password updated"}


def recover_password(username, email, new_password):
    conn   = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        UPDATE users
        SET password = ?
        WHERE username = ? AND LOWER(email) = LOWER(?) AND active = 1
        """,
        (hash_password(new_password), username.strip(), email.strip())
    )
    conn.commit()
    changed = cursor.rowcount
    conn.close()
    if changed == 0:
        return {"success": False, "error": "No active account matched those details"}
    return {"success": True, "message": "Password reset successful"}


# ── Deactivate user account ───────────────────────────────────
def deactivate_user(username):
    conn   = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE users SET active = 0 WHERE username = ?",
        (username,)
    )
    conn.commit()
    conn.close()
    return {"success": True, "message": f"User {username} deactivated"}

VALID_AID_TYPES = [
    "MAIZE", "CASH", "OIL", "SEEDS",
    "CLOTHES", "FERTILISER", "BLANKETS"
]

VALID_AID_UNITS = [
    "KG", "USD", "LITRES", "PACKETS", "UNITS"
]

VALID_ENROLLMENT_STATUSES = {
    "PENDING_ENROLLMENT",
    "WAITING_FOR_FINGERPRINT",
    "ENROLLING",
    "ENROLLED",
    "ACTIVE",
    "FAILED_ENROLLMENT",
    "FAILED_BLOCKCHAIN"
}

ENROLLMENT_RETRY_AFTER_SECONDS = 120


def create_campaign(name, donor_label, aid_type, budget_total):
    aid_type_up = aid_type.strip().upper()
    if aid_type_up not in VALID_AID_TYPES:
        return {"success": False, "error": f"Unknown aid type: {aid_type}"}
    if budget_total <= 0:
        return {"success": False, "error": "Campaign budget must be positive"}

    conn   = get_connection()
    cursor = conn.cursor()
    now    = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    try:
        cursor.execute("""
            INSERT INTO campaigns
            (name, donor_label, aid_type, budget_total, budget_used,
             active, created_at, updated_at)
            VALUES (?, ?, ?, ?, 0, 1, ?, ?)
        """, (
            name.strip(), donor_label.strip(), aid_type_up,
            budget_total, now, now
        ))
        conn.commit()
        campaign_id = cursor.lastrowid
        conn.close()
        return {"success": True, "campaign_id": campaign_id}
    except Exception as e:
        conn.close()
        return {"success": False, "error": str(e)}


def get_campaign(campaign_id):
    conn   = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM campaigns WHERE id = ?",
        (campaign_id,)
    )
    row = cursor.fetchone()
    conn.close()
    if not row:
        return {"success": False, "error": "Campaign not found"}
    campaign = dict(row)
    campaign["remaining"] = campaign["budget_total"] - campaign["budget_used"]
    return {"success": True, "campaign": campaign}


def list_campaigns():
    conn   = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM campaigns ORDER BY id DESC"
    )
    rows = cursor.fetchall()
    conn.close()
    campaigns = []
    for row in rows:
        campaign = dict(row)
        campaign["remaining"] = campaign["budget_total"] - campaign["budget_used"]
        campaigns.append(campaign)
    return {"success": True, "campaigns": campaigns}


def reserve_campaign_budget(campaign_id, amount):
    if amount <= 0:
        return {"success": False, "error": "Amount must be positive"}

    campaign_res = get_campaign(campaign_id)
    if not campaign_res["success"]:
        return campaign_res
    campaign = campaign_res["campaign"]
    if not campaign["active"]:
        return {"success": False, "error": "Campaign is inactive"}

    remaining = campaign["remaining"]
    if amount > remaining:
        return {"success": False, "error": "Campaign budget exceeded"}

    conn   = get_connection()
    cursor = conn.cursor()
    now    = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute(
        "UPDATE campaigns SET budget_used = budget_used + ?, updated_at = ? WHERE id = ?",
        (amount, now, campaign_id)
    )
    conn.commit()
    conn.close()
    return {"success": True}


def release_campaign_budget(campaign_id, amount):
    if amount <= 0:
        return {"success": False, "error": "Amount must be positive"}

    campaign_res = get_campaign(campaign_id)
    if not campaign_res["success"]:
        return campaign_res
    campaign = campaign_res["campaign"]
    new_used = max(0, campaign["budget_used"] - amount)

    conn   = get_connection()
    cursor = conn.cursor()
    now    = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute(
        "UPDATE campaigns SET budget_used = ?, updated_at = ? WHERE id = ?",
        (new_used, now, campaign_id)
    )
    conn.commit()
    conn.close()
    return {"success": True}


def get_hardware_profile():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM hardware_profile WHERE id = 1")
    row = cursor.fetchone()
    conn.close()

    if not row:
        return {"success": False, "error": "Hardware profile not configured"}

    profile = dict(row)
    try:
        profile["items"] = json.loads(profile["items"])
    except:
        profile["items"] = []
    
    # Check if there is an active session to override profile
    session = get_active_session()
    if session.get("success") and session.get("session"):
        s = session["session"]
        profile["location"] = s.get("location", profile["location"])
        profile["officer_id"] = s.get("officer_id", profile["officer_id"])
        if s.get("package") and s["package"].get("items"):
            profile["items"] = s["package"]["items"]
            profile["session_id"] = s["id"]
    
    return {"success": True, "profile": profile}


def update_hardware_profile(items, location,
                            officer_id="ngo_officer",
                            device_id="aidchain-field-01"):
    if not isinstance(items, list) or len(items) == 0:
        return {"success": False, "error": "Items must be a non-empty list"}

    validated_items = []
    for item in items:
        aid_type = item.get("aid_type", "").strip().upper()
        aid_unit = item.get("aid_unit", "").strip().upper()
        amount = item.get("amount", 0)
        campaign_id = item.get("campaign_id")
        
        if aid_type not in VALID_AID_TYPES:
            return {"success": False, "error": f"Unknown aid type: {aid_type}"}
        if aid_unit not in VALID_AID_UNITS:
            return {"success": False, "error": f"Unknown aid unit: {aid_unit}"}
        try:
            amount = int(amount)
            if amount <= 0:
                raise ValueError
        except:
            return {"success": False, "error": f"Amount for {aid_type} must be positive"}
            
        validated_items.append({
            "aid_type": aid_type,
            "aid_unit": aid_unit,
            "amount": amount,
            "campaign_id": campaign_id
        })

    if not location.strip():
        return {"success": False, "error": "Location is required"}
    if not officer_id.strip():
        return {"success": False, "error": "Officer ID is required"}
    if not device_id.strip():
        return {"success": False, "error": "Device ID is required"}

    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("""
        INSERT INTO hardware_profile
        (id, items, location, officer_id, device_id, updated_at)
        VALUES (1, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            items      = excluded.items,
            location   = excluded.location,
            officer_id = excluded.officer_id,
            device_id  = excluded.device_id,
            updated_at = excluded.updated_at
    """, (
        json.dumps(validated_items),
        location.strip(),
        officer_id.strip(),
        device_id.strip(),
        now
    ))
    conn.commit()
    conn.close()

    return get_hardware_profile()


def queue_beneficiary_enrollment(beneficiary_id, name, national_id, phone,
                                 location, officer_id, device_id):
    if beneficiary_id <= 1000:
        return {
            "success": False,
            "error": "Beneficiary ID must be greater than 1000 for slot mapping"
        }

    slot_id = beneficiary_id - 1000
    if slot_id <= 0 or slot_id > 127:
        return {
            "success": False,
            "error": "Beneficiary ID must map to AS608 slot range 1-127"
        }

    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        DELETE FROM enrollment_status_updates
        WHERE beneficiary_id = ?
    """, (beneficiary_id,))
    cursor.execute("""
        INSERT INTO beneficiary_enrollment_queue
        (beneficiary_id, slot_id, name, national_id, phone, location,
         officer_id, device_id, status, error_message, blockchain_tx,
         created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_ENROLLMENT', '', '', ?, ?)
        ON CONFLICT(beneficiary_id) DO UPDATE SET
            slot_id        = excluded.slot_id,
            name           = excluded.name,
            national_id    = excluded.national_id,
            phone          = excluded.phone,
            location       = excluded.location,
            officer_id     = excluded.officer_id,
            device_id      = excluded.device_id,
            status         = 'PENDING_ENROLLMENT',
            error_message  = '',
            blockchain_tx  = '',
            updated_at     = excluded.updated_at
    """, (
        beneficiary_id, slot_id, name.strip(), national_id.strip(),
        phone.strip(), location.strip(), officer_id.strip(),
        device_id.strip(), now, now
    ))
    conn.commit()
    conn.close()
    return get_enrollment_request(beneficiary_id)


def get_enrollment_request(beneficiary_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM beneficiary_enrollment_queue
        WHERE beneficiary_id = ?
    """, (beneficiary_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return {"success": False, "error": "Enrollment request not found"}

    return {"success": True, "request": dict(row)}


def list_enrollment_requests():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM beneficiary_enrollment_queue
        ORDER BY updated_at DESC, beneficiary_id DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    return {"success": True, "requests": [dict(row) for row in rows]}


def get_next_pending_enrollment(device_id):
    conn = get_connection()
    cursor = conn.cursor()
    stale_before = (
        datetime.datetime.now() -
        datetime.timedelta(seconds=ENROLLMENT_RETRY_AFTER_SECONDS)
    ).strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("""
        SELECT * FROM beneficiary_enrollment_queue
        WHERE device_id = ?
          AND (
                status IN ('WAITING_FOR_FINGERPRINT', 'FAILED_ENROLLMENT')
                OR (status = 'ENROLLING' AND updated_at <= ?)
          )
        ORDER BY created_at ASC, beneficiary_id ASC
        LIMIT 1
    """, (device_id.strip(), stale_before))
    row = cursor.fetchone()

    if not row:
        conn.close()
        return {"success": False, "error": "No pending enrollment job"}

    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    error_message = ""
    if row["status"] == "ENROLLING":
        error_message = "Previous enrollment attempt timed out. Retrying."
    cursor.execute("""
        UPDATE beneficiary_enrollment_queue
        SET status = 'ENROLLING',
            error_message = ?,
            updated_at = ?
        WHERE beneficiary_id = ?
    """, (error_message, now, row["beneficiary_id"]))
    conn.commit()
    conn.close()
    return get_enrollment_request(row["beneficiary_id"])


def update_enrollment_status(beneficiary_id, status, error_message="",
                             blockchain_tx=""):
    if status not in VALID_ENROLLMENT_STATUSES:
        return {"success": False, "error": f"Invalid status: {status}"}

    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE beneficiary_enrollment_queue
        SET status = ?, error_message = ?, blockchain_tx = ?, updated_at = ?
        WHERE beneficiary_id = ?
    """, (
        status, error_message.strip(), blockchain_tx.strip(),
        now, beneficiary_id
    ))
    conn.commit()
    changed = cursor.rowcount
    conn.close()

    if changed == 0:
        return {"success": False, "error": "Enrollment request not found"}

    return get_enrollment_request(beneficiary_id)


def log_enrollment_status(beneficiary_id, device_id, status_code, status_message):
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO enrollment_status_updates
        (beneficiary_id, device_id, status_code, status_message, created_at)
        VALUES (?, ?, ?, ?, ?)
    """, (
        int(beneficiary_id),
        device_id.strip(),
        status_code.strip(),
        status_message.strip(),
        now
    ))
    conn.commit()
    conn.close()
    return {
        "success": True,
        "status": {
            "beneficiary_id": int(beneficiary_id),
            "device_id": device_id.strip(),
            "status_code": status_code.strip(),
            "status_message": status_message.strip(),
            "created_at": now
        }
    }


def get_latest_enrollment_status(beneficiary_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT beneficiary_id, device_id, status_code, status_message, created_at
        FROM enrollment_status_updates
        WHERE beneficiary_id = ?
        ORDER BY id DESC
        LIMIT 1
    """, (int(beneficiary_id),))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return {"success": False, "error": "No status available for this beneficiary"}

    return {"success": True, "status": dict(row)}

# ── Reactivate user account ───────────────────────────────────
def reactivate_user(username):
    conn   = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE users SET active = 1 WHERE username = ?",
        (username,)
    )
    conn.commit()
    conn.close()
    return {"success": True, "message": f"User {username} reactivated"}

# ── Permanently delete a user ─────────────────────────────
def delete_user_db(username):
    conn   = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "DELETE FROM users WHERE username = ?",
        (username,)
    )
    conn.commit()
    conn.close()
    return {"success": True, "message": f"User {username} permanently deleted"}


# ── Hardware Events Logging ───────────────────────────────────
def log_hardware_event(event_type, message, device_id, officer_id, details=""):
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO hardware_events
        (event_type, message, device_id, officer_id, timestamp, details, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        event_type.strip(), message.strip(), device_id.strip(),
        officer_id.strip(), now, details.strip(), now
    ))


    conn.commit()
    conn.close()
    return {"success": True}


def get_recent_hardware_events(limit=50):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM hardware_events
        ORDER BY timestamp DESC
        LIMIT ?
    """, (limit,))
    rows = cursor.fetchall()
    conn.close()
    return {"success": True, "events": [dict(row) for row in rows]}


# ── Aid Packages & Distribution Sessions ─────────────────────

import uuid

def create_aid_package(cycle_id, location, items):
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    package_id = str(uuid.uuid4())
    
    # Validate items
    if not isinstance(items, list) or len(items) == 0:
        return {"success": False, "error": "Items must be a non-empty list"}
        
    for item in items:
        if item.get("aid_type", "").upper() not in VALID_AID_TYPES:
            return {"success": False, "error": f"Invalid aid type: {item.get('aid_type')}"}
        if item.get("unit", "").upper() not in VALID_AID_UNITS:
            # Fallback to aid_unit
            if item.get("aid_unit", "").upper() not in VALID_AID_UNITS:
                return {"success": False, "error": f"Invalid aid unit: {item.get('unit') or item.get('aid_unit')}"}
            else:
                item["unit"] = item["aid_unit"].upper()
        else:
            item["unit"] = item["unit"].upper()
            
        item["type"] = item.get("aid_type", "").upper()
        
    try:
        cursor.execute("""
            INSERT INTO aid_packages (id, cycle_id, location, items, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, 1, ?, ?)
        """, (package_id, cycle_id, location, json.dumps(items), now, now))
        conn.commit()
        return {"success": True, "package_id": package_id}
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        conn.close()

def get_active_aid_packages(location=None):
    conn = get_connection()
    cursor = conn.cursor()
    if location:
        cursor.execute("SELECT * FROM aid_packages WHERE is_active = 1 AND location = ?", (location,))
    else:
        cursor.execute("SELECT * FROM aid_packages WHERE is_active = 1")
    rows = cursor.fetchall()
    conn.close()
    
    packages = []
    for row in rows:
        pkg = dict(row)
        try:
            pkg["items"] = json.loads(pkg["items"])
        except:
            pkg["items"] = []
        packages.append(pkg)
    return {"success": True, "packages": packages}

def delete_aid_package(package_id):
    """Soft-delete an aid package by marking it inactive."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id FROM aid_packages WHERE id = ? AND is_active = 1", (package_id,))
        if not cursor.fetchone():
            return {"success": False, "error": "Package not found or already deleted"}
        cursor.execute(
            "UPDATE aid_packages SET is_active = 0, updated_at = ? WHERE id = ?",
            (datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"), package_id)
        )
        conn.commit()
        return {"success": True, "message": "Package deleted"}
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        conn.close()

def close_old_sessions():
    try:
        conn = get_connection()
        cursor = conn.cursor()
        # Close any sessions started before today
        today_str = datetime.datetime.now().strftime("%Y-%m-%d 00:00:00")
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute("""
            UPDATE distribution_sessions 
            SET status = 'CLOSED', end_time = ? 
            WHERE status = 'RUNNING' AND start_time < ?
        """, (now, today_str))
        conn.commit()
    except sqlite3.OperationalError as e:
        if "locked" in str(e).lower():
            # If locked, another process is already cleaning up or updating sessions.
            # We can safely skip this since it's just a background cleanup.
            pass
        else:
            raise e
    finally:
        if 'conn' in locals():
            conn.close()

def activate_distribution_session(officer_id, location, active_package_id):
    # First close old sessions
    close_old_sessions()
    
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    session_id = str(uuid.uuid4())
    
    # Check if package exists and is active
    cursor.execute("SELECT id FROM aid_packages WHERE id = ? AND is_active = 1", (active_package_id,))
    if not cursor.fetchone():
        conn.close()
        return {"success": False, "error": "Invalid or inactive aid package"}
        
    # Close any existing running session for this officer
    cursor.execute("UPDATE distribution_sessions SET status = 'CLOSED', end_time = ? WHERE officer_id = ? AND status = 'RUNNING'", (now, officer_id))
    
    cursor.execute("""
        INSERT INTO distribution_sessions (id, officer_id, location, active_package_id, start_time, status)
        VALUES (?, ?, ?, ?, ?, 'RUNNING')
    """, (session_id, officer_id, location, active_package_id, now))
    conn.commit()
    conn.close()
    return {"success": True, "session_id": session_id}

def get_active_session(officer_id=None):
    close_old_sessions()
    conn = get_connection()
    cursor = conn.cursor()
    
    if officer_id:
        cursor.execute("SELECT * FROM distribution_sessions WHERE officer_id = ? AND status = 'RUNNING'", (officer_id,))
    else:
        cursor.execute("SELECT * FROM distribution_sessions WHERE status = 'RUNNING'")
        
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        return {"success": False, "error": "No active session found"}
        
    session = dict(row)
    
    # Also fetch the package details
    cursor.execute("SELECT * FROM aid_packages WHERE id = ?", (session["active_package_id"],))
    pkg_row = cursor.fetchone()
    conn.close()
    
    if pkg_row:
        pkg = dict(pkg_row)
        try:
            pkg["items"] = json.loads(pkg["items"])
            session["package"] = pkg
        except:
            session["package"] = None
            
    return {"success": True, "session": session}


# ── GSM Status ────────────────────────────────────────────────
def update_gsm_status(device_id: str, signal: int, registered: int) -> None:
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = get_connection()
    conn.execute("""
        INSERT INTO gsm_status (id, device_id, signal, registered, updated_at)
        VALUES (1, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            device_id=excluded.device_id,
            signal=excluded.signal,
            registered=excluded.registered,
            updated_at=excluded.updated_at
    """, (device_id, signal, registered, now))
    conn.commit()
    conn.close()


def get_gsm_status() -> dict:
    conn = get_connection()
    row = conn.execute("SELECT * FROM gsm_status WHERE id = 1").fetchone()
    conn.close()
    if not row:
        return {"online": False, "signal": 0, "registered": False}
    data = dict(row)
    # Consider GSM "online" if updated within last 6 minutes and registered
    import datetime as dt
    try:
        last = dt.datetime.strptime(data["updated_at"], "%Y-%m-%d %H:%M:%S")
        age_seconds = (dt.datetime.now() - last).total_seconds()
        online = age_seconds < 360 and data["registered"] == 1 and data["signal"] > 0
    except:
        online = False
    return {
        "online": online,
        "signal": data["signal"],
        "registered": bool(data["registered"]),
        "device_id": data["device_id"],
        "updated_at": data["updated_at"]
    }


# ── SMS Queue ─────────────────────────────────────────────────
def queue_sms(phone: str, message: str) -> dict:
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO sms_queue (phone, message, status, created_at)
        VALUES (?, ?, 'PENDING', ?)
    """, (phone, message, now))
    conn.commit()
    job_id = cursor.lastrowid
    conn.close()
    return {"success": True, "id": job_id}


def get_pending_sms_job() -> dict:
    conn = get_connection()
    row = conn.execute("""
        SELECT * FROM sms_queue WHERE status = 'PENDING'
        ORDER BY id ASC LIMIT 1
    """).fetchone()
    conn.close()
    if not row:
        return {"success": False}
    return {"success": True, "job": dict(row)}


def mark_sms_job(job_id: int, status: str) -> None:
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = get_connection()
    conn.execute("""
        UPDATE sms_queue SET status = ?, sent_at = ? WHERE id = ?
    """, (status, now, job_id))
    conn.commit()
    conn.close()
