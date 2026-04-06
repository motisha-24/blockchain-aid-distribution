#!/usr/bin/env python
import sqlite3
import sys

DB_PATH = "users.db"
try:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('SELECT username, role, active FROM users')
    users = cursor.fetchall()
    print('Users in database:')
    if users:
        for user in users:
            print(f'  {user[0]:20} | Role: {user[1]:10} | Active: {user[2]}')
    else:
        print('  ❌ No users found - Database not initialized')
    conn.close()
except Exception as e:
    print(f'Error: {e}')
    sys.exit(1)
