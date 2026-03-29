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