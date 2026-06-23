import sys
import os
sys.path.append(os.path.join(os.getcwd(), "flask_api"))

from blockchain import distribute_aid, w3, account

beneficiary_id = 1003
amount = 1
aid_type = "TEST"
aid_unit = "UNIT"
location = "TEST-LOC"

print(f"Attempting test distribution for beneficiary {beneficiary_id}...")
# Use wait_for_receipt=True to catch the actual error
result = distribute_aid(beneficiary_id, amount, aid_type, aid_unit, location, wait_for_receipt=True)

if result["success"]:
    print(f"SUCCESS! Tx Hash: {result['tx_hash']}")
    print(f"Block: {result['block']}")
else:
    print(f"FAILED: {result.get('error')}")
