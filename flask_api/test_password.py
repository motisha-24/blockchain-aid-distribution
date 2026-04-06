#!/usr/bin/env python
import sqlite3
import bcrypt
import sys

DB_PATH = "users.db"

try:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Get admin user
    cursor.execute("SELECT username, password FROM users WHERE username = 'admin'")
    user = cursor.fetchone()
    
    if not user:
        print("❌ Admin user not found")
        sys.exit(1)
    
    print(f"User found: {user['username']}")
    print(f"Stored hash: {user['password'][:20]}...")
    
    # Test password
    test_password = "admin2024"
    stored_hash = user['password']
    
    try:
        is_valid = bcrypt.checkpw(
            test_password.encode('utf-8'), 
            stored_hash.encode('utf-8')
        )
        print(f"\nPassword test: 'admin2024'")
        print(f"Result: {'✅ VALID' if is_valid else '❌ INVALID'}")
        
        if not is_valid:
            print("\n🔍 Debugging:")
            print(f"  Hash type: {type(stored_hash)}")
            print(f"  Hash length: {len(stored_hash)}")
            print(f"  First 60 chars: {stored_hash[:60]}")
    except Exception as e:
        print(f"❌ Error checking password: {e}")
        print(f"  Hash value: {repr(stored_hash)}")
    
    conn.close()
    
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
