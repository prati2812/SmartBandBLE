// ============================================================
//  LapidVibe Band — ESP32-C3 BLE Firmware
//  Version: 1.2.0
//
//  Hardware: ESP32-C3
//  Power:    USB / Computer (development mode)
//            Battery + TP4056 logic is written but COMMENTED OUT
//            — uncomment when moving to battery-powered build.
//
//  Libraries required:
//    - ESP32 BLE Arduino (built-in with ESP32 board package)
//    - ArduinoJson  v7.x  (install via Library Manager)
//    - Preferences  (built-in with ESP32 board package)
//
//  Time Sync:
//    The app sends {"cmd":"sync_time","epoch":1700000000,"day":"Mon"}
//    The band stores epoch + millis() offset and derives HH:MM from it.
//    No RTC module required — the app is the time source.
// ============================================================

#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <BLE2902.h>
#include <ArduinoJson.h>
#include <Preferences.h>   // NVS flash storage — survives power cycles
#include <time.h>          // mktime / localtime for epoch math

// ─────────────────────────────────────────────
//  BLE Identity & UUIDs
// ─────────────────────────────────────────────
#define DEVICE_NAME       "LapidVibe_Band"
// #define SERVICE_UUID      "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
// #define COMMAND_CHAR_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"  // App → Device (WRITE)

#define SERVICE_UUID      "12345678123412341234123456789abc"
#define COMMAND_CHAR_UUID "abcd1234567890abcdef123456789abc" 


#define NOTIFY_CHAR_UUID  "beb5483e-36e1-4688-b7f5-ea07361b26a9"  // Device → App (NOTIFY)

// #define COMMAND_CHAR_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"  // App → Device (WRITE)
// #define NOTIFY_CHAR_UUID  "beb5483e-36e1-4688-b7f5-ea07361b26a9" 

// ─────────────────────────────────────────────
//  Pin Definitions
// ─────────────────────────────────────────────

// Vibration motor — connect your PWM-capable MOSFET gate here
#define MOTOR_PIN         5    // GPIO5 → PWM output to motor driver

// ── BATTERY (TP4056 build) ────────────────────
// Uncomment the line below when you wire a voltage divider from
// the battery + terminal to this ADC pin.
// #define BATTERY_ADC_PIN  A0   // GPIO0 on most ESP32-C3 boards

// PWM config (ESP32 LEDC — core v3 API, pin-based, no channel number needed)
#define PWM_FREQ_HZ       5000
#define PWM_RESOLUTION    8    // 8-bit → duty values 0–255

// ─────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────
#define MAX_ALARMS        10   // Maximum alarms stored in NVS
#define FIRMWARE_VERSION  "1.2.0"
#define RESET_SECRET      "LAPID_RESET_OK"  // Safety token for reset_device

// ─────────────────────────────────────────────
//  Alarm Data Structure
// ─────────────────────────────────────────────
struct Alarm {
  char    alarm_id[16];
  char    alarm_time[6];    // "HH:MM"
  bool    enabled;
  char    repeat[64];       // Stored as comma-separated: "Mon,Tue,Wed"
  char    pattern[20];      // "normal" | "gentle" | "heavy_sleeper" | "escalating"
  int     intensity;        // 0–100 (maps to PWM duty 0–255)
  int     duration_sec;
  int     snooze;
  bool    active;           // Slot is in use
};

// ─────────────────────────────────────────────
//  Vibration Pulse Table Type
//  Defined here (before SchedulerState) so the compiler
//  sees the type before any function that references it.
// ─────────────────────────────────────────────
struct Pulse { int on_ms; int off_ms; };

// ─────────────────────────────────────────────
//  Global State
// ─────────────────────────────────────────────
BLECharacteristic *pNotifyCharacteristic = nullptr;
Preferences        prefs;

volatile bool deviceConnected   = false;
volatile bool globalAlarmsEnabled = true;

// In-RAM alarm database (loaded from NVS at boot)
Alarm alarmDB[MAX_ALARMS];

// ─────────────────────────────────────────────
//  Time State
//  The app sends an epoch (Unix UTC seconds) via sync_time.
//  We store it alongside the millis() value at that moment so
//  we can reconstruct "current time" at any point without an RTC.
// ─────────────────────────────────────────────
struct TimeState {
  time_t  epochAtSync;        // UTC epoch received from app
  unsigned long millisAtSync; // millis() when we received it
  bool    synced;             // false until first sync_time arrives
};
TimeState timeState = {0, 0, false};

// Returns current epoch (UTC) extrapolated from the last sync
time_t currentEpoch() {
  if (!timeState.synced) return 0;
  unsigned long elapsed = (millis() - timeState.millisAtSync) / 1000UL;
  return timeState.epochAtSync + (time_t)elapsed;
}

// Fill a tm struct with local time (UTC — no timezone offset applied;
// the app should send local time as the epoch if it wants local matching)
bool getCurrentTime(struct tm &out) {
  if (!timeState.synced) return false;
  time_t now = currentEpoch();
  gmtime_r(&now, &out);
  return true;
}

// Returns short day name for tm_wday (0=Sun … 6=Sat)
const char* wdayToShortName(int wday) {
  const char* names[] = {"Sun","Mon","Tue","Wed","Thu","Fri","Sat"};
  return names[wday % 7];
}

// ─────────────────────────────────────────────
//  Alarm Scheduler State Machine
// ─────────────────────────────────────────────
enum AlarmState {
  ALARM_IDLE,       // Nothing firing
  ALARM_FIRING,     // Vibration pattern running
  ALARM_SNOOZED,    // Waiting for snooze period to expire
  ALARM_DONE        // Alarm finished (duration elapsed or dismissed)
};

struct SchedulerState {
  AlarmState  state;
  int         activeSlot;         // Index into alarmDB[]

  // Non-blocking vibration engine
  unsigned long motorOnUntil;     // millis() when to turn motor off
  unsigned long motorOffUntil;    // millis() when to turn motor on again
  int           pulseIndex;       // Which pulse in the pattern sequence
  bool          motorRunning;

  // Duration & snooze tracking
  unsigned long alarmStartMs;     // When this alarm firing began
  unsigned long snoozeUntilMs;    // When snooze expires

  // Fire-once guard: track which minute we last fired each alarm
  // stored as "DDHHMM" integer to avoid re-triggering inside the same minute
  int           lastFiredMinute[MAX_ALARMS];
};

SchedulerState sched = {
  ALARM_IDLE, -1,
  0, 0, 0, false,
  0, 0,
  {}   // lastFiredMinute initialised in setup()
};

// ─────────────────────────────────────────────
//  BLE Packet Reassembly Buffer
//  (handles payloads larger than the 20-byte default MTU)
// ─────────────────────────────────────────────
String bleReceiveBuffer = "";

// ─────────────────────────────────────────────
//  Power / Battery
// ─────────────────────────────────────────────

// Returns battery percentage.
// CURRENT MODE: USB power → always reports 100% (USB/development).
// BATTERY MODE: uncomment the ADC block to read real voltage.
int readBatteryPercent() {

  // ── USB / Computer power (active) ────────────────────────────
  return 100;   // Fixed value while powered from USB

  // ── TP4056 + LiPo battery (uncomment when hardware is ready) ─
  /*
    Wiring:
      Battery (+) → 100kΩ → GPIO_ADC_PIN
      GPIO_ADC_PIN → 47kΩ  → GND
    This divider maps 4.2 V → ~1.4 V which is safe for the ESP32-C3
    3.3 V ADC rail.

    int raw = analogRead(BATTERY_ADC_PIN);           // 0–4095 (12-bit)
    float voltage = (raw / 4095.0f) * 3.3f;          // ADC pin voltage
    float battV   = voltage * ((100.0f + 47.0f) / 47.0f); // Undo divider → battery V
    // LiPo: 3.0 V = 0%,  4.2 V = 100%
    int pct = (int)(((battV - 3.0f) / (4.2f - 3.0f)) * 100.0f);
    pct = constrain(pct, 0, 100);
    return pct;
  */
}

// ─────────────────────────────────────────────
//  NVS Persistence Helpers
// ─────────────────────────────────────────────

// Persist the entire in-RAM alarm array to NVS flash
void saveAlarmsToFlash() {
  prefs.begin("lapidvibe", false);
  prefs.putBytes("alarmDB", alarmDB, sizeof(alarmDB));
  prefs.putBool("alarmsEnabled", globalAlarmsEnabled);
  prefs.end();
  Serial.println("[NVS] Alarm database saved to flash.");
}

// Reload alarm array from NVS into RAM on boot
void loadAlarmsFromFlash() {
  prefs.begin("lapidvibe", true);  // read-only
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
    // First boot — initialise all slots as empty
    Serial.println("[NVS] No saved data found. Initialising blank database.");
    memset(alarmDB, 0, sizeof(alarmDB));
    saveAlarmsToFlash();
  }
}

// Wipe NVS alarm storage (called on reset_device)
void clearAlarmsFromFlash() {
  prefs.begin("lapidvibe", false);
  prefs.clear();
  prefs.end();
  memset(alarmDB, 0, sizeof(alarmDB));
  Serial.println("[NVS] Flash storage wiped.");
}

// Find an existing alarm slot by alarm_id, or return -1
int findAlarmById(const char* id) {
  for (int i = 0; i < MAX_ALARMS; i++) {
    if (alarmDB[i].active && strcmp(alarmDB[i].alarm_id, id) == 0) {
      return i;
    }
  }
  return -1;
}

// Find the first free (inactive) slot, or return -1 if full
int findFreeSlot() {
  for (int i = 0; i < MAX_ALARMS; i++) {
    if (!alarmDB[i].active) return i;
  }
  return -1;
}

// ─────────────────────────────────────────────
//  Vibration Motor Control
// ─────────────────────────────────────────────

// Convert 0–100 intensity to PWM duty 0–255
int intensityToDuty(int pct) {
  return map(constrain(pct, 0, 100), 0, 100, 0, 255);
}

// Start the motor at a given intensity (0–100)
// ESP32 Arduino core v3: ledcWrite(pin, duty)
void motorOn(int intensityPct) {
  ledcWrite(MOTOR_PIN, intensityToDuty(intensityPct));
}

// Stop the motor
void motorOff() {
  ledcWrite(MOTOR_PIN, 0);
}

// ── Pattern Pulse Tables ─────────────────────
// Each pattern is a sequence of {on_ms, off_ms} pairs.
// The scheduler steps through them one pulse at a time, non-blocking.

const Pulse PATTERN_NORMAL[]        = { {500, 300}, {500, 300}, {500, 500} };
const Pulse PATTERN_GENTLE[]        = { {200, 300}, {200, 300}, {200, 800} };
const Pulse PATTERN_HEAVY_SLEEPER[] = { {800, 150}, {800, 150}, {1000, 300}, {1000, 300} };
const Pulse PATTERN_ESCALATING[]    = { {150, 200}, {300, 200}, {600, 200}, {1000, 300} };

const Pulse* patternTable(const char* name, int &outLen) {
  if (strcmp(name, "gentle") == 0)        { outLen = 3; return PATTERN_GENTLE; }
  if (strcmp(name, "heavy_sleeper") == 0) { outLen = 4; return PATTERN_HEAVY_SLEEPER; }
  if (strcmp(name, "escalating") == 0)    { outLen = 4; return PATTERN_ESCALATING; }
  outLen = 3; return PATTERN_NORMAL;   // default: "normal"
}

// Blocking variant — used only for test_vibration (runs once, returns)
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

// Check whether a given day abbreviation ("Mon") exists in the
// comma-separated repeat string ("Mon,Wed,Fri")
bool dayMatchesRepeat(const char* repeatStr, const char* dayName) {
  // Empty repeat string = one-time alarm; always matches the trigger day
  if (strlen(repeatStr) == 0) return true;
  // Simple substring search — safe because day names are unique 3-char tokens
  return strstr(repeatStr, dayName) != nullptr;
}

// Begin firing an alarm slot (called when time + day match)
void startAlarmFiring(int slot) {
  Alarm &a = alarmDB[slot];
  Serial.printf("[SCHED] *** ALARM FIRING: %s @ %s ***\n", a.alarm_id, a.alarm_time);

  sched.state        = ALARM_FIRING;
  sched.activeSlot   = slot;
  sched.alarmStartMs = millis();
  sched.pulseIndex   = 0;
  sched.motorRunning = false;
  sched.motorOnUntil = 0;
  sched.motorOffUntil= millis();   // trigger immediately on first tick
}

// Dismiss/stop the currently firing alarm
void stopAlarm(const char* reason) {
  motorOff();
  Serial.printf("[SCHED] Alarm stopped (%s).\n", reason);
  sched.state      = ALARM_IDLE;
  sched.activeSlot = -1;
}

// Advance the non-blocking vibration pulse engine — call every loop tick
void tickVibrationEngine(int slot) {
  Alarm &a = alarmDB[slot];
  unsigned long now = millis();
  int patLen;
  const Pulse* pulses = patternTable(a.pattern, patLen);

  if (!sched.motorRunning) {
    // Motor is currently off — wait for off period to expire
    if (now >= sched.motorOffUntil) {
      // Wrap pulse index to repeat the pattern continuously
      if (sched.pulseIndex >= patLen) sched.pulseIndex = 0;
      motorOn(a.intensity);
      sched.motorRunning = true;
      sched.motorOnUntil = now + pulses[sched.pulseIndex].on_ms;
    }
  } else {
    // Motor is running — wait for on period to expire
    if (now >= sched.motorOnUntil) {
      motorOff();
      sched.motorRunning  = false;
      sched.motorOffUntil = now + pulses[sched.pulseIndex].off_ms;
      sched.pulseIndex++;
    }
  }
}

// Main scheduler tick — call every loop iteration
void tickAlarmScheduler() {
  unsigned long now = millis();

  // ── STATE: FIRING ──────────────────────────
  if (sched.state == ALARM_FIRING) {
    int slot = sched.activeSlot;
    Alarm &a = alarmDB[slot];

    // Check if total duration has elapsed
    unsigned long elapsed = (now - sched.alarmStartMs) / 1000UL;
    if (elapsed >= (unsigned long)a.duration_sec) {
      // Duration done — check if snooze is configured
      if (a.snooze > 0) {
        motorOff();
        sched.state        = ALARM_SNOOZED;
        sched.snoozeUntilMs = now + ((unsigned long)a.snooze * 60000UL);
        Serial.printf("[SCHED] Duration elapsed. Snoozing for %d min...\n", a.snooze);
      } else {
        stopAlarm("duration elapsed, no snooze");
      }
      return;
    }

    // Keep pulsing
    tickVibrationEngine(slot);
    return;
  }

  // ── STATE: SNOOZED ────────────────────────
  if (sched.state == ALARM_SNOOZED) {
    if (now >= sched.snoozeUntilMs) {
      Serial.println("[SCHED] Snooze expired — re-firing alarm.");
      startAlarmFiring(sched.activeSlot);   // re-enter FIRING state
    }
    return;
  }

  // ── STATE: IDLE — scan for triggers ───────
  if (!globalAlarmsEnabled || !timeState.synced) return;

  struct tm t;
  if (!getCurrentTime(t)) return;

  // Build "DDHHMM" token to guard against firing more than once per minute
  int minuteToken = (t.tm_mday * 10000) + (t.tm_hour * 100) + t.tm_min;
  const char* todayName = wdayToShortName(t.tm_wday);

  // Build "HH:MM" string for comparison
  char currentHHMM[6];
  snprintf(currentHHMM, sizeof(currentHHMM), "%02d:%02d", t.tm_hour, t.tm_min);

  for (int i = 0; i < MAX_ALARMS; i++) {
    Alarm &a = alarmDB[i];
    if (!a.active || !a.enabled) continue;

    // Already fired this minute?
    if (sched.lastFiredMinute[i] == minuteToken) continue;

    // Time match?
    if (strcmp(a.alarm_time, currentHHMM) != 0) continue;

    // Day match?
    if (!dayMatchesRepeat(a.repeat, todayName)) continue;

    // All conditions met — fire!
    sched.lastFiredMinute[i] = minuteToken;
    startAlarmFiring(i);
    return;   // Only fire one alarm at a time
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

  // Include current HH:MM so app can verify time is correct
  if (timeState.synced) {
    struct tm t;
    if (getCurrentTime(t)) {
      char buf[6];
      snprintf(buf, sizeof(buf), "%02d:%02d", t.tm_hour, t.tm_min);
      doc["current_time"] = buf;
      doc["current_day"]  = wdayToShortName(t.tm_wday);
    }
  }

  // Report scheduler state so the app can show a "firing" indicator
  const char* stateStr = "idle";
  if (sched.state == ALARM_FIRING)  stateStr = "firing";
  if (sched.state == ALARM_SNOOZED) stateStr = "snoozed";
  doc["alarm_state"] = stateStr;
  if (sched.activeSlot >= 0 && alarmDB[sched.activeSlot].active) {
    doc["active_alarm_id"] = alarmDB[sched.activeSlot].alarm_id;
  }

  String payload;
  serializeJson(doc, payload);

  pNotifyCharacteristic->setValue(payload.c_str());
  pNotifyCharacteristic->notify();

  Serial.print("[BLE→APP] ");
  Serial.println(payload);
}

// ─────────────────────────────────────────────
//  Command Dispatcher
// ─────────────────────────────────────────────

// Write a single alarm object (parsed JsonObject) into the database
void writeAlarmFromJson(JsonObjectConst obj) {
  const char* id = obj["alarm_id"] | "unknown";

  // Find existing slot or grab a free one
  int slot = findAlarmById(id);
  if (slot == -1) slot = findFreeSlot();
  if (slot == -1) {
    Serial.println("[ALARM] ERROR: Alarm database is full! Cannot save.");
    return;
  }

  Alarm &a = alarmDB[slot];
  a.active = true;
  strlcpy(a.alarm_id,   id,                    sizeof(a.alarm_id));
  
  const char* rawTime = obj["alarm_time"] | "00:00";
  // Normalize time format "H:MM" (e.g. "7:30") to "07:30"
  if (strlen(rawTime) == 4 && rawTime[1] == ':') {
    char paddedTime[6];
    paddedTime[0] = '0';
    paddedTime[1] = rawTime[0];
    paddedTime[2] = ':';
    paddedTime[3] = rawTime[2];
    paddedTime[4] = rawTime[3];
    paddedTime[5] = '\0';
    strlcpy(a.alarm_time, paddedTime, sizeof(a.alarm_time));
  } else {
    strlcpy(a.alarm_time, rawTime, sizeof(a.alarm_time));
  }
  
  a.enabled      = obj["enabled"]      | false;
  a.intensity    = obj["intensity"]    | 80;
  a.duration_sec = obj["duration_sec"] | 60;
  a.snooze       = obj["snooze"]       | 5;
  strlcpy(a.pattern, obj["pattern"] | "normal", sizeof(a.pattern));

  // Flatten repeat array → comma-separated string "Mon,Wed,Fri"
  a.repeat[0] = '\0';
  JsonArrayConst days = obj["repeat"];
  bool first = true;
  for (JsonVariantConst d : days) {
    if (!first) strlcat(a.repeat, ",", sizeof(a.repeat));
    strlcat(a.repeat, d.as<const char*>(), sizeof(a.repeat));
    first = false;
  }

  Serial.printf("[ALARM] Saved slot[%d] → ID:%s  Time:%s  Enabled:%s  Pattern:%s  "
                "Intensity:%d%%  Duration:%ds  Snooze:%dm  Days:[%s]\n",
                slot, a.alarm_id, a.alarm_time, a.enabled ? "YES" : "NO",
                a.pattern, a.intensity, a.duration_sec, a.snooze, a.repeat);
}

void handleIncomingJson(const String& jsonString) {
  // Use a generous document size to safely hold sync_alarms payloads
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
    // Compatibility Layer: Convert legacy App → Wearable JSON format
    cmd = "set_alarm";
    doc["cmd"] = "set_alarm";
    doc["alarm_id"] = "legacy-app-alarm";
    doc["alarm_time"] = doc["time"]; // map "time" to "alarm_time"
    Serial.println("[COMPAT] Converted legacy 'type: alarm' payload to 'set_alarm' cmd.");
  } else {
    Serial.println("[JSON] Missing or invalid 'cmd' or compatibility 'type' key.");
    return;
  }

  Serial.printf("\n[CMD] Received: %s\n", cmd.c_str());

  // ── 1. test_vibration ──────────────────────
  if (cmd == "test_vibration") {
    String  pattern   = doc["pattern"]   | "normal";
    int     intensity = doc["intensity"] | 80;
    runPatternBlocking(pattern, intensity);
  }

  // ── 2. set_alarm ───────────────────────────
  else if (cmd == "set_alarm") {
    writeAlarmFromJson(doc.as<JsonObjectConst>());
    saveAlarmsToFlash();
  }

  // ── 3. sync_alarms ─────────────────────────
  // Full replace: wipe existing database, write incoming list
  else if (cmd == "sync_alarms") {
    JsonArrayConst list = doc["alarms"];
    Serial.printf("[SYNC] Clearing database. Importing %d alarm(s)...\n", list.size());
    memset(alarmDB, 0, sizeof(alarmDB));   // wipe in-RAM database

    for (JsonObjectConst item : list) {
      writeAlarmFromJson(item);
    }
    saveAlarmsToFlash();
    Serial.println("[SYNC] Sync complete.");
  }

  // ── 4. set_alarms_enabled ──────────────────
  else if (cmd == "set_alarms_enabled") {
    globalAlarmsEnabled = doc["enabled"] | false;
    saveAlarmsToFlash();
    Serial.printf("[STATE] Global alarms → %s\n", globalAlarmsEnabled ? "ENABLED" : "DISABLED");
  }

  // ── 5. sync_time ───────────────────────────
  // Payload: {"cmd":"sync_time","epoch":1700000000}
  // The app should send its LOCAL time as a Unix epoch so that
  // HH:MM comparisons work in the user's timezone without any
  // offset math on the device side.
  else if (cmd == "sync_time") {
    long long epoch = doc["epoch"] | (long long)0;
    if (epoch > 0) {
      timeState.epochAtSync  = (time_t)epoch;
      timeState.millisAtSync = millis();
      timeState.synced       = true;

      struct tm t;
      gmtime_r(&timeState.epochAtSync, &t);
      Serial.printf("[TIME] Synced → %04d-%02d-%02d %02d:%02d:%02d (%s)\n",
                    t.tm_year + 1900, t.tm_mon + 1, t.tm_mday,
                    t.tm_hour, t.tm_min, t.tm_sec,
                    wdayToShortName(t.tm_wday));
    } else {
      Serial.println("[TIME] sync_time received but epoch was 0 or missing.");
    }
  }

  // ── 6. dismiss_alarm ───────────────────────
  // App button: user taps "Stop" while alarm is firing or snoozed
  // Payload: {"cmd":"dismiss_alarm"}
  else if (cmd == "dismiss_alarm") {
    if (sched.state == ALARM_FIRING || sched.state == ALARM_SNOOZED) {
      stopAlarm("dismissed by app");
    } else {
      Serial.println("[SCHED] dismiss_alarm received but no alarm is active.");
    }
  }

  // ── 7. snooze_alarm ────────────────────────
  // App button: user taps "Snooze" — overrides the alarm's own snooze value
  // with an optional custom duration from the app.
  // Payload: {"cmd":"snooze_alarm"} or {"cmd":"snooze_alarm","minutes":10}
  else if (cmd == "snooze_alarm") {
    if (sched.state == ALARM_FIRING) {
      int minutes = doc["minutes"] | (sched.activeSlot >= 0 ? alarmDB[sched.activeSlot].snooze : 5);
      motorOff();
      sched.state         = ALARM_SNOOZED;
      sched.snoozeUntilMs = millis() + ((unsigned long)minutes * 60000UL);
      Serial.printf("[SCHED] Snoozed for %d min by app request.\n", minutes);
    } else {
      Serial.println("[SCHED] snooze_alarm received but alarm is not currently firing.");
    }
  }

  // ── 8. reset_device ───────────────────────
  // Requires a matching token to prevent accidental wipes
  else if (cmd == "reset_device") {
    const char* token = doc["token"] | "";
    if (strcmp(token, RESET_SECRET) == 0) {
      Serial.println("[RESET] Valid token. Wiping flash and restarting...");
      clearAlarmsFromFlash();
      delay(500);
      ESP.restart();
    } else {
      // Also allow token-less reset during development (remove in production)
      Serial.println("[RESET] No token provided — resetting anyway (DEV MODE).");
      clearAlarmsFromFlash();
      delay(500);
      ESP.restart();
    }
  }

  else {
    Serial.printf("[CMD] Unknown command: %s\n", cmd.c_str());
  }

  // Push an updated status frame after every command
  sendDeviceStatusUpdate();
}

// ─────────────────────────────────────────────
//  BLE Callbacks
// ─────────────────────────────────────────────

class CommandCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pChar) override {
    // Append incoming chunk to reassembly buffer
    String chunk = pChar->getValue();
    if (chunk.length() == 0) return;

    bleReceiveBuffer += chunk;

    // A complete JSON object ends with '}'
    // Count braces to detect a fully received payload
    int depth = 0;
    bool complete = false;
    for (char c : bleReceiveBuffer) {
      if (c == '{') depth++;
      else if (c == '}') { depth--; if (depth == 0) { complete = true; break; } }
    }

    if (complete) {
      Serial.println("\n--- [RAW INCOMING BLE PAYLOAD START] ---");
      Serial.println(bleReceiveBuffer);
      Serial.println("--- [RAW INCOMING BLE PAYLOAD END] ---\n");
      
      Serial.printf("[BLE←APP] Received %d bytes\n", bleReceiveBuffer.length());
      handleIncomingJson(bleReceiveBuffer);
      bleReceiveBuffer = "";   // clear for next message
    }
  }
};

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) override {
    deviceConnected = true;
    Serial.println("[BLE] App connected.");
    // Send current status immediately on connect
    sendDeviceStatusUpdate();
  }
  void onDisconnect(BLEServer* pServer) override {
    deviceConnected = false;
    bleReceiveBuffer = "";   // discard any partial packet
    Serial.println("[BLE] App disconnected. Re-advertising...");
    BLEDevice::startAdvertising();
  }
};

// ─────────────────────────────────────────────
//  setup()
// ─────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n========================================");
  Serial.println("  LapidVibe Band — Firmware v" FIRMWARE_VERSION);
  Serial.println("  Power source : USB / Computer (dev)");
  Serial.println("========================================\n");

  // Motor PWM init
  // ESP32 Arduino core v3: ledcAttach(pin, freq, resolution) replaces
  // the old ledcSetup(channel,...) + ledcAttachPin(pin, channel) pattern.
  ledcAttach(MOTOR_PIN, PWM_FREQ_HZ, PWM_RESOLUTION);
  motorOff();
  Serial.printf("[MOTOR] PWM on GPIO%d ready.\n", MOTOR_PIN);

  // ── Battery ADC init (uncomment for TP4056 build) ──────────
  // analogReadResolution(12);  // 12-bit ADC on ESP32-C3
  // pinMode(BATTERY_ADC_PIN, INPUT);
  // Serial.printf("[BAT] ADC on GPIO%d ready.\n", BATTERY_ADC_PIN);

  // Initialise scheduler fire-guard array
  memset(sched.lastFiredMinute, -1, sizeof(sched.lastFiredMinute));
  Serial.println("[SCHED] Alarm scheduler ready. Awaiting time sync from app.");

  // Load persistent alarm database
  loadAlarmsFromFlash();

  // BLE setup
  BLEDevice::init(DEVICE_NAME);
  BLEServer *pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);

  // Write characteristic (App → Device)
  BLECharacteristic *pCommandChar = pService->createCharacteristic(
    COMMAND_CHAR_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_WRITE
  );
  pCommandChar->setCallbacks(new CommandCallbacks());

  // Notify characteristic (Device → App)
  pNotifyCharacteristic = pService->createCharacteristic(
    NOTIFY_CHAR_UUID,
    BLECharacteristic::PROPERTY_NOTIFY
  );
  pNotifyCharacteristic->addDescriptor(new BLE2902());

  pService->start();

  // Advertising
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);   // helps iPhone connections
  BLEDevice::startAdvertising();

  Serial.println("[BLE] Advertising as '" DEVICE_NAME "'. Waiting for app...\n");
}

// ─────────────────────────────────────────────
//  loop()
// ─────────────────────────────────────────────
void loop() {
  static unsigned long lastStatusUpdate = 0;

  // ── Non-blocking alarm scheduler ──────────────────────────────
  // Runs every loop tick — checks for alarm triggers and drives
  // the vibration pulse engine without blocking BLE or serial I/O.
  tickAlarmScheduler();

  // Push telemetry to app every 10 seconds while connected
  if (deviceConnected && (millis() - lastStatusUpdate > 10000)) {
    lastStatusUpdate = millis();
    sendDeviceStatusUpdate();
  }

  delay(20);
}
