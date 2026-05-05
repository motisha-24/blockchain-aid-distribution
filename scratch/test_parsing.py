
import sqlite3
import re

def test_parsing():
    conn = sqlite3.connect("flask_api/users.db")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM hardware_events WHERE event_type = 'AID_DISTRIBUTED' ORDER BY timestamp DESC LIMIT 150")
    rows = cursor.fetchall()
    events = [dict(row) for row in rows]
    conn.close()

    print(f"Total events found: {len(events)}")
    
    seen = set()
    detail_list = []
    
    for evt in events:
        message = evt.get('message', '')
        # Simulate the JS regex: /beneficiary\s+(\d+)/i
        match = re.search(r'beneficiary\s+(\d+)', message, re.IGNORECASE)
        if match:
            b_id = match.group(1)
            if b_id not in seen:
                seen.add(b_id)
                detail_list.append({"id": b_id, "status": "COLLECTED"})
                print(f"Found beneficiary {b_id} in message: {message}")
        else:
            print(f"No match in message: {message}")

    print(f"Total unique collectors identified: {len(detail_list)}")

if __name__ == "__main__":
    test_parsing()
