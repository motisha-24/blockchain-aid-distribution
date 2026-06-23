# Flask API - /distribute Endpoint

## Endpoint Information
**Route:** `POST /api/distribute`  
**Authentication:** JWT (ADMIN or NGO role)  
**Rate Limit:** 15 requests per minute  
**Content-Type:** application/json

---

## Request Validation
```python
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
```
**Validates:**
- Beneficiary exists and is active
- Amount is positive
- Aid type is valid (MAIZE, CASH, SEEDS, etc.)
- Aid unit matches the aid type (KG, USD, etc.)
- Location is specified

---

## Campaign Validation (Optional)
```python
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
```
**Ensures:**
- Campaign exists and is active
- Aid type matches campaign requirements
- Campaign has sufficient budget remaining

---

## Duplicate Prevention
```python
    # Duplicate check - prevent double distribution in same cycle
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
```
**Returns:** HTTP 409 Conflict if already distributed

---

## Two Processing Paths

### Path A: Online Distribution (Connected to Blockchain)
```python
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
```

**Executes:**
1. Reserve campaign budget
2. Call smart contract (`distribute_aid`)
3. Get blockchain transaction hash
4. Log hardware event
5. Return success with tx_hash

---

### Path B: Offline/Cached Distribution
```python
    else:
        if campaign_id:
            reserve = reserve_campaign_budget(campaign_id, amount)
            if not reserve["success"]:
                return jsonify({"error": reserve["error"]}), 400

        cached = cache_transaction(
            b_id, amount, aid_type, aid_unit, location,
            data.get("officer_id", "unknown"),
```

**When Blockchain is Down:**
- Transaction stored in cache database
- Hardware device receives `"action": "CACHED_FOR_SYNC"`
- On blockchain recovery, cached transactions auto-sync
- Prevents aid distribution interruption

---

## Error Handling

### Distribution Failed (Blockchain Error)
```python
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
```
- Releases reserved budget
- Logs failure with reason
- Returns HTTP 500 for retry

---

## Response Examples

### Success Response (HTTP 200)
```json
{
  "success": true,
  "action": "DISTRIBUTED",
  "message": "Aid distributed successfully",
  "mode": "ONLINE",
  "tx_hash": "0x7f8d9e2c1a5b4d3e6f9a2b1c4d5e6f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d",
  "block": 12345,
  "beneficiary_id": 101,
  "aid_type": "MAIZE",
  "aid_unit": "KG",
  "amount": 50,
  "location": "Harare",
  "campaign_id": 5
}
```

### Duplicate Blocked (HTTP 409)
```json
{
  "success": false,
  "action": "DUPLICATE_BLOCKED",
  "message": "Beneficiary already received MAIZE this cycle",
  "duplicate": true,
  "mode": "ONLINE",
  "beneficiary_id": 101,
  "aid_type": "MAIZE"
}
```

### Cached Response (Blockchain Offline, HTTP 200)
```json
{
  "success": true,
  "action": "CACHED_FOR_SYNC",
  "message": "Transaction cached - will sync when blockchain recovers",
  "mode": "OFFLINE",
  "cache_id": 1234,
  "beneficiary_id": 101
}
```

---

## Key Features

1. **Dual-Mode Operation**: Online with blockchain or offline with caching
2. **Budget Reservation**: Prevents overspending from concurrent requests
3. **Campaign Integration**: Links distributions to specific aid campaigns
4. **Event Logging**: Complete audit trail of all distributions
5. **Duplicate Prevention**: One aid type per beneficiary per cycle
6. **Hardware Integration**: Communicates with ESP32 devices via response format
7. **Rate Limiting**: 15 requests/minute per user prevents abuse
