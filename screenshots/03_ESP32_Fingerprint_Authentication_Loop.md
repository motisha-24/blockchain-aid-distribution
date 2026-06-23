# ESP32 Firmware - Fingerprint Authentication and API Submission Loop

## Hardware Setup
- **Microcontroller:** ESP32-WROOM-32
- **Fingerprint Sensor:** AS608 (UART2)
- **GSM Module:** SIM800L (UART1)
- **LEDs:** Green (GPIO21), Red (GPIO22)

---

## Fingerprint Authentication Loop

### Main Distribution Loop (DISTRIBUTE Mode)
```cpp
void loop() {
  // ... (WiFi management, GSM heartbeat, SMS queue polling)

  if (strcmp(SYSTEM_MODE, "DISTRIBUTE") == 0) {
    // Periodically refresh session/profile
    if (WiFi.status() == WL_CONNECTED &&
        millis() - lastEnrollmentPollMs >= 30000) {
      lastEnrollmentPollMs = millis();
      fetchHardwareProfile();
    }

    // Report GSM heartbeat every 5 minutes
    if (WiFi.status() == WL_CONNECTED &&
        millis() - lastGsmHeartbeatMs >= 300000) {
      lastGsmHeartbeatMs = millis();
      reportGsmHeartbeat();
    }

    // Poll SMS queue every 10 seconds
    if (WiFi.status() == WL_CONNECTED &&
        millis() - lastSmsQueuePollMs >= 10000) {
      lastSmsQueuePollMs = millis();
      pollAndSendSmsQueue();
    }

    // Distribution mode: continuously scan for fingerprints
    if (millis() - lastFingerHandledMs < FINGER_COOLDOWN_MS) {
      delay(MAIN_LOOP_DELAY_MS);
      return;
    }

    // Scan for fingerprint for aid distribution
    int slotId = scanFingerprintSlot();
    if (slotId > 0) {
      Serial.printf("[SCAN] Recognized fingerprint in slot %d\n", slotId);
      signalIdentified(); // Fast Green 3x

      // Calculate beneficiary ID from slot
      int beneficiaryId = slotId + SLOT_ID_OFFSET;

      // Distribute aid via API
      submitDistribution(beneficiaryId);

      lastFingerHandledMs = millis();
    } else if (slotId == -2 || slotId == -3) {
      // Failed scan
      signalFailure();
      Serial.println("[SCAN] Fingerprint scan failed.");
      lastFingerHandledMs = millis();
    }
  }

  delay(MAIN_LOOP_DELAY_MS);
}
```

---

## Step 1: Fingerprint Scanning
```cpp
int scanFingerprintSlot() {
  uint8_t p = finger.getImage();
  if (p == FINGERPRINT_NOFINGER) return -1;

  if (p != FINGERPRINT_OK) {
    Serial.printf("[AUTH] getImage failed: %u\n", p);
    logHardwareEvent("FINGER_DETECTED_FAILED", "Finger detected but capture failed", 
                     "Error code: " + String(p));
    return -2;
  }

  logHardwareEvent("FINGER_DETECTED", "Finger detected on sensor, identifying...");
```

**Returns:**
- `> 0`: Slot ID (match found)
- `-1`: No finger detected
- `-2`: Capture failed
- `-3`: No match or confidence too low

---

## Step 2: Image Processing
```cpp
  p = finger.image2Tz();
  if (p != FINGERPRINT_OK) {
    Serial.printf("[AUTH] image2Tz failed: %u\n", p);
    logHardwareEvent("IDENTITY_CHECK_FAILED", "Could not process fingerprint image", 
                     "Error code: " + String(p));
    return -2;
  }
```
Converts raw fingerprint image to template for matching

---

## Step 3: Fingerprint Matching
```cpp
  p = finger.fingerSearch();
  if (p == FINGERPRINT_OK) {
    Serial.printf("[AUTH] Match found. Slot=%d Confidence=%d\n",
                  finger.fingerID, finger.confidence);
    if (finger.confidence < MIN_CONFIDENCE) {
      Serial.println("[AUTH] Match confidence below threshold.");
      logHardwareEvent("IDENTITY_UNCONFIRMED", "Finger match confidence too low", 
                       "Confidence: " + String(finger.confidence));
      return -3;
    }
    
    int beneficiaryId = finger.fingerID + SLOT_ID_OFFSET;
    logHardwareEvent("IDENTITY_CONFIRMED", "Identity confirmed for beneficiary " + String(beneficiaryId), 
                     "Confidence: " + String(finger.confidence));
    return finger.fingerID;
  }

  Serial.println("[AUTH] No matching fingerprint found.");
  logHardwareEvent("IDENTITY_UNKNOWN", "Fingerprint not recognized in database");
  return -3;
}
```
**Validation:**
- Searches fingerprint database in AS608 sensor
- Checks confidence level against `MIN_CONFIDENCE` threshold
- Converts slot ID to beneficiary ID using offset mapping

---

## Step 4: Authentication Success/Failure

### Success - Submit Distribution
```cpp
void handleAuthenticationSuccess(int slotId) {
  int beneficiaryId = slotId + SLOT_ID_OFFSET;
  attemptCount = 0;

  Serial.printf("[AUTH] Authenticated slot %d -> beneficiary %d\n",
                slotId, beneficiaryId);

  submitDistribution(beneficiaryId);
  lastFingerHandledMs = millis();
}
```

### Failure - Attempt Tracking
```cpp
void handleAuthenticationFailure() {
  attemptCount++;
  signalFailure();
  Serial.printf("[AUTH] Failed attempt %d of %d\n",
                attemptCount, MAX_FAILED_ATTEMPTS);

  if (attemptCount >= MAX_FAILED_ATTEMPTS) {
    lockSession(0);
  } else {
    Serial.printf("[AUTH] Remaining attempts: %d\n",
                  MAX_FAILED_ATTEMPTS - attemptCount);
  }
}
```
**After MAX_FAILED_ATTEMPTS (3):**
- Device locks with red LED
- Requires device reset
- Failure attempt reported to API

---

## API Submission Flow

### Submit Distribution Request
```cpp
void submitDistribution(int beneficiaryId) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[API] Flask unreachable over WiFi.");
    signalFailure();
    return;
  }

  HTTPClient http;
  http.begin(endpointUrl("/api/distribute/batch"));
  http.setTimeout(60000); // 60 seconds timeout for blockchain transactions
  
  if (!addJsonHeaders(http)) {
    http.end();
    Serial.println("[AUTH] Missing JWT token.");
    signalTokenExpired();
    return;
  }

  DynamicJsonDocument doc(2048);
  doc["beneficiary_id"] = beneficiaryId;
  doc["location"] = ACTIVE_LOCATION;
  doc["officer_id"] = OFFICER_ID;
  doc["device_id"] = DEVICE_ID;

  DynamicJsonDocument itemsDoc(1024);
  deserializeJson(itemsDoc, ACTIVE_ITEMS_JSON);
  doc["items"] = itemsDoc.as<JsonArray>();

  String body;
  serializeJson(doc, body);

  logHardwareEvent("DISTRIBUTION_STARTED", "Initiating blockchain transaction for beneficiary " + String(beneficiaryId));

  int status = http.POST(body);
  String response = http.getString();
  http.end();

  Serial.printf("[API] /api/distribute/batch HTTP %d\n", status);
  if (status > 0) {
    handleDistributeResponse(beneficiaryId, status, response);
  } else {
    Serial.printf("[API] Connection failed: %s\n", http.errorToString(status).c_str());
    logHardwareEvent("CONNECTION_FAILED", "Hardware could not reach server during distribution", 
                     "Error: " + http.errorToString(status));
    signalFailure();
  }
}
```

**Request Payload:**
```json
{
  "beneficiary_id": 101,
  "location": "Harare",
  "officer_id": "ngo_officer",
  "device_id": "aidchain-distribution-01",
  "items": [
    {
      "aid_type": "MAIZE",
      "aid_unit": "KG",
      "amount": 50
    }
  ]
}
```

---

## API Response Handling

### Success Response (HTTP 200)
```cpp
void handleDistributeResponse(int beneficiaryId, int httpStatus,
                              const String& body) {
  DynamicJsonDocument doc(2048);
  DeserializationError err = deserializeJson(doc, body);
  if (err) {
    Serial.printf("[API] JSON parse failed: %s\n", err.c_str());
    signalFailure();
    return;
  }

  String action = doc["action"] | "UNKNOWN";
  String message = doc["message"] | "";

  Serial.printf("[API] Action: %s | Message: %s\n", action.c_str(), message.c_str());

  // Handle Success (Online or Cached)
  if (httpStatus == 200 && (action == "BATCH_PROCESSED" || action == "CACHED_FOR_SYNC")) {
    Serial.println("[API] Distribution confirmed.");
    signalSuccess(); // Instant Green LED feedback
    
    // Determine the reference ID for the SMS
    String txHash = "SUCCESS";
    JsonArray results = doc["results"].as<JsonArray>();
    for (JsonObject r : results) {
        if (r["success"] == true) {
            if (r.containsKey("tx_hash")) {
                txHash = String((const char*)(r["tx_hash"]));
                break;
            } else if (r.containsKey("cache_id")) {
                txHash = "CACHE-" + String((int)(r["cache_id"]));
                break;
            }
        }
    }
    
    // Handle the SMS/Logging asynchronously
    handleSuccessfulDistribution(beneficiaryId, txHash);
    return;
  }
```

### Duplicate Blocked (HTTP 409)
```cpp
  // Handle Duplicates
  if (httpStatus == 409 && (action == "DUPLICATE_BLOCKED" || action == "BATCH_FAILED")) {
    signalDuplicate();
    Serial.println("[API] Batch or duplicate distribution blocked.");
    return;
  }
```

### Token Expired (HTTP 401)
```cpp
  // Handle Auth Expired
  if (httpStatus == 401) {
    signalTokenExpired();
    Serial.println("[AUTH] Token invalid or expired.");
    refreshJwtToken();
    return;
  }
```

### General Failure
```cpp
  // General Failure
  signalFailure();
  Serial.printf("[API] Distribution failed with HTTP %d: %s\n", httpStatus, message.c_str());
}
```

---

## SMS Sending After Distribution

### Beneficiary Notification
```cpp
void handleSuccessfulDistribution(int beneficiaryId, const String& txReference) {
  if (!gsmAlive()) {
    Serial.println("[SMS] GSM module not detected. Skipping SMS confirmation.");
    return;
  }
  
  BeneficiaryInfo info = fetchBeneficiaryInfo(beneficiaryId);
  if (!info.success || info.phone.length() == 0) {
    Serial.println("[SMS] Beneficiary phone lookup failed. SMS skipped.");
    return;
  }

  String smsMessage = buildMessage(
    info.name.length() > 0 ? info.name : String("Beneficiary"),
    ACTIVE_AID_AMOUNT,
    ACTIVE_AID_TYPE,
    ACTIVE_AID_UNIT,
    truncateRef(txReference, 12)
  );

  bool smsSent = sendSmsViaSim800L(info.phone, smsMessage);
  reportSmsLog(beneficiaryId, info.phone, smsMessage, txReference, 
               smsSent ? "SENT" : "FAILED");

  if (smsSent) {
    Serial.println("[SMS] Beneficiary SMS sent via SIM800L.");
    logHardwareEvent("SMS_SENT", "SMS confirmation sent to " + info.phone);
  } else {
    Serial.println("[SMS] Hardware failed. Attempting cloud fallback...");
    bool fallbackSent = sendSmsViaFallback(info.phone, smsMessage);
    
    reportSmsLog(beneficiaryId, info.phone, smsMessage, txReference,
                 fallbackSent ? "SENT_VIA_GATEWAY" : "TOTAL_FAILURE");

    if (fallbackSent) {
      Serial.println("[SMS] Success: SMS sent via Cloud Gateway fallback.");
    } else {
      Serial.println("[SMS] CRITICAL: Both hardware and cloud fallback failed.");
    }
  }
}
```

**SMS Message Example:**
```
Dear John, you received 50 KG of MAIZE. Ref: 0x7f8d9e2c1a5b. AidChain Zimbabwe.
```

---

## LED Signal Codes

| Signal | Meaning | Code |
|--------|---------|------|
| 3 Fast Green | Fingerprint identified | `signalIdentified()` |
| 3 Gentle Green | Distribution recorded | `signalRecorded()` / `signalSuccess()` |
| 3 Red Blinks | Failed transaction | `signalFailure()` |
| 3 Red Blinks | Duplicate detected | `signalDuplicate()` |
| 1 Red Long Blink | Token expired | `signalTokenExpired()` |
| Solid Red | Session locked | `holdLockedState()` |
| Alternating Green/Red | Self-test on boot | `runSelfTest()` |

---

## Complete Flow Diagram

```
DISTRIBUTE MODE LOOP
│
├─ Fingerprint Scan (scanFingerprintSlot)
│  ├─ No Finger? → Wait & Return
│  ├─ Capture Failed? → Signal Failure, Increment Attempts
│  ├─ Match Confidence Low? → Signal Failure
│  └─ Match Found? → Continue
│
├─ Authentication Success (handleAuthenticationSuccess)
│  ├─ Reset Attempt Counter
│  └─ Prepare API Request
│
├─ Submit Distribution (submitDistribution)
│  ├─ Build JSON payload with beneficiary, location, items
│  ├─ POST to /api/distribute/batch
│  ├─ Wait up to 60 seconds for blockchain
│  └─ Handle Response
│
├─ Response Handling (handleDistributeResponse)
│  ├─ HTTP 200 + BATCH_PROCESSED? → Signal Success
│  ├─ HTTP 200 + CACHED_FOR_SYNC? → Signal Success (offline cache)
│  ├─ HTTP 409 (Duplicate)? → Signal Duplicate
│  ├─ HTTP 401 (Token)? → Refresh & Retry
│  └─ Other? → Signal Failure
│
├─ SMS Notification (handleSuccessfulDistribution)
│  ├─ Fetch Beneficiary Info (name, phone)
│  ├─ Send SMS via SIM800L
│  ├─ Fallback to Cloud Gateway if failed
│  └─ Report SMS status to API
│
└─ Cooldown (FINGER_COOLDOWN_MS) before next scan
```

---

## Key Features

1. **Offline Resilience**: Device continues if Flask API is unreachable
2. **Automatic SMS Fallback**: Uses cloud gateway if GSM module fails
3. **Event Logging**: All checks logged to Flask API for audit trail
4. **Attempt Tracking**: Locks device after 3 failed attempts for security
5. **Token Management**: Auto-refreshes JWT when expired
6. **Budget Enforcement**: Only distributes if campaign.remaining > amount
7. **Single Distribution Per Cycle**: Duplicate prevention enforced
8. **Real-time Feedback**: LED signals provide immediate user feedback
