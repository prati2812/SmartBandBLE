// ============================================================
//  LapidVibe Band — ESP32-C3 BLE Firmware
//  Version: 1.3.3 (NimBLE v2.5.0 Precise Architecture)
// ============================================================

#include <NimBLEDevice.h>  // Ultra-lightweight NimBLE instead of classic BLE
#include <ArduinoJson.h>
#include <Preferences.h>   // NVS flash storage — survives power cycles
#include <time.h>          // mktime / localtime for epoch math

// ─────────────────────────────────────────────
//  BLE Identity & UUIDs
// ─────────────────────────────────────────────
#define DEVICE_NAME       "LapidVibe_Band"
#define SERVICE_UUID      "12345678-1234-1234-1234-123456789abc"
#define COMMAND_CHAR_UUID "abcd1234-5678-90ab-cdef-123456789abc" 
#define NOTIFY_CHAR_UUID  "beb5483e-36e1-4688-b7f5-ea07361b26a9"  

// ─────────────────────────────────────────────
//  Pin Definitions
// ─────────────────────────────────────────────
#define MOTOR_PIN         5    // GPIO5 → Standard, safe digital pin

// PWM config
#define PWM_FREQ_HZ       5000
#define PWM_RESOLUTION    8    // 8-bit → duty values 0–255

// ─────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────
#define MAX_ALARMS        10   
#define FIRMWARE_VERSION  "1.3.3"
#define RESET_SECRET      "LAPID_RESET_OK"  

// ─────────────────────────────────────────────
//  Alarm Data Structure
// ─────────────────────────────────────────────
struct Alarm {
  char    alarm_id[16];
  char    alarm_time[6];    // "HH:MM"
  bool    enabled;
  char    repeat[64];       // "Mon,Tue,Wed"
  char    pattern[20];      // "normal" | "gentle" | "heavy_sleeper" | "escalating"
  int     intensity;        // 0–100
  int     duration_sec;
  int     snooze;
  bool    active;           
};

struct Pulse { int on_ms; int off_ms; };

// ─────────────────────────────────────────────
//  Global State
// ─────────────────────────────────────────────
NimBLECharacteristic *pNotifyCharacteristic = nullptr;
Preferences           prefs;

volatile bool deviceConnected   = false;
volatile bool globalAlarmsEnabled = true;

Alarm alarmDB[MAX_ALARMS];

struct TimeState {
  time_t        epochAtSync;        
  unsigned long millisAtSync; 
  bool          synced;             
};
TimeState timeState = {0, 0, false};

time_t currentEpoch() {
  if (!timeState.synced) return 0;
  unsigned long elapsed = (millis() - timeState.millisAtSync) / 1000UL;
  return timeState.epochAtSync + (time_t)elapsed;
}

bool getCurrentTime(struct tm &out) {
  if (!timeState.synced) return false;
  time_t now = currentEpoch();
  gmtime_r(&now, &out);
  return true;
}

const char* wdayToShortName(int wday) {
  const char* names[] = {"Sun","Mon","Tue","Wed","Thu","Fri","Sat"};
  return names[wday % 7];
}

// ─────────────────────────────────────────────
//  Alarm Scheduler State Machine
// ─────────────────────────────────────────────
enum AlarmState {
  ALARM_IDLE,       
  ALARM_FIRING,     
  ALARM_SNOOZED,    
  ALARM_DONE        
};

struct SchedulerState {
  AlarmState    state;
  int           activeSlot;         
  unsigned long motorOnUntil;     
  unsigned long motorOffUntil;    
  int           pulseIndex;       
  bool          motorRunning;
  unsigned long alarmStartMs;     
  unsigned long snoozeUntilMs;    
  int           lastFiredMinute[MAX_ALARMS];
};

SchedulerState sched = {
  ALARM_IDLE, -1,
  0, 0, 0, false,
  0, 0,
  {}   
};

String bleReceiveBuffer = "";

int readBatteryPercent() {
  return 100;   // USB development mode bypass
}

// ─────────────────────────────────────────────
//  NVS Persistence Helpers
// ─────────────────────────────────────────────
void saveAlarmsToFlash() {
  prefs.begin("lapidvibe", false);
  prefs.putBytes("alarmDB", alarmDB, sizeof(alarmDB));
  prefs.putBool("alarmsEnabled", globalAlarmsEnabled);
  prefs.end();
  Serial.println("[NVS] Alarm database saved to flash.");
}

void loadAlarmsFromFlash() {
  prefs.begin("lapidvibe", true);  
  size_t bytesRead = prefs.getBytes("alarmDB", alarmDB, sizeof(alarmDB));
  globalAlarmsEnabled = prefs.getBool("alarmsEnabled", true);
  prefs.end();

  if (bytesRead == sizeof(alarmDB)) {
    Serial.println("[NVS] Alarm database restored from flash.");
    int count = 0;
    for (int i = 0; i < MAX_ALARMS; i++) {
      if (alarmDB[i].active) count++;
    }
    Serial.printf("[NVS] %d active alarm(s) loaded.\n", count);
  } else {
    Serial.println("[NVS] No saved data found. Initialising blank database.");
    memset(alarmDB, 0, sizeof(alarmDB));
    saveAlarmsToFlash();
  }
}

void clearAlarmsFromFlash() {
  prefs.begin("lapidvibe", false);
  prefs.clear();
  prefs.end();
  memset(alarmDB, 0, sizeof(alarmDB));
  Serial.println("[NVS] Flash storage wiped.");
}

int findAlarmById(const char* id) {
  for (int i = 0; i < MAX_ALARMS; i++) {
    if (alarmDB[i].active && strcmp(alarmDB[i].alarm_id, id) == 0) {
      return i;
    }
  }
  return -1;
}

int findFreeSlot() {
  for (int i = 0; i < MAX_ALARMS; i++) {
    if (!alarmDB[i].active) return i;
  }
  return -1;
}

// ─────────────────────────────────────────────
//  Vibration Motor Control
// ─────────────────────────────────────────────
int intensityToDuty(int pct) {
  return map(constrain(pct, 0, 100), 0, 100, 0, 255);
}

void motorOn(int intensityPct) {
  ledcWrite(MOTOR_PIN, intensityToDuty(intensityPct));
}

void motorOff() {
  ledcWrite(MOTOR_PIN, 0);
}

const Pulse PATTERN_NORMAL[]        = { {500, 300}, {500, 300}, {500, 500} };
const Pulse PATTERN_GENTLE[]        = { {200, 300}, {200, 300}, {200, 800} };
const Pulse PATTERN_HEAVY_SLEEPER[] = { {800, 150}, {800, 150}, {1000, 300}, {1000, 300} };
const Pulse PATTERN_ESCALATING[]    = { {150, 200}, {300, 200}, {600, 200}, {1000, 300} };

const Pulse* patternTable(const char* name, int &outLen) {
  if (strcmp(name, "gentle") == 0)        { outLen = 3; return PATTERN_GENTLE; }
  if (strcmp(name, "heavy_sleeper") == 0) { outLen = 4; return PATTERN_HEAVY_SLEEPER; }
  if (strcmp(name, "escalating") == 0)    { outLen = 4; return PATTERN_ESCALATING; }
  outLen = 3; return PATTERN_NORMAL;   
}

void runPatternBlocking(const String& pattern, int intensity) {
  Serial.printf("[MOTOR] Test pattern '%s' at %d%%\n", pattern.c_str(), intensity);
  int len;
  const Pulse* pulses = patternTable(pattern.c_str(), len);
  for (int i = 0; i < len; i++) {
    motorOn(intensity);  delay(pulses[i].on_ms);
    motorOff();           delay(pulses[i].off_ms);
  }
}

// ─────────────────────────────────────────────
//  Non-Blocking Alarm Scheduler
// ─────────────────────────────────────────────
bool dayMatchesRepeat(const char* repeatStr, const char* dayName) {
  if (strlen(repeatStr) == 0) return true;
  return strstr(repeatStr, dayName) != nullptr;
}

void startAlarmFiring(int slot) {
  Alarm &a = alarmDB[slot];
  Serial.printf("[SCHED] *** ALARM FIRING: %s @ %s ***\n", a.alarm_id, a.alarm_time);

  sched.state        = ALARM_FIRING;
  sched.activeSlot   = slot;
  sched.alarmStartMs = millis();
  sched.pulseIndex   = 0;
  sched.motorRunning = false;
  sched.motorOnUntil = 0;
  sched.motorOffUntil= millis();   
}

void stopAlarm(const char* reason) {
  motorOff();
  Serial.printf("[SCHED] Alarm stopped (%s).\n", reason);
  sched.state      = ALARM_IDLE;
  sched.activeSlot = -1;
}

void tickVibrationEngine(int slot) {
  Alarm &a = alarmDB[slot];
  unsigned long now = millis();
  int patLen;
  const Pulse* pulses = patternTable(a.pattern, patLen);

  if (!sched.motorRunning) {
    if (now >= sched.motorOffUntil) {
      if (sched.pulseIndex >= patLen) sched.pulseIndex = 0;
      motorOn(a.intensity);
      sched.motorRunning = true;
      sched.motorOnUntil = now + pulses[sched.pulseIndex].on_ms;
    }
  } else {
    if (now >= sched.motorOnUntil) {
      motorOff();
      sched.motorRunning  = false;
      sched.motorOffUntil = now + pulses[sched.pulseIndex].off_ms;
      sched.pulseIndex++;
    }
  }
}

void tickAlarmScheduler() {
  unsigned long now = millis();

  if (sched.state == ALARM_FIRING) {
    int slot = sched.activeSlot;
    Alarm &a = alarmDB[slot];
    unsigned long elapsed = (now - sched.alarmStartMs) / 1000UL;
    if (elapsed >= (unsigned long)a.duration_sec) {
      if (a.snooze > 0) {
        motorOff();
        sched.state         = ALARM_SNOOZED;
        sched.snoozeUntilMs = now + ((unsigned long)a.snooze * 60000UL);
      } else {
        stopAlarm("duration elapsed, no snooze");
      }
      return;
    }
    tickVibrationEngine(slot);
    return;
  }

  if (sched.state == ALARM_SNOOZED) {
    if (now >= sched.snoozeUntilMs) {
      Serial.println("[SCHED] Snooze expired — re-firing alarm.");
      startAlarmFiring(sched.activeSlot);   
    }
    return;
  }

  if (!globalAlarmsEnabled || !timeState.synced) return;

  struct tm t;
  if (!getCurrentTime(t)) return;

  int minuteToken = (t.tm_mday * 10000) + (t.tm_hour * 100) + t.tm_min;
  const char* todayName = wdayToShortName(t.tm_wday);

  char currentHHMM[6];
  snprintf(currentHHMM, sizeof(currentHHMM), "%02d:%02d", t.tm_hour, t.tm_min);

  for (int i = 0; i < MAX_ALARMS; i++) {
    Alarm &a = alarmDB[i];
    if (!a.active || !a.enabled) continue;
    if (sched.lastFiredMinute[i] == minuteToken) continue;
    if (strcmp(a.alarm_time, currentHHMM) != 0) continue;
    if (!dayMatchesRepeat(a.repeat, todayName)) continue;

    sched.lastFiredMinute[i] = minuteToken;
    startAlarmFiring(i);
    return;   
  }
}

// ─────────────────────────────────────────────
//  BLE Outbound Telemetry
// ─────────────────────────────────────────────
void sendDeviceStatusUpdate() {
  if (!deviceConnected || pNotifyCharacteristic == nullptr) return;

  JsonDocument doc;
  doc["connected"]        = true;
  doc["battery"]          = readBatteryPercent();
  doc["firmware_version"] = FIRMWARE_VERSION;
  doc["alarms_enabled"]   = globalAlarmsEnabled;
  doc["time_synced"]      = timeState.synced;

  if (timeState.synced) {
    struct tm t;
    if (getCurrentTime(t)) {
      char buf[6];
      snprintf(buf, sizeof(buf), "%02d:%02d", t.tm_hour, t.tm_min);
      doc["current_time"] = buf;
      doc["current_day"]  = wdayToShortName(t.tm_wday);
    }
  }

  const char* stateStr = "idle";
  if (sched.state == ALARM_FIRING)  stateStr = "firing";
  if (sched.state == ALARM_SNOOZED) stateStr = "snoozed";
  doc["alarm_state"] = stateStr;
  if (sched.activeSlot >= 0 && alarmDB[sched.activeSlot].active) {
    doc["active_alarm_id"] = alarmDB[sched.activeSlot].alarm_id;
  }

  String payload;
  serializeJson(doc, payload);

  pNotifyCharacteristic->setValue(payload);
  pNotifyCharacteristic->notify();

  Serial.print("[BLE→APP] ");
  Serial.println(payload);
}

// ─────────────────────────────────────────────
//  Command Dispatcher
// ─────────────────────────────────────────────
void writeAlarmFromJson(JsonObjectConst obj) {
  const char* id = obj["alarm_id"] | "unknown";
  int slot = findAlarmById(id);
  if (slot == -1) slot = findFreeSlot();
  if (slot == -1) {
    Serial.println("[ALARM] ERROR: Alarm database is full!");
    return;
  }

  Alarm &a = alarmDB[slot];
  a.active = true;
  strlcpy(a.alarm_id, id, sizeof(a.alarm_id));
  
  const char* rawTime = obj["alarm_time"] | "00:00";
  if (strlen(rawTime) == 4 && rawTime[1] == ':') {
    char paddedTime[6];
    paddedTime[0] = '0'; paddedTime[1] = rawTime[0]; paddedTime[2] = ':';
    paddedTime[3] = rawTime[2]; paddedTime[4] = rawTime[3]; paddedTime[5] = '\0';
    strlcpy(a.alarm_time, paddedTime, sizeof(a.alarm_time));
  } else {
    strlcpy(a.alarm_time, rawTime, sizeof(a.alarm_time));
  }
  
  a.enabled      = obj["enabled"]      | false;
  a.intensity    = obj["intensity"]    | 80;
  a.duration_sec = obj["duration_sec"] | 60;
  a.snooze       = obj["snooze"]       | 5;
  strlcpy(a.pattern, obj["pattern"] | "normal", sizeof(a.pattern));

  a.repeat[0] = '\0';
  JsonArrayConst days = obj["repeat"];
  bool first = true;
  for (JsonVariantConst d : days) {
    if (!first) strlcat(a.repeat, ",", sizeof(a.repeat));
    strlcat(a.repeat, d.as<const char*>(), sizeof(a.repeat));
    first = false;
  }
}

void handleIncomingJson(const String& jsonString) {
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, jsonString);

  if (err) {
    Serial.printf("[JSON] Parse error: %s\n", err.c_str());
    return;
  }

  String cmd = "";
  if (doc["cmd"].is<const char*>()) {
    cmd = doc["cmd"].as<String>();
  } else if (doc["type"].is<const char*>() && doc["type"].as<String>() == "alarm") {
    cmd = "set_alarm";
    doc["cmd"] = "set_alarm";
    doc["alarm_id"] = "legacy-app-alarm";
    doc["alarm_time"] = doc["time"];
  } else {
    return;
  }

  if (cmd == "test_vibration") {
    runPatternBlocking(doc["pattern"] | "normal", doc["intensity"] | 80);
  }
  else if (cmd == "set_alarm") {
    writeAlarmFromJson(doc.as<JsonObjectConst>());
    saveAlarmsToFlash();
  }
  else if (cmd == "sync_alarms") {
    JsonArrayConst list = doc["alarms"];
    memset(alarmDB, 0, sizeof(alarmDB));   
    for (JsonObjectConst item : list) { writeAlarmFromJson(item); }
    saveAlarmsToFlash();
  }
  else if (cmd == "set_alarms_enabled") {
    globalAlarmsEnabled = doc["enabled"] | false;
    saveAlarmsToFlash();
  }
  else if (cmd == "sync_time") {
    long long epoch = doc["epoch"] | (long long)0;
    if (epoch > 0) {
      timeState.epochAtSync  = (time_t)epoch;
      timeState.millisAtSync = millis();
      timeState.synced       = true;
    }
  }
  else if (cmd == "dismiss_alarm") {
    if (sched.state == ALARM_FIRING || sched.state == ALARM_SNOOZED) stopAlarm("dismissed by app");
  }
  else if (cmd == "snooze_alarm") {
    if (sched.state == ALARM_FIRING) {
      int minutes = doc["minutes"] | (sched.activeSlot >= 0 ? alarmDB[sched.activeSlot].snooze : 5);
      motorOff();
      sched.state         = ALARM_SNOOZED;
      sched.snoozeUntilMs = millis() + ((unsigned long)minutes * 60000UL);
    }
  }
  else if (cmd == "reset_device") {
    clearAlarmsFromFlash();
    delay(500);
    ESP.restart();
  }

  sendDeviceStatusUpdate();
}

// ─────────────────────────────────────────────
//  NimBLE Callbacks (v2.5.0 Strict Signatures)
// ─────────────────────────────────────────────
class CommandCallbacks : public NimBLECharacteristicCallbacks {
  private:
    int globalDepth = 0; 

  // Updated signature with mandatory NimBLEBLEConnInfo reference matching v2.5.x context
  void onWrite(NimBLECharacteristic *pChar, NimBLEConnInfo& connInfo) override {
    std::string rxValue = pChar->getValue();
    String chunk = String(rxValue.c_str());
    if (chunk.length() == 0) return;

    for (size_t i = 0; i < chunk.length(); i++) {
      char c = chunk[i];
      if (c == '{') globalDepth++;
      else if (c == '}') globalDepth--;
    }

    bleReceiveBuffer += chunk;

    if (globalDepth <= 0 && bleReceiveBuffer.indexOf('{') != -1) {
      Serial.println("\n--- [RAW INCOMING BLE PAYLOAD START] ---");
      Serial.println(bleReceiveBuffer);
      Serial.println("--- [RAW INCOMING BLE PAYLOAD END] ---\n");
      
      handleIncomingJson(bleReceiveBuffer);
      bleReceiveBuffer = ""; 
      globalDepth = 0; 
    }
  }
};

class ServerCallbacks : public NimBLEServerCallbacks {
  // Signature with NimBLEConnInfo reference
  void onConnect(NimBLEServer* pServer, NimBLEConnInfo& connInfo) override {
    deviceConnected = true;
    Serial.println("[BLE] App connected.");
    sendDeviceStatusUpdate();
  }
  
  // Signature containing both context tracking reference AND reason integer tracking for v2.5.x
  void onDisconnect(NimBLEServer* pServer, NimBLEConnInfo& connInfo, int reason) override {
    deviceConnected = false;
    bleReceiveBuffer = "";   
    Serial.println("[BLE] App disconnected. Re-advertising...");
    NimBLEDevice::startAdvertising();
  }
};

// ─────────────────────────────────────────────
//  setup()
// ─────────────────────────────────────────────
void setup() {
  // ── STEP 1: IMMEDIATELY KILL GPIO5 POWER BEFORE BOOT DELAYS RUN ──
  pinMode(MOTOR_PIN, OUTPUT);
  digitalWrite(MOTOR_PIN, LOW); 

  Serial.begin(115200);
  delay(1000); 
  
  Serial.println("\n========================================");
  Serial.println("  LapidVibe Band — Firmware v" FIRMWARE_VERSION);
  Serial.println("========================================\n");

  // ── STEP 2: SETUP MOTOR OUTPUT & RESTORE FLASH DATA ──
  ledcAttach(MOTOR_PIN, PWM_FREQ_HZ, PWM_RESOLUTION);
  motorOff();
  Serial.printf("[MOTOR] PWM on GPIO%d ready.\n", MOTOR_PIN);

  memset(sched.lastFiredMinute, -1, sizeof(sched.lastFiredMinute));
  loadAlarmsFromFlash();

  // ── STEP 3: HIGH PERFORMANCE NIMBLE STACK INITIALIZATION ──
  Serial.println("[BLE] Initializing NimBLE Stack Framework...");
  NimBLEDevice::init(DEVICE_NAME);
  
  // Restrict Tx power slightly to avoid aggressive boot current spikes
  NimBLEDevice::setPower(ESP_PWR_LVL_P3); 

  Serial.println("[BLE] Creating BLE Server context...");
  NimBLEServer *pServer = NimBLEDevice::createServer();
  if (pServer == nullptr) {
    Serial.println("[BLE] CRITICAL ERROR: Failed to allocate Server Context!");
    while(1) { delay(1000); } 
  }
  
  pServer->setCallbacks(new ServerCallbacks());
  
  Serial.println("[BLE] Instantiating Service Stack...");
  NimBLEService *pService = pServer->createService(SERVICE_UUID);
  if (pService == nullptr) {
    Serial.println("[BLE] CRITICAL ERROR: Failed to create Service Context.");
    while(1) { delay(1000); }
  }

  NimBLECharacteristic *pCommandChar = pService->createCharacteristic(
    COMMAND_CHAR_UUID,
    NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::WRITE
  );
  pCommandChar->setCallbacks(new CommandCallbacks());

  pNotifyCharacteristic = pService->createCharacteristic(
    NOTIFY_CHAR_UUID,
    NIMBLE_PROPERTY::NOTIFY
  );

  pService->start();

  // Advertising layout compatible with NimBLE 2.5.0 architecture
  NimBLEAdvertising *pAdvertising = NimBLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->start();

  Serial.println("[BLE] Advertising ready via NimBLE. Waiting for connection...\n");
}

// ─────────────────────────────────────────────
//  loop()
// ─────────────────────────────────────────────
void loop() {
  static unsigned long lastStatusUpdate = 0;

  tickAlarmScheduler();

  if (deviceConnected && (millis() - lastStatusUpdate > 10000)) {
    lastStatusUpdate = millis();
    sendDeviceStatusUpdate();
  }

  delay(20);
}