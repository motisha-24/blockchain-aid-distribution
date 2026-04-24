/*
 * ================================================================
 *  AidChain - ESP32 Hardware Integration Firmware
 *  Hardware:
 *    - ESP32-WROOM-32
 *    - AS608 fingerprint sensor on UART2
 *    - SIM800L GSM module on UART1
 *    - Green LED on GPIO21
 *    - Red LED on GPIO22
 *
 *  Wiring used by this sketch:
 *    AS608 TX -> ESP32 GPIO16 (RX2)
 *    AS608 RX -> ESP32 GPIO17 (TX2)
 *    SIM800L TX -> ESP32 GPIO18 (RX1)
 *    SIM800L RX -> ESP32 GPIO19 (TX1)
 *    Green LED anode -> GPIO21 through 220 ohm resistor
 *    Red LED anode   -> GPIO22 through 220 ohm resistor
 *
 *  This firmware talks only to the Flask API.
 * ================================================================
 */

#include <Adafruit_Fingerprint.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ----------------------------------------------------------------
// Config - update these before uploading
// ----------------------------------------------------------------
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* API_BASE_URL = "http://192.168.1.100:5000";
const char* HARDWARE_USERNAME = "ngo_officer";
const char* HARDWARE_PASSWORD = "ngo2024";
String JWT_TOKEN = "";

String DEVICE_ID = "aidchain-field-01";
String OFFICER_ID = "ngo_officer";

String ACTIVE_AID_TYPE = "MAIZE";
String ACTIVE_AID_UNIT = "KG";
int ACTIVE_AID_AMOUNT = 50;
String ACTIVE_LOCATION = "Gweru Ward 5";

// ----------------------------------------------------------------
// Pin and hardware setup
// ----------------------------------------------------------------
constexpr int GREEN_LED_PIN = 21;
constexpr int RED_LED_PIN = 22;

constexpr int FP_RX_PIN = 16;
constexpr int FP_TX_PIN = 17;
constexpr int GSM_RX_PIN = 18;
constexpr int GSM_TX_PIN = 19;

constexpr uint32_t SERIAL_BAUD = 115200;
constexpr uint32_t FP_BAUD = 57600;
constexpr uint32_t GSM_BAUD = 9600;

constexpr int SLOT_ID_OFFSET = 1000;
constexpr int MIN_CONFIDENCE = 60;
constexpr int MAX_FAILED_ATTEMPTS = 3;
constexpr unsigned long WIFI_RECONNECT_MS = 10000;
constexpr unsigned long MAIN_LOOP_DELAY_MS = 120;
constexpr unsigned long FINGER_COOLDOWN_MS = 1600;
constexpr unsigned long ENROLLMENT_POLL_MS = 5000;

HardwareSerial FingerSerial(2);
HardwareSerial GsmSerial(1);
Adafruit_Fingerprint finger(&FingerSerial);

bool sessionLocked = false;
int attemptCount = 0;
unsigned long lastWifiReconnectMs = 0;
unsigned long lastFingerHandledMs = 0;
unsigned long lastEnrollmentPollMs = 0;

struct BeneficiaryInfo {
  bool success = false;
  String name;
  String phone;
  String location;
};

struct EnrollmentJob {
  bool available = false;
  int beneficiaryId = 0;
  int slotId = 0;
  String name;
  String location;
  String deviceId;
};

// ----------------------------------------------------------------
// LED helpers
// ----------------------------------------------------------------
void setGreen(bool on) {
  digitalWrite(GREEN_LED_PIN, on ? HIGH : LOW);
}

void setRed(bool on) {
  digitalWrite(RED_LED_PIN, on ? HIGH : LOW);
}

void allLedsOff() {
  setGreen(false);
  setRed(false);
}

void blinkLed(int pin, int times, int onMs, int offMs) {
  for (int i = 0; i < times; i++) {
    digitalWrite(pin, HIGH);
    delay(onMs);
    digitalWrite(pin, LOW);
    delay(offMs);
  }
}

void blinkBoth(int times, int onMs, int offMs) {
  for (int i = 0; i < times; i++) {
    setGreen(true);
    setRed(true);
    delay(onMs);
    allLedsOff();
    delay(offMs);
  }
}

void runSelfTest() {
  blinkLed(GREEN_LED_PIN, 1, 180, 120);
  blinkLed(RED_LED_PIN, 1, 180, 120);
  blinkBoth(1, 220, 160);
}

void signalSuccess() {
  blinkLed(GREEN_LED_PIN, 3, 180, 130);
}

void signalFailure() {
  blinkLed(RED_LED_PIN, 2, 160, 110);
}

void signalDuplicate() {
  blinkLed(RED_LED_PIN, 3, 200, 120);
}

void signalTokenExpired() {
  blinkLed(RED_LED_PIN, 1, 600, 160);
}

void signalCached() {
  blinkLed(GREEN_LED_PIN, 1, 750, 220);
}

void holdLockedState() {
  setGreen(false);
  setRed(true);
}

// ----------------------------------------------------------------
// Utility helpers
// ----------------------------------------------------------------
String endpointUrl(const char* path) {
  return String(API_BASE_URL) + path;
}

String buildMessage(const String& name, int amount, const String& aidType,
                    const String& aidUnit, const String& txRef) {
  String itemDesc;
  if (aidType.equalsIgnoreCase("CASH")) {
    itemDesc = "USD " + String(amount);
  } else {
    itemDesc = String(amount) + " " + aidUnit + " of " + aidType;
  }

  String message = "Dear " + name + ", you received " + itemDesc +
                   ". Ref: " + txRef + ". AidChain Zimbabwe.";
  return message;
}

String truncateRef(const String& value, size_t maxLen) {
  if (value.length() <= maxLen) return value;
  return value.substring(0, maxLen);
}

// ----------------------------------------------------------------
// WiFi helpers
// ----------------------------------------------------------------
void connectWifiBlocking() {
  Serial.printf("[WIFI] Connecting to %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.print("[WIFI] Connected. IP: ");
  Serial.println(WiFi.localIP());
}

void ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) return;

  unsigned long now = millis();
  if (now - lastWifiReconnectMs < WIFI_RECONNECT_MS) return;

  lastWifiReconnectMs = now;
  Serial.println("[WIFI] Connection lost. Attempting reconnection...");
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

// ----------------------------------------------------------------
// GSM helpers
// ----------------------------------------------------------------
String readGsmResponse(unsigned long timeoutMs = 1000) {
  String response;
  unsigned long start = millis();
  while (millis() - start < timeoutMs) {
    while (GsmSerial.available()) {
      response += char(GsmSerial.read());
    }
    delay(10);
  }
  response.trim();
  return response;
}

bool gsmCommand(const String& command, const String& expected,
                unsigned long timeoutMs = 1000) {
  while (GsmSerial.available()) GsmSerial.read();
  GsmSerial.println(command);
  String response = readGsmResponse(timeoutMs);
  Serial.printf("[GSM] %s -> %s\n", command.c_str(), response.c_str());
  return response.indexOf(expected) >= 0;
}

bool gsmAlive() {
  return gsmCommand("AT", "OK", 800);
}

bool sendSmsViaSim800L(const String& phone, const String& message) {
  if (!gsmAlive()) {
    Serial.println("[GSM] Module not responding.");
    return false;
  }

  if (!gsmCommand("AT+CMGF=1", "OK", 1000)) {
    Serial.println("[GSM] Could not switch to text mode.");
    return false;
  }

  while (GsmSerial.available()) GsmSerial.read();
  GsmSerial.print("AT+CMGS=\"");
  GsmSerial.print(phone);
  GsmSerial.println("\"");
  String prompt = readGsmResponse(2000);
  Serial.printf("[GSM] CMGS prompt -> %s\n", prompt.c_str());

  if (prompt.indexOf(">") < 0) {
    Serial.println("[GSM] SMS prompt not received.");
    return false;
  }

  GsmSerial.print(message);
  GsmSerial.write(26);

  String response = readGsmResponse(8000);
  Serial.printf("[GSM] SMS send response -> %s\n", response.c_str());
  return response.indexOf("OK") >= 0 || response.indexOf("+CMGS") >= 0;
}

// ----------------------------------------------------------------
// HTTP helpers
// ----------------------------------------------------------------
bool addJsonHeaders(HTTPClient& http) {
  http.addHeader("Content-Type", "application/json");
  if (JWT_TOKEN.length() == 0) return false;
  http.addHeader("Authorization", "Bearer " + JWT_TOKEN);
  return true;
}

bool hardwareLogin() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[AUTH] Cannot login while WiFi is offline.");
    return false;
  }

  HTTPClient http;
  http.begin(endpointUrl("/api/hardware/login"));
  http.addHeader("Content-Type", "application/json");

  DynamicJsonDocument doc(384);
  doc["username"] = HARDWARE_USERNAME;
  doc["password"] = HARDWARE_PASSWORD;
  doc["device_id"] = DEVICE_ID;

  String body;
  serializeJson(doc, body);

  int status = http.POST(body);
  String response = http.getString();
  http.end();

  Serial.printf("[AUTH] Login status: %d\n", status);
  if (status != 200) {
    Serial.printf("[AUTH] Login failed: %s\n", response.c_str());
    return false;
  }

  DynamicJsonDocument payload(768);
  DeserializationError err = deserializeJson(payload, response);
  if (err) {
    Serial.printf("[AUTH] Login JSON parse failed: %s\n", err.c_str());
    return false;
  }

  const char* token = payload["token"];
  if (!token || String(token).length() == 0) {
    Serial.println("[AUTH] Login response did not contain a token.");
    return false;
  }

  JWT_TOKEN = String(token);
  OFFICER_ID = String((const char*)(payload["username"] | HARDWARE_USERNAME));
  Serial.printf("[AUTH] Logged in as %s\n", OFFICER_ID.c_str());
  return true;
}

bool refreshJwtToken() {
  if (JWT_TOKEN.length() == 0) {
    return hardwareLogin();
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[AUTH] Cannot refresh token while WiFi is offline.");
    return false;
  }

  HTTPClient http;
  http.begin(endpointUrl("/api/auth/refresh"));
  if (!addJsonHeaders(http)) {
    http.end();
    Serial.println("[AUTH] JWT token is empty.");
    return false;
  }

  int status = http.POST("{}");
  String body = http.getString();
  http.end();

  Serial.printf("[AUTH] Refresh status: %d\n", status);
  if (status != 200) {
    Serial.printf("[AUTH] Refresh failed: %s\n", body.c_str());
    return false;
  }

  DynamicJsonDocument doc(512);
  DeserializationError err = deserializeJson(doc, body);
  if (err) {
    Serial.printf("[AUTH] Refresh JSON parse failed: %s\n", err.c_str());
    return false;
  }

  const char* token = doc["token"];
  if (!token || String(token).length() == 0) {
    Serial.println("[AUTH] Refresh response did not include a token.");
    return false;
  }

  JWT_TOKEN = String(token);
  Serial.println("[AUTH] JWT token refreshed in device memory.");
  return true;
}

bool fetchHardwareProfile() {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  http.begin(endpointUrl("/api/hardware/profile"));
  if (!addJsonHeaders(http)) {
    http.end();
    return false;
  }

  int status = http.GET();
  String body = http.getString();
  http.end();

  Serial.printf("[PROFILE] HTTP %d\n", status);
  if (status == 401) {
    return refreshJwtToken() && fetchHardwareProfile();
  }

  if (status != 200) {
    Serial.printf("[PROFILE] Failed: %s\n", body.c_str());
    return false;
  }

  DynamicJsonDocument doc(1024);
  DeserializationError err = deserializeJson(doc, body);
  if (err) {
    Serial.printf("[PROFILE] JSON parse failed: %s\n", err.c_str());
    return false;
  }

  JsonObject profile = doc["profile"];
  if (profile.isNull()) {
    Serial.println("[PROFILE] Missing profile payload.");
    return false;
  }

  ACTIVE_AID_TYPE = String((const char*)(profile["aid_type"] | ACTIVE_AID_TYPE.c_str()));
  ACTIVE_AID_UNIT = String((const char*)(profile["aid_unit"] | ACTIVE_AID_UNIT.c_str()));
  ACTIVE_AID_AMOUNT = profile["amount"] | ACTIVE_AID_AMOUNT;
  ACTIVE_LOCATION = String((const char*)(profile["location"] | ACTIVE_LOCATION.c_str()));
  OFFICER_ID = String((const char*)(profile["officer_id"] | OFFICER_ID.c_str()));
  DEVICE_ID = String((const char*)(profile["device_id"] | DEVICE_ID.c_str()));

  Serial.printf("[PROFILE] %s %d %s @ %s | officer=%s | device=%s\n",
                ACTIVE_AID_TYPE.c_str(),
                ACTIVE_AID_AMOUNT,
                ACTIVE_AID_UNIT.c_str(),
                ACTIVE_LOCATION.c_str(),
                OFFICER_ID.c_str(),
                DEVICE_ID.c_str());
  return true;
}

EnrollmentJob fetchNextEnrollmentJob() {
  EnrollmentJob job;
  if (WiFi.status() != WL_CONNECTED) return job;

  HTTPClient http;
  String url = endpointUrl(("/api/hardware/enrollment/next?device_id=" + DEVICE_ID).c_str());
  http.begin(url);
  if (!addJsonHeaders(http)) {
    http.end();
    return job;
  }

  int status = http.GET();
  String body = http.getString();
  http.end();

  if (status == 401) {
    if (refreshJwtToken()) return fetchNextEnrollmentJob();
    return job;
  }

  if (status != 200) {
    return job;
  }

  DynamicJsonDocument doc(1536);
  DeserializationError err = deserializeJson(doc, body);
  if (err) {
    Serial.printf("[ENROLLMENT] Job parse failed: %s\n", err.c_str());
    return job;
  }

  JsonObject request = doc["request"];
  if (request.isNull()) return job;

  job.available = true;
  job.beneficiaryId = request["beneficiary_id"] | 0;
  job.slotId = request["slot_id"] | 0;
  job.name = String((const char*)(request["name"] | ""));
  job.location = String((const char*)(request["location"] | ""));
  job.deviceId = String((const char*)(request["device_id"] | ""));
  return job;
}

void reportEnrollmentResult(int beneficiaryId, int slotId, bool success,
                            const String& errorMessage) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[ENROLLMENT] Cannot report result while offline.");
    return;
  }

  HTTPClient http;
  http.begin(endpointUrl("/api/hardware/enrollment/result"));
  if (!addJsonHeaders(http)) {
    http.end();
    return;
  }

  DynamicJsonDocument doc(768);
  doc["beneficiary_id"] = beneficiaryId;
  doc["slot_id"] = slotId;
  doc["device_id"] = DEVICE_ID;
  doc["success"] = success;
  if (!success) {
    doc["error"] = errorMessage;
  }

  String body;
  serializeJson(doc, body);
  int status = http.POST(body);
  String response = http.getString();
  http.end();

  Serial.printf("[ENROLLMENT] Result HTTP %d -> %s\n", status, response.c_str());
}

bool hardwarePing() {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  http.begin(endpointUrl("/api/hardware/ping"));
  if (!addJsonHeaders(http)) {
    http.end();
    Serial.println("[AUTH] Missing JWT token.");
    return false;
  }

  int status = http.GET();
  String body = http.getString();
  http.end();

  Serial.printf("[PING] HTTP %d\n", status);
  if (status == 401) {
    Serial.println("[PING] Token expired or invalid.");
    return refreshJwtToken() && hardwarePing();
  }

  if (status != 200) {
    Serial.printf("[PING] Unexpected response: %s\n", body.c_str());
    return false;
  }

  DynamicJsonDocument doc(768);
  DeserializationError err = deserializeJson(doc, body);
  if (err) {
    Serial.printf("[PING] JSON parse failed: %s\n", err.c_str());
    return false;
  }

  Serial.printf("[PING] Action: %s | Blockchain online: %s | Cycle: %d\n",
                doc["action"] | "UNKNOWN",
                doc["blockchain_online"] ? "yes" : "no",
                doc["current_cycle"] | 0);
  return true;
}

BeneficiaryInfo fetchBeneficiaryInfo(int beneficiaryId) {
  BeneficiaryInfo info;
  if (WiFi.status() != WL_CONNECTED) return info;

  HTTPClient http;
  http.begin(endpointUrl(("/api/beneficiary/" + String(beneficiaryId)).c_str()));
  if (!addJsonHeaders(http)) {
    http.end();
    return info;
  }

  int status = http.GET();
  String body = http.getString();
  http.end();

  Serial.printf("[BENEFICIARY] HTTP %d\n", status);

  if (status == 401) {
    if (refreshJwtToken()) return fetchBeneficiaryInfo(beneficiaryId);
    return info;
  }

  if (status != 200) {
    Serial.printf("[BENEFICIARY] Lookup failed: %s\n", body.c_str());
    return info;
  }

  DynamicJsonDocument doc(1024);
  DeserializationError err = deserializeJson(doc, body);
  if (err) {
    Serial.printf("[BENEFICIARY] JSON parse failed: %s\n", err.c_str());
    return info;
  }

  info.success = doc["success"] | false;
  info.name = String((const char*)(doc["name"] | ""));
  info.phone = String((const char*)(doc["phone"] | ""));
  info.location = String((const char*)(doc["location"] | ""));
  return info;
}

void reportSmsLog(int beneficiaryId, const String& phone, const String& message,
                  const String& txHash, const String& status) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[SMS-LOG] WiFi offline. Skipping remote SMS log.");
    return;
  }

  HTTPClient http;
  http.begin(endpointUrl("/api/hardware/sms-log"));
  if (!addJsonHeaders(http)) {
    http.end();
    return;
  }

  DynamicJsonDocument doc(768);
  doc["phone"] = phone;
  doc["message"] = message;
  doc["status"] = status;
  doc["beneficiary_id"] = beneficiaryId;
  doc["device_id"] = DEVICE_ID;
  doc["tx_hash"] = txHash;

  String body;
  serializeJson(doc, body);

  int statusCode = http.POST(body);
  String response = http.getString();
  http.end();

  Serial.printf("[SMS-LOG] HTTP %d -> %s\n", statusCode, response.c_str());
}

void reportFailedAttempt(int beneficiaryId) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[SECURITY] WiFi offline. Failed-attempt report not sent.");
    return;
  }

  HTTPClient http;
  http.begin(endpointUrl("/api/auth/failed-attempt"));
  if (!addJsonHeaders(http)) {
    http.end();
    return;
  }

  DynamicJsonDocument doc(512);
  doc["attempts"] = attemptCount;
  doc["beneficiary_id"] = beneficiaryId > 0 ? beneficiaryId : 0;
  doc["location"] = ACTIVE_LOCATION;
  doc["officer_id"] = OFFICER_ID;
  doc["device_id"] = DEVICE_ID;

  String body;
  serializeJson(doc, body);

  int status = http.POST(body);
  String response = http.getString();
  http.end();

  Serial.printf("[SECURITY] Report HTTP %d -> %s\n", status, response.c_str());
}

void handleSuccessfulDistribution(int beneficiaryId, const String& txReference) {
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
  reportSmsLog(
    beneficiaryId,
    info.phone,
    smsMessage,
    txReference,
    smsSent ? "SENT" : "FAILED"
  );

  if (smsSent) {
    Serial.println("[SMS] Beneficiary SMS sent via SIM800L.");
  } else {
    Serial.println("[SMS] SMS send failed on SIM800L.");
  }
}

void handleDistributeResponse(int beneficiaryId, int httpStatus,
                              const String& body) {
  DynamicJsonDocument doc(2048);
  DeserializationError err = deserializeJson(doc, body);
  if (err) {
    Serial.printf("[API] JSON parse failed: %s\n", err.c_str());
    signalFailure();
    return;
  }

  String action = String((const char*)(doc["action"] | "UNKNOWN"));
  String message = String((const char*)(doc["message"] | ""));

  Serial.printf("[API] Action: %s | Message: %s\n",
                action.c_str(), message.c_str());

  if (httpStatus == 200 && action == "DISTRIBUTED") {
    signalSuccess();
    String txHash = String((const char*)(doc["tx_hash"] | ""));
    handleSuccessfulDistribution(beneficiaryId, txHash);
    return;
  }

  if (httpStatus == 200 && action == "CACHED_FOR_SYNC") {
    signalCached();
    String cacheRef = "CACHE-" + String((int)(doc["cache_id"] | 0));
    handleSuccessfulDistribution(beneficiaryId, cacheRef);
    return;
  }

  if (httpStatus == 409 && action == "DUPLICATE_BLOCKED") {
    signalDuplicate();
    Serial.println("[API] Duplicate distribution blocked.");
    return;
  }

  if (httpStatus == 401) {
    signalTokenExpired();
    Serial.println("[AUTH] Token invalid or expired.");
    if (refreshJwtToken()) {
      Serial.println("[AUTH] Token refreshed. Ready for next scan.");
    }
    return;
  }

  signalFailure();
  Serial.printf("[API] Distribution failed with HTTP %d: %s\n",
                httpStatus, message.c_str());
}

void submitDistribution(int beneficiaryId) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[API] Flask unreachable over WiFi. Server cannot cache.");
    signalFailure();
    return;
  }

  fetchHardwareProfile();

  HTTPClient http;
  http.begin(endpointUrl("/api/distribute"));
  if (!addJsonHeaders(http)) {
    http.end();
    Serial.println("[AUTH] Missing JWT token.");
    signalTokenExpired();
    return;
  }

  DynamicJsonDocument doc(768);
  doc["beneficiary_id"] = beneficiaryId;
  doc["amount"] = ACTIVE_AID_AMOUNT;
  doc["aid_type"] = ACTIVE_AID_TYPE;
  doc["aid_unit"] = ACTIVE_AID_UNIT;
  doc["location"] = ACTIVE_LOCATION;
  doc["officer_id"] = OFFICER_ID;
  doc["device_id"] = DEVICE_ID;

  String body;
  serializeJson(doc, body);

  int status = http.POST(body);
  String response = http.getString();
  http.end();

  Serial.printf("[API] /api/distribute HTTP %d\n", status);
  Serial.printf("[API] Body: %s\n", response.c_str());

  handleDistributeResponse(beneficiaryId, status, response);
}

// ----------------------------------------------------------------
// Fingerprint helpers
// ----------------------------------------------------------------
bool sensorReady() {
  finger.begin(FP_BAUD);
  if (finger.verifyPassword()) {
    Serial.println("[SENSOR] AS608 ready.");
    return true;
  }

  Serial.println("[SENSOR] ERROR: AS608 not detected.");
  return false;
}

bool waitForFingerImage(uint8_t expectedState) {
  uint8_t p = FINGERPRINT_NOFINGER;
  unsigned long start = millis();
  while (millis() - start < 10000) {
    p = finger.getImage();
    if (p == expectedState) return true;
    delay(40);
  }
  return false;
}

bool enrollFingerprintToSlot(int slot) {
  if (slot <= 0 || slot > 127) {
    Serial.println("[ENROLL] Invalid slot. Use 1-127.");
    return false;
  }

  Serial.printf("[ENROLL] Starting enrollment for slot %d\n", slot);
  Serial.println("[ENROLL] Place finger on sensor.");
  while (finger.getImage() != FINGERPRINT_OK) {
    delay(40);
  }

  if (finger.image2Tz(1) != FINGERPRINT_OK) {
    Serial.println("[ENROLL] First image conversion failed.");
    return false;
  }

  Serial.println("[ENROLL] Remove finger.");
  delay(2000);
  while (finger.getImage() != FINGERPRINT_NOFINGER) {
    delay(40);
  }

  Serial.println("[ENROLL] Place the same finger again.");
  while (finger.getImage() != FINGERPRINT_OK) {
    delay(40);
  }

  if (finger.image2Tz(2) != FINGERPRINT_OK) {
    Serial.println("[ENROLL] Second image conversion failed.");
    return false;
  }

  if (finger.createModel() != FINGERPRINT_OK) {
    Serial.println("[ENROLL] Fingerprints did not match.");
    return false;
  }

  if (finger.storeModel(slot) == FINGERPRINT_OK) {
    Serial.printf("[ENROLL] Finger stored in slot %d\n", slot);
    return true;
  } else {
    Serial.println("[ENROLL] Failed to store fingerprint.");
    return false;
  }
}

void enrollFingerprint() {
  Serial.println("[ENROLL] Enter slot number in Serial Monitor:");
  while (!Serial.available()) {
    delay(50);
  }

  int slot = Serial.parseInt();
  if (enrollFingerprintToSlot(slot)) {
    Serial.println("[ENROLL] Manual enrollment completed.");
  }
}

void processEnrollmentJob(const EnrollmentJob& job) {
  Serial.println();
  Serial.println("[ENROLLMENT] ------------------------------------");
  Serial.printf("[ENROLLMENT] Beneficiary: %d\n", job.beneficiaryId);
  Serial.printf("[ENROLLMENT] Name       : %s\n", job.name.c_str());
  Serial.printf("[ENROLLMENT] Slot       : %d\n", job.slotId);
  Serial.printf("[ENROLLMENT] Device     : %s\n", job.deviceId.c_str());
  Serial.println("[ENROLLMENT] Place beneficiary finger on the sensor.");

  bool success = enrollFingerprintToSlot(job.slotId);
  reportEnrollmentResult(
    job.beneficiaryId,
    job.slotId,
    success,
    success ? "" : "AS608 enrollment failed on device"
  );

  if (success) {
    signalSuccess();
    Serial.println("[ENROLLMENT] Enrollment reported successfully.");
  } else {
    signalFailure();
    Serial.println("[ENROLLMENT] Enrollment failed and was reported.");
  }
  Serial.println("[ENROLLMENT] ------------------------------------");
  lastFingerHandledMs = millis();
}

int scanFingerprintSlot() {
  uint8_t p = finger.getImage();
  if (p == FINGERPRINT_NOFINGER) return -1;

  if (p != FINGERPRINT_OK) {
    Serial.printf("[AUTH] getImage failed: %u\n", p);
    return -2;
  }

  p = finger.image2Tz();
  if (p != FINGERPRINT_OK) {
    Serial.printf("[AUTH] image2Tz failed: %u\n", p);
    return -2;
  }

  p = finger.fingerSearch();
  if (p == FINGERPRINT_OK) {
    Serial.printf("[AUTH] Match found. Slot=%d Confidence=%d\n",
                  finger.fingerID, finger.confidence);
    if (finger.confidence < MIN_CONFIDENCE) {
      Serial.println("[AUTH] Match confidence below threshold.");
      return -3;
    }
    return finger.fingerID;
  }

  Serial.println("[AUTH] No matching fingerprint found.");
  return -3;
}

void lockSession(int beneficiaryId) {
  sessionLocked = true;
  holdLockedState();
  reportFailedAttempt(beneficiaryId);
  Serial.println("[SECURITY] Session locked. Reset device to continue.");
}

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

void handleAuthenticationSuccess(int slotId) {
  int beneficiaryId = slotId + SLOT_ID_OFFSET;
  attemptCount = 0;

  Serial.printf("[AUTH] Authenticated slot %d -> beneficiary %d\n",
                slotId, beneficiaryId);

  submitDistribution(beneficiaryId);
  lastFingerHandledMs = millis();
}

// ----------------------------------------------------------------
// Setup and main loop
// ----------------------------------------------------------------
void setup() {
  Serial.begin(SERIAL_BAUD);
  delay(200);

  pinMode(GREEN_LED_PIN, OUTPUT);
  pinMode(RED_LED_PIN, OUTPUT);
  allLedsOff();

  FingerSerial.begin(FP_BAUD, SERIAL_8N1, FP_RX_PIN, FP_TX_PIN);
  GsmSerial.begin(GSM_BAUD, SERIAL_8N1, GSM_RX_PIN, GSM_TX_PIN);

  Serial.println();
  Serial.println("[BOOT] AidChain hardware module starting...");
  Serial.printf("[BOOT] Device ID: %s\n", DEVICE_ID.c_str());

  if (!sensorReady()) {
    while (true) {
      blinkLed(RED_LED_PIN, 1, 120, 120);
    }
  }

  if (gsmAlive()) {
    Serial.println("[GSM] SIM800L responding.");
  } else {
    Serial.println("[GSM] Warning: SIM800L did not respond during startup.");
  }

  connectWifiBlocking();
  runSelfTest();
  if (!hardwareLogin()) {
    Serial.println("[AUTH] Initial hardware login failed.");
  }
  hardwarePing();
  fetchHardwareProfile();

  Serial.println("[READY] Place finger on sensor.");
  Serial.println("[READY] Type 'R' in Serial Monitor to enroll a print.");
}

void loop() {
  if (Serial.available()) {
    char cmd = Serial.read();
    if (cmd == 'R' || cmd == 'r') {
      enrollFingerprint();
      Serial.println("[READY] Enrollment mode finished.");
    }
  }

  if (sessionLocked) {
    holdLockedState();
    delay(250);
    return;
  }

  ensureWifi();

  if (WiFi.status() == WL_CONNECTED &&
      millis() - lastEnrollmentPollMs >= ENROLLMENT_POLL_MS) {
    lastEnrollmentPollMs = millis();
    EnrollmentJob job = fetchNextEnrollmentJob();
    if (job.available) {
      processEnrollmentJob(job);
      delay(MAIN_LOOP_DELAY_MS);
      return;
    }
  }

  if (millis() - lastFingerHandledMs < FINGER_COOLDOWN_MS) {
    delay(MAIN_LOOP_DELAY_MS);
    return;
  }

  int slotId = scanFingerprintSlot();
  if (slotId == -1) {
    delay(MAIN_LOOP_DELAY_MS);
    return;
  }

  if (slotId > 0) {
    handleAuthenticationSuccess(slotId);
  } else {
    handleAuthenticationFailure();
  }

  delay(MAIN_LOOP_DELAY_MS);
}
