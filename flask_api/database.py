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
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # allows dict-like access
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
            aid_type    TEXT    NOT NULL,
            aid_unit    TEXT    NOT NULL,
            amount      INTEGER NOT NULL,
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
            (id, aid_type, aid_unit, amount, location, officer_id, device_id, updated_at)
            VALUES (1, ?, ?, ?, ?, ?, ?, ?)
        """, (
            "MAIZE",
            "KG",
            50,
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
    "ENROLLING",
    "ENROLLED",
    "ACTIVE",
    "FAILED_ENROLLMENT",
    "FAILED_BLOCKCHAIN"
}


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

    return {"success": True, "profile": dict(row)}


def update_hardware_profile(aid_type, aid_unit, amount, location,
                            officer_id="ngo_officer",
                            device_id="aidchain-field-01"):
    aid_type_up = aid_type.strip().upper()
    aid_unit_up = aid_unit.strip().upper()

    if aid_type_up not in VALID_AID_TYPES:
        return {"success": False, "error": f"Unknown aid type: {aid_type}"}
    if aid_unit_up not in VALID_AID_UNITS:
        return {"success": False, "error": f"Unknown aid unit: {aid_unit}"}
    if amount <= 0:
        return {"success": False, "error": "Amount must be positive"}
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
        (id, aid_type, aid_unit, amount, location, officer_id, device_id, updated_at)
        VALUES (1, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            aid_type   = excluded.aid_type,
            aid_unit   = excluded.aid_unit,
            amount     = excluded.amount,
            location   = excluded.location,
            officer_id = excluded.officer_id,
            device_id  = excluded.device_id,
            updated_at = excluded.updated_at
    """, (
        aid_type_up,
        aid_unit_up,
        amount,
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
    cursor.execute("""
        SELECT * FROM beneficiary_enrollment_queue
        WHERE device_id = ?
          AND status IN ('PENDING_ENROLLMENT', 'FAILED_ENROLLMENT')
        ORDER BY created_at ASC, beneficiary_id ASC
        LIMIT 1
    """, (device_id.strip(),))
    row = cursor.fetchone()

    if not row:
        conn.close()
        return {"success": False, "error": "No pending enrollment job"}

    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("""
        UPDATE beneficiary_enrollment_queue
        SET status = 'ENROLLING',
            updated_at = ?
        WHERE beneficiary_id = ?
    """, (now, row["beneficiary_id"]))
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
