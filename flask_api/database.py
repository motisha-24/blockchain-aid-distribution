# ================================================================
#  database.py — SQLite User Database
#  Manages system user accounts with role-based access
#  Author: Motisha John Mafukashe — R2211825P
# ================================================================

import sqlite3
import hashlib
import os
import datetime

# ── Database file location ────────────────────────────────────
DB_PATH = os.path.join(os.path.dirname(__file__), "users.db")


# ── Hash password ─────────────────────────────────────────────
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


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


# ── Verify login credentials ──────────────────────────────────
def verify_login(username: str, password: str):
    user = get_user(username)
    if not user:
        return None
    if user["password"] != hash_password(password):
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