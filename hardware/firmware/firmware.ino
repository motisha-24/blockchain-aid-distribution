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

// Forward declarations
bool enrollFingerprintToSlot(int slot, int beneficiaryId = 0);

// ----------------------------------------------------------------
// Config - update these before uploading
// ----------------------------------------------------------------
const char* WIFI_SSID = "Mataruse";
const char* WIFI_PASSWORD = "Pipilo##2018";
const char* API_BASE_URL = "http://192.168.1.240:5000";
const char* HARDWARE_USERNAME = "ngo_officer";
const char* HARDWARE_PASSWORD = "ngo2024";
String JWT_TOKEN = "";

// Change this before uploading
// "REGISTER" = registration mode
// "DISTRIBUTE" = distribution mode
#define SYSTEM_MODE "DISTRIBUTE"

String DEVICE_ID = (SYSTEM_MODE == "REGISTER") ? "aidchain-registration-01" : "aidchain-distribution-01";
String OFFICER_ID = "ngo_officer";

String ACTIVE_AID_TYPE = "MAIZE";
String ACTIVE_AID_UNIT = "KG";
int ACTIVE_AID_AMOUNT = 50;
String ACTIVE_LOCATION = "Gweru Ward 5";
String ACTIVE_ITEMS_JSON = "[{\"aid_type\":\"MAIZE\",\"aid_unit\":\"KG\",\"amount\":50}]";

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
constexpr unsigned long ENROLLMENT_FIRST_SCAN_TIMEOUT_MS = 45000;
constexpr unsigned long ENROLLMENT_SECOND_SCAN_TIMEOUT_MS = 45000;
constexpr unsigned long ENROLLMENT_REMOVE_FINGER_TIMEOUT_MS = 15000;

HardwareSerial FingerSerial(2);
HardwareSerial GsmSerial(1);
Adafruit_Fingerprint finger(&FingerSerial);

bool sessionLocked = false;
int attemptCount = 0;
unsigned long lastWifiReconnectMs = 0;
unsigned long lastFingerHandledMs = 0;
unsigned long lastEnrollmentPollMs = 0;
unsigned long lastWifiStatusPrintMs = 0;

bool immediateFingerprintMode = false;
int immediateBeneficiaryId = 0;
int immediateSlotId = 0;
unsigned long greenLedOnUntilMs = 0;

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
  setRed(true);
  delay(1000); // Red LED on for 1 second
  setRed(false);
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
  wl_status_t status = WiFi.status();
  if (status == WL_CONNECTED) return;

  unsigned long now = millis();
  if (now - lastWifiReconnectMs < WIFI_RECONNECT_MS) return;

  lastWifiReconnectMs = now;
  Serial.println("[WIFI] Connection lost. Attempting reconnection...");
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  // Wait a bit and check if connected
  delay(2000);
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("[WIFI] Reconnected successfully.");
    Serial.printf("[WIFI] IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("[WIFI] Reconnection failed.");
  }
}

void monitorWifiStatus() {
  unsigned long now = millis();
  if (now - lastWifiStatusPrintMs < 30000) return; // Print every 30 seconds

  lastWifiStatusPrintMs = now;
  wl_status_t status = WiFi.status();
  String statusMsg;
  switch (status) {
    case WL_CONNECTED:
      statusMsg = "CONNECTED";
      break;
    case WL_DISCONNECTED:
      statusMsg = "DISCONNECTED";
      break;
    case WL_IDLE_STATUS:
      statusMsg = "IDLE";
      break;
    case WL_NO_SSID_AVAIL:
      statusMsg = "NO_SSID_AVAIL";
      break;
    case WL_CONNECT_FAILED:
      statusMsg = "CONNECT_FAILED";
      break;
    case WL_CONNECTION_LOST:
      statusMsg = "CONNECTION_LOST";
      break;
    default:
      statusMsg = "UNKNOWN";
      break;
  }
  Serial.printf("[WIFI] Status: %s\n", statusMsg.c_str());
  if (status == WL_CONNECTED) {
    Serial.printf("[WIFI] IP: %s\n", WiFi.localIP().toString().c_str());
  }
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

void logHardwareEvent(const String& type, const String& message, const String& details = "") {
  if (WiFi.status() != WL_CONNECTED) return;
  
  if (JWT_TOKEN.length() == 0) {
    if (!hardwareLogin()) return;
  }
  
  HTTPClient http;
  http.begin(endpointUrl("/api/hardware/events"));
  if (!addJsonHeaders(http)) {
    http.end();
    return;
  }
  
  DynamicJsonDocument doc(512);
  doc["event_type"] = type;
  doc["message"] = message;
  doc["device_id"] = DEVICE_ID;
  doc["details"] = details;
  
  String body;
  serializeJson(doc, body);
  http.POST(body);
  http.end();
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
    // Try to login again if refresh failed
    return hardwareLogin();
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

// ----------------------------------------------------------------
// Enrollment status helpers
// ----------------------------------------------------------------
void sendEnrollmentStatus(int beneficiaryId, const String& statusCode, const String& message) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[STATUS] Cannot send status while offline.");
    return;
  }

  HTTPClient http;
  http.begin(endpointUrl("/api/fingerprint/status"));
  if (!addJsonHeaders(http)) {
    http.end();
    return;
  }

  DynamicJsonDocument doc(320);
  doc["beneficiary_id"] = beneficiaryId;
  doc["device_id"] = DEVICE_ID;
  doc["status_code"] = statusCode;
  doc["status_message"] = message;

  String body;
  serializeJson(doc, body);

  int status = http.POST(body);
  String response = http.getString();
  http.end();

  Serial.printf("[STATUS] Sent [%s] '%s' -> %d\n", statusCode.c_str(), message.c_str(), status);
}

void sendEnrollmentStatus(int beneficiaryId, const String& message) {
  sendEnrollmentStatus(beneficiaryId, "ENROLLING", message);
}

bool fetchHardwareProfile() {
  if (WiFi.status() != WL_CONNECTED) return false;

  if (JWT_TOKEN.length() == 0) {
    if (!hardwareLogin()) return false;
  }

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

  ACTIVE_LOCATION = String((const char*)(profile["location"] | ACTIVE_LOCATION.c_str()));
  OFFICER_ID = String((const char*)(profile["officer_id"] | OFFICER_ID.c_str()));
  DEVICE_ID = String((const char*)(profile["device_id"] | DEVICE_ID.c_str()));

  JsonArray items = profile["items"];
  if (!items.isNull() && items.size() > 0) {
    ACTIVE_ITEMS_JSON = "";
    serializeJson(items, ACTIVE_ITEMS_JSON);
    
    // Fallback for SMS building (just takes the first item)
    ACTIVE_AID_TYPE = String((const char*)(items[0]["aid_type"] | "AID"));
    ACTIVE_AID_UNIT = String((const char*)(items[0]["aid_unit"] | "UNITS"));
    ACTIVE_AID_AMOUNT = items[0]["amount"] | 1;
  }

  Serial.printf("[PROFILE] Profile fetched with %d items @ %s | officer=%s | device=%s\n",
                items.size(),
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

  Serial.printf("[ENROLLMENT] Next job HTTP %d\n", status);

  if (status == 401) {
    if (refreshJwtToken()) return fetchNextEnrollmentJob();
    return job;
  }

  if (status != 200) {
    if (body.length() > 0) {
      Serial.printf("[ENROLLMENT] No job body: %s\n", body.c_str());
    }
    return job;
  }

  DynamicJsonDocument doc(1536);
  DeserializationError err = deserializeJson(doc, body);
  if (err) {
    Serial.printf("[ENROLLMENT] Job parse failed: %s\n", err.c_str());
    Serial.printf("[ENROLLMENT] Raw body: %s\n", body.c_str());
    return job;
  }

  JsonObject request = doc["request"];
  if (request.isNull()) {
    Serial.printf("[ENROLLMENT] Response missing request payload: %s\n", body.c_str());
    return job;
  }

  job.available = true;
  job.beneficiaryId = request["beneficiary_id"] | 0;
  job.slotId = request["slot_id"] | 0;
  job.name = String((const char*)(request["name"] | ""));
  job.location = String((const char*)(request["location"] | ""));
  job.deviceId = String((const char*)(request["device_id"] | ""));
  Serial.printf("[ENROLLMENT] Next job beneficiary=%d slot=%d device=%s\n",
                job.beneficiaryId, job.slotId, job.deviceId.c_str());
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

void processImmediateFingerprintJob() {
  Serial.println("[IMMEDIATE] Starting immediate fingerprint enrollment...");

  bool success = enrollFingerprintToSlot(immediateSlotId, immediateBeneficiaryId);
  reportEnrollmentResult(
    immediateBeneficiaryId,
    immediateSlotId,
    success,
    success ? "" : "AS608 immediate enrollment failed on device"
  );

  if (success) {
    setGreen(true);
    greenLedOnUntilMs = millis() + 5000; // Keep green LED on for 5 seconds
    Serial.println("[IMMEDIATE] Immediate enrollment completed successfully!");
  } else {
    setRed(true);
    delay(1000); // Red LED on for 1 second
    setRed(false);
    Serial.println("[IMMEDIATE] Immediate enrollment failed!");
  }

  // Reset immediate mode
  immediateFingerprintMode = false;
  immediateBeneficiaryId = 0;
  immediateSlotId = 0;
  lastFingerHandledMs = millis();
}

bool checkForImmediateFingerprintJob() {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  String url = endpointUrl(("/api/hardware/enrollment/next?device_id=" + DEVICE_ID).c_str());
  http.begin(url);
  if (!addJsonHeaders(http)) {
    http.end();
    return false;
  }

  int status = http.GET();
  String body = http.getString();
  http.end();

  if (status == 401) {
    if (refreshJwtToken()) return checkForImmediateFingerprintJob();
    return false;
  }

  if (status != 200) {
    return false;
  }

  DynamicJsonDocument doc(1536);
  DeserializationError err = deserializeJson(doc, body);
  if (err) {
    Serial.printf("[IMMEDIATE] Job parse failed: %s\n", err.c_str());
    return false;
  }

  JsonObject request = doc["request"];
  if (request.isNull()) return false;

  String statusStr = String((const char*)(request["status"] | ""));
  if (statusStr != "WAITING_FOR_FINGERPRINT") return false;

  immediateBeneficiaryId = request["beneficiary_id"] | 0;
  immediateSlotId = request["slot_id"] | 0;

  Serial.println();
  Serial.println("[IMMEDIATE] ====================================");
  Serial.printf("[IMMEDIATE] IMMEDIATE fingerprint job found!\n");
  Serial.printf("[IMMEDIATE] Beneficiary: %d\n", immediateBeneficiaryId);
  Serial.printf("[IMMEDIATE] Slot       : %d\n", immediateSlotId);
  Serial.println("[IMMEDIATE] Waiting for fingerprint input...");
  Serial.println("[IMMEDIATE] ====================================");

  immediateFingerprintMode = true;
  return true;
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
    logHardwareEvent("SMS_SENT", "SMS confirmation sent to " + info.phone);
  } else {
    Serial.println("[SMS] SMS send failed on SIM800L.");
    logHardwareEvent("SMS_FAILED", "Failed to send SMS to " + info.phone);
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

  if (httpStatus == 200 && action == "BATCH_PROCESSED") {
    signalSuccess();
    
    // Since it's a batch, find the first successful transaction hash or cache ID
    String txHash = "BATCH-SUCCESS";
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
    
    handleSuccessfulDistribution(beneficiaryId, txHash);
    return;
  }

  if (httpStatus == 200 && action == "CACHED_FOR_SYNC") {
    signalCached();
    // Use first cache_id from batch results
    String cacheRef = "BATCH-CACHE";
    JsonArray results = doc["results"].as<JsonArray>();
    for (JsonObject r : results) {
        if (r["success"] == true && r.containsKey("cache_id")) {
            cacheRef = "CACHE-" + String((int)(r["cache_id"]));
            break;
        }
    }
    handleSuccessfulDistribution(beneficiaryId, cacheRef);
    return;
  }

  if (httpStatus == 409 && (action == "DUPLICATE_BLOCKED" || action == "BATCH_FAILED")) {
    signalDuplicate();
    Serial.println("[API] Batch or duplicate distribution blocked.");
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
    Serial.println("[API] Flask unreachable over WiFi.");
    signalFailure();
    return;
  }

  // We no longer call fetchHardwareProfile() here because it's already called 
  // periodically in the main loop. This prevents socket congestion.

  HTTPClient http;
  http.begin(endpointUrl("/api/distribute/batch"));
  http.setTimeout(60000); // 60 seconds timeout for blockchain transactions
  
  if (!addJsonHeaders(http)) {
    http.end();
    Serial.println("[AUTH] Missing JWT token.");
    signalTokenExpired();
    return;
  }

  DynamicJsonDocument doc(2048); // Increased size
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
    logHardwareEvent("CONNECTION_FAILED", "Hardware could not reach server during distribution", "Error: " + http.errorToString(status));
    signalFailure();
  }
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

bool waitForFingerprintState(uint8_t expectedState, unsigned long timeoutMs) {
  unsigned long start = millis();
  while (millis() - start < timeoutMs) {
    if (finger.getImage() == expectedState) {
      return true;
    }
    delay(40);
  }
  return false;
}

bool enrollFingerprintToSlot(int slot, int beneficiaryId) {
  if (slot <= 0 || slot > 127) {
    Serial.println("[ENROLL] Invalid slot. Use 1-127.");
    return false;
  }

  Serial.printf("[ENROLL] Starting enrollment for slot %d\n", slot);
  
  // Clear the slot at the START to avoid any potential write conflicts later
  finger.deleteModel(slot);
  delay(200);

  Serial.println("[ENROLL] Place finger on sensor.");
  if (beneficiaryId > 0) {
    sendEnrollmentStatus(beneficiaryId, "PLACE_FINGER", "Please place finger on sensor");
  }
  if (!waitForFingerprintState(FINGERPRINT_OK, ENROLLMENT_FIRST_SCAN_TIMEOUT_MS)) {
    Serial.println("[ENROLL] Timed out waiting for first finger placement.");
    if (beneficiaryId > 0) {
      sendEnrollmentStatus(beneficiaryId, "FAILED_ENROLLMENT", "Timed out waiting for first finger placement");
    }
    return false;
  }

  if (finger.image2Tz(1) != FINGERPRINT_OK) {
    Serial.println("[ENROLL] First image conversion failed.");
    if (beneficiaryId > 0) sendEnrollmentStatus(beneficiaryId, "FAILED_ENROLLMENT", "First scan failed - try again");
    return false;
  }

  if (beneficiaryId > 0) sendEnrollmentStatus(beneficiaryId, "Good - remove finger");
  Serial.println("[ENROLL] Remove finger.");
  if (!waitForFingerprintState(FINGERPRINT_NOFINGER, ENROLLMENT_REMOVE_FINGER_TIMEOUT_MS)) {
    Serial.println("[ENROLL] Timed out waiting for finger removal.");
    if (beneficiaryId > 0) {
      sendEnrollmentStatus(beneficiaryId, "FAILED_ENROLLMENT", "Timed out waiting for finger removal");
    }
    return false;
  }

  if (beneficiaryId > 0) sendEnrollmentStatus(beneficiaryId, "PLACE_SAME_FINGER", "Place same finger again");
  Serial.println("[ENROLL] Place the same finger again.");
  
  if (!waitForFingerprintState(FINGERPRINT_OK, ENROLLMENT_SECOND_SCAN_TIMEOUT_MS)) {
    Serial.println("[ENROLL] Timed out waiting for second finger placement.");
    if (beneficiaryId > 0) {
      sendEnrollmentStatus(beneficiaryId, "FAILED_ENROLLMENT", "Timed out waiting for second finger placement");
    }
    return false;
  }

  if (finger.image2Tz(2) != FINGERPRINT_OK) {
    Serial.println("[ENROLL] Second image conversion failed.");
    if (beneficiaryId > 0) sendEnrollmentStatus(beneficiaryId, "FAILED_ENROLLMENT", "Second scan failed - try again");
    return false;
  }

  if (finger.createModel() != FINGERPRINT_OK) {
    Serial.println("[ENROLL] Fingerprints did not match.");
    if (beneficiaryId > 0) sendEnrollmentStatus(beneficiaryId, "FAILED_ENROLLMENT", "Fingerprints did not match - try again");
    return false;
  }

  delay(200); // Wait for sensor to stabilize before storing
  if (finger.storeModel(slot) == FINGERPRINT_OK) {
    Serial.printf("[ENROLL] Finger stored successfully in slot %d\n", slot);
    return true;
  } else {
    Serial.println("[ENROLL] Failed to store fingerprint model in sensor memory.");
    if (beneficiaryId > 0) sendEnrollmentStatus(beneficiaryId, "FAILED_ENROLLMENT", "Sensor memory write error");
    return false;
  }
}

void enrollFingerprint() {
  Serial.println("[ENROLL] Enter slot number in Serial Monitor:");
  while (!Serial.available()) {
    delay(50);
  }

  String line = Serial.readStringUntil('\n');
  line.trim();
  int slot = line.toInt();

  if (slot <= 0 || slot > 127) {
    Serial.println("[ENROLL] Invalid slot. Use 1-127.");
    return;
  }

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

  bool success = enrollFingerprintToSlot(job.slotId, job.beneficiaryId);
  if (success) {
    sendEnrollmentStatus(job.beneficiaryId, "ENROLLED", "Fingerprint captured successfully");
  } else {
    sendEnrollmentStatus(job.beneficiaryId, "FAILED_ENROLLMENT", "Fingerprint enrollment failed");
  }

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
    logHardwareEvent("FINGER_DETECTED_FAILED", "Finger detected but capture failed", "Error code: " + String(p));
    return -2;
  }

  logHardwareEvent("FINGER_DETECTED", "Finger detected on sensor, identifying...");

  p = finger.image2Tz();
  if (p != FINGERPRINT_OK) {
    Serial.printf("[AUTH] image2Tz failed: %u\n", p);
    logHardwareEvent("IDENTITY_CHECK_FAILED", "Could not process fingerprint image", "Error code: " + String(p));
    return -2;
  }

  p = finger.fingerSearch();
  if (p == FINGERPRINT_OK) {
    Serial.printf("[AUTH] Match found. Slot=%d Confidence=%d\n",
                  finger.fingerID, finger.confidence);
    if (finger.confidence < MIN_CONFIDENCE) {
      Serial.println("[AUTH] Match confidence below threshold.");
      logHardwareEvent("IDENTITY_UNCONFIRMED", "Finger match confidence too low", "Confidence: " + String(finger.confidence));
      return -3;
    }
    
    int beneficiaryId = finger.fingerID + SLOT_ID_OFFSET;
    logHardwareEvent("IDENTITY_CONFIRMED", "Identity confirmed for beneficiary " + String(beneficiaryId), "Confidence: " + String(finger.confidence));
    return finger.fingerID;
  }

  Serial.println("[AUTH] No matching fingerprint found.");
  logHardwareEvent("IDENTITY_UNKNOWN", "Fingerprint not recognized in database");
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
  Serial.printf("[BOOT] Mode: %s\n", SYSTEM_MODE);

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

  if (strcmp(SYSTEM_MODE, "REGISTER") == 0) {
    Serial.println("[READY] Registration station ready.");
    Serial.println("[READY] Waiting for enrollment jobs from dashboard.");
  } else {
    Serial.println("[READY] Distribution station ready.");
    Serial.println("[READY] Place finger on sensor to receive aid.");
  }
  Serial.println("[READY] Type 'R' in Serial Monitor to enroll a print.");
}

void loop() {
  if (Serial.available()) {
    char cmd = Serial.read();
    if (cmd == 'R' || cmd == 'r') {
      enrollFingerprint();
      Serial.println("[READY] Enrollment mode finished.");
    } else if (cmd == 'C' || cmd == 'c') {
      Serial.println("WARNING: Clearing ALL fingerprints in 3 seconds... (Press RESET to abort)");
      delay(3000);
      finger.emptyDatabase();
      Serial.println("Fingerprint database CLEARED.");
    }

  }

  if (sessionLocked) {
    holdLockedState();
    delay(250);
    return;
  }

  ensureWifi();
  monitorWifiStatus();

  // Check if green LED should be turned off
  if (greenLedOnUntilMs > 0 && millis() > greenLedOnUntilMs) {
    setGreen(false);
    greenLedOnUntilMs = 0;
  }

  if (strcmp(SYSTEM_MODE, "REGISTER") == 0) {
    // Registration mode: poll for enrollment jobs and process them immediately
    if (WiFi.status() == WL_CONNECTED &&
        millis() - lastEnrollmentPollMs >= ENROLLMENT_POLL_MS) {
      lastEnrollmentPollMs = millis();
      
      // Periodically refresh profile even in register mode
      fetchHardwareProfile();
      
      EnrollmentJob job = fetchNextEnrollmentJob();
      if (job.available) {
        processEnrollmentJob(job);
      }
    }

  } else if (strcmp(SYSTEM_MODE, "DISTRIBUTE") == 0) {
    // Periodically refresh session/profile
    if (WiFi.status() == WL_CONNECTED &&
        millis() - lastEnrollmentPollMs >= 30000) { // Reuse poll timer for profile refresh
      lastEnrollmentPollMs = millis();
      fetchHardwareProfile();
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

