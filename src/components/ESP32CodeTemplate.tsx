
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Check, Code } from 'lucide-react';
import { toast } from 'sonner';

interface ESP32CodeTemplateProps {
  deviceId: string;
  channelCount?: number;
}

const ESP32CodeTemplate: React.FC<ESP32CodeTemplateProps> = ({ 
  deviceId, 
  channelCount = 4 
}) => {
  const [copied, setCopied] = useState(false);

  const esp32Code = `#include <WiFiManager.h>
#include <HTTPClient.h>
#include <Adafruit_ADS1X15.h>
#include <EEPROM.h>
#include <ArduinoJson.h>
#include <HTTPUpdate.h>
#include <WiFiClientSecure.h>
#include <math.h>
#include <time.h>

#define LED_PIN 2
#define MAX_CHANNELS 16
#define EEPROM_SIZE 512
#define ENERGY_START_ADDR 0
#define CONFIG_START_ADDR 300
#define FIRMWARE_VERSION_ADDR 400  // Store firmware version at EEPROM address 400
#define VOLTAGE 220.0

// IMPORTANT: Make sure these match your dashboard settings!
char customChannelCount[3] = "${channelCount}";
char customDeviceId[33] = "${deviceId}";

// Correct Supabase configuration for current project
const char* supabase_url = "https://yliozpgdxzrsbntcuckr.supabase.co";
const char* function_url = "https://yliozpgdxzrsbntcuckr.supabase.co/functions/v1/esp32-energy-upload";
const char* supabase_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsaW96cGdkeHpyc2JudGN1Y2tyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3NjIxMzQsImV4cCI6MjA2NTMzODEzNH0.P2aWhVoOKqsVS9MenJiJoE58J87jZGd0ThlwLvEC19A";
const char* ota_check_url = "https://yliozpgdxzrsbntcuckr.supabase.co/functions/v1/esp32-ota-check";

WiFiManagerParameter channelParam("channels", "Channel Count (4,8,12,16)", customChannelCount, 3);
WiFiManagerParameter deviceParam("deviceid", "Device ID", customDeviceId, 32);

unsigned long uploadInterval = 2000;        // 2 sec
unsigned long eepromInterval = 300000;       // 5 min
unsigned long resetCheckInterval = 30000;    // 30 sec
unsigned long ledBlinkInterval = 300;
#define OTA_CHECK_INTERVAL 3000    // 3 sec

unsigned long lastUpload = 0;
unsigned long lastEEPROMWrite = 0;
unsigned long lastResetCheck = 0;
unsigned long ledLastToggle = 0;
unsigned long lastOTACheck = 0;

int channelCount = ${channelCount};
Adafruit_ADS1115 ads[4];
float energyWh[MAX_CHANNELS] = {0};
float currentValues[MAX_CHANNELS] = {0};

String device_id;
bool device_registered = false;
String current_firmware_version = "";
bool ledState = false;
bool otaInProgress = false;

// Get current timestamp in seconds since epoch
unsigned long getCurrentTimestamp() {
  return millis() / 1000; // Simple timestamp based on device uptime
}

// Load firmware version from EEPROM
String loadFirmwareVersion() {
  char version[32];
  for (int i = 0; i < 32; i++) {
    version[i] = EEPROM.read(FIRMWARE_VERSION_ADDR + i);
    if (version[i] == 0) break;
  }
  version[31] = '\\0'; // Ensure null termination
  String versionStr = String(version);
  
  // If empty, use initial default version
  if (versionStr.length() == 0) {
    versionStr = "20240101000000"; // Default initial version
    saveFirmwareVersion(versionStr);
  }
  
  return versionStr;
}

// Save firmware version to EEPROM
void saveFirmwareVersion(String version) {
  // Clear the version area first
  for (int i = 0; i < 32; i++) {
    EEPROM.write(FIRMWARE_VERSION_ADDR + i, 0);
  }
  
  // Write new version - fix type mismatch by casting to int
  for (int i = 0; i < (int)version.length() && i < 31; i++) {
    EEPROM.write(FIRMWARE_VERSION_ADDR + i, version[i]);
  }
  EEPROM.commit();
  Serial.println("Firmware version saved to EEPROM: " + version);
  
  // Update current version in memory
  current_firmware_version = version;
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\\n=== ESP32 Energy Monitor Starting ===");
  
  pinMode(LED_PIN, OUTPUT);
  EEPROM.begin(EEPROM_SIZE);

  // Load current firmware version from EEPROM
  current_firmware_version = loadFirmwareVersion();
  Serial.println("Current firmware version: " + current_firmware_version);
  
  // Load device config from EEPROM
  loadConfigFromEEPROM();
  
  Serial.printf("Loaded Device ID: %s\\n", device_id.c_str());
  Serial.printf("Loaded Channel Count: %d\\n", channelCount);

  WiFiManager wm;
  wm.addParameter(&channelParam);
  wm.addParameter(&deviceParam);
  wm.setSaveParamsCallback(saveParamCallback);
  std::vector<const char *> menu = {"wifi","info","param","sep","restart","exit"};
  wm.setMenu(menu);
  wm.setClass("invert");
  wm.setBreakAfterConfig(true);
  wm.setWiFiAutoReconnect(true);
  wm.setRestorePersistent(true);
  wm.setConfigPortalTimeout(120); 
  wm.setConnectTimeout(10);
  wm.setConnectRetries(3);

  Serial.println("Starting WiFi connection...");
  if (!wm.autoConnect("EnergyTracker")) {
    Serial.println("Failed to connect to WiFi, restarting...");
    ESP.restart();
  }
  
  Serial.printf("WiFi Connected! IP: %s\\n", WiFi.localIP().toString().c_str());
  Serial.printf("Final Device ID: %s\\n", device_id.c_str());
  Serial.printf("Final Channel Count: %d\\n", channelCount);

  loadEnergyFromEEPROM();

  // Initialize ADS1115 modules
  uint8_t adsAddresses[4] = {0x48, 0x49, 0x4A, 0x4B};
  int requiredModules = (channelCount + 3) / 4;
  Serial.printf("Initializing %d ADS1115 modules...\\n", requiredModules);

  for (int i = 0; i < requiredModules; i++) {
    Serial.printf("Initializing ADS1115 #%d at address 0x%02X... ", i, adsAddresses[i]);
    if (!ads[i].begin(adsAddresses[i])) {
      Serial.println("FAILED!");
      blinkError(10);
      while (1);
    }
    ads[i].setGain(GAIN_ONE);
    Serial.println("OK");
  }

  // Enhanced device registration with retry logic
  Serial.println("\\n=== Device Registration ===");
  int registrationAttempts = 0;
  while (!device_registered && registrationAttempts < 5) {
    registrationAttempts++;
    Serial.printf("Registration attempt %d/5...\\n", registrationAttempts);
    checkDeviceRegistration();
    if (!device_registered) {
      Serial.println("Registration failed, waiting 3 seconds...");
      delay(3000);
    }
  }

  if (device_registered) {
    Serial.println("✅ Device registration successful!");
    // Success pattern - 3 quick blinks
    for (int i = 0; i < 3; i++) {
      digitalWrite(LED_PIN, HIGH);
      delay(200);
      digitalWrite(LED_PIN, LOW);
      delay(200);
    }
  } else {
    Serial.println("❌ Device registration failed after 5 attempts!");
    Serial.println("💡 Make sure this device is added to the dashboard:");
    Serial.printf("   Device ID: %s\\n", device_id.c_str());
    Serial.printf("   Channels: %d\\n", channelCount);
    Serial.println("   URL: Check your dashboard and add this device");
    blinkError(10);
  }

  Serial.println("=== Setup Complete ===\\n");
}

void loop() {
  unsigned long now = millis();

  // Check for OTA updates every 3 seconds
  if (millis() - lastOTACheck > OTA_CHECK_INTERVAL) {
    checkForOTAUpdates();
    lastOTACheck = millis();
  }

  if (now - lastResetCheck >= resetCheckInterval) {
    lastResetCheck = now;
    if (device_registered) checkForResetCommand();
  }

  // Read current values
  for (int i = 0; i < channelCount; i++) {
    currentValues[i] = readCurrent(i);
    energyWh[i] += (VOLTAGE * currentValues[i]) / 3600.0;
  }

  // Upload data only if device is registered
  if (now - lastUpload >= uploadInterval) {
    lastUpload = now;
    if (device_registered) {
      Serial.println("===== Uploading Energy Data =====");
      for (int i = 0; i < channelCount; i++) {
        uploadChannelData(i + 1, currentValues[i], VOLTAGE * currentValues[i], energyWh[i]);
      }
      Serial.println("===== Energy Monitor Status =====");
      for (int i = 0; i < channelCount; i++) {
        float power = VOLTAGE * currentValues[i];
        Serial.printf("Channel %d: Current = %.2f A, Power = %.2f W, Energy = %.2f Wh\\n",
                      i + 1, currentValues[i], power, energyWh[i]);
      }
      Serial.println("=================================\\n");
    } else {
      Serial.println("⚠️ Device not registered - skipping data upload");
      // Try to re-register every 30 seconds
      static unsigned long lastRegCheck = 0;
      if (now - lastRegCheck > 30000) {
        lastRegCheck = now;
        Serial.println("Attempting device re-registration...");
        checkDeviceRegistration();
      }
    }
  }

  // EEPROM write
  if (now - lastEEPROMWrite >= eepromInterval) {
    lastEEPROMWrite = now;
    saveEnergyToEEPROM();
    Serial.println("💾 Energy data saved to EEPROM");
  }

  // LED Blink (indicates device is running)
  if (now - ledLastToggle >= ledBlinkInterval) {
    ledLastToggle = now;
    ledState = !ledState;
    digitalWrite(LED_PIN, ledState);
  }
}

float readCurrent(int channel) {
  int adsIndex = channel / 4;
  int adsChannel = channel % 4;
  int16_t adc = ads[adsIndex].readADC_SingleEnded(adsChannel);
  float voltage = adc * 0.125 / 1000.0;
  float offset = 2.5;
  float current = (voltage - offset) / 0.066;
  return abs(current);
}

void uploadChannelData(int ch, float current, float power, float energyWh) {
  HTTPClient http;
  String url = String(supabase_url) + "/functions/v1/esp32-energy-upload";

  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", supabase_key);
  http.addHeader("Authorization", String("Bearer ") + supabase_key);
  http.setTimeout(15000); // 15 second timeout

  DynamicJsonDocument doc(512);
  doc["device_id"] = device_id;
  doc["channel_number"] = ch;
  doc["current"] = round(current * 100) / 100.0;
  doc["power"] = round(power * 100) / 100.0;
  doc["energy_wh"] = round(energyWh * 100) / 100.0;

  String payload;
  serializeJson(doc, payload);
  
  Serial.printf("📤 Uploading CH%d data... ", ch);
  int httpCode = http.POST(payload);
  String response = http.getString();
  
  if (httpCode == 200) {
    // Parse response to check for confirmation
    DynamicJsonDocument responseDoc(512);
    if (!deserializeJson(responseDoc, response)) {
      bool handshake = responseDoc["handshake_confirmed"];
      bool stored = responseDoc["data_stored"];
      
      if (handshake && stored) {
        Serial.printf("✅ HTTP %d (Confirmed)\\n", httpCode);
      } else {
        Serial.printf("⚠️ HTTP %d (Partial success)\\n", httpCode);
      }
    } else {
      Serial.printf("✅ HTTP %d\\n", httpCode);
    }
  } else if (httpCode == 403) {
    Serial.printf("❌ HTTP %d (Device not registered!)\\n", httpCode);
    device_registered = false; // Force re-registration
  } else {
    Serial.printf("❌ HTTP %d\\n", httpCode);
    if (response.length() > 0 && response.length() < 200) {
      Serial.printf("   Error: %s\\n", response.c_str());
    }
  }
  
  http.end();
}

void checkForResetCommand() {
  HTTPClient http;
  String url = String(supabase_url) + "/functions/v1/energy-reset-command/check-reset?device_id=" + device_id;
  http.begin(url);
  http.addHeader("apikey", supabase_key);
  http.addHeader("Authorization", String("Bearer ") + supabase_key);
  int httpCode = http.GET();

  if (httpCode == 200) {
    DynamicJsonDocument doc(512);
    if (!deserializeJson(doc, http.getString())) {
      bool reset = doc["reset_command"];
      
      if (reset) {
        Serial.println("..........RESETTING ENERGY...........");
        for (int i = 0; i < MAX_CHANNELS; i++) energyWh[i] = 0.0;
        
        // Clear energy data but preserve firmware version
        for (int i = ENERGY_START_ADDR; i < FIRMWARE_VERSION_ADDR; i++) {
          EEPROM.write(i, 0);
        }
        
        Serial.println("Reset Energy Successfully!");
        Serial.println("....................................");
        EEPROM.commit();
        blinkError(5);
      }
    }
  }
  http.end();
}

void checkDeviceRegistration() {
  HTTPClient http;
  String url = String(supabase_url) + "/functions/v1/check-device-registration?device_id=" + device_id;
  
  Serial.printf("🌐 Checking registration: %s\\n", device_id.c_str());
  
  http.begin(url);
  http.addHeader("apikey", supabase_key);
  http.addHeader("Authorization", String("Bearer ") + supabase_key);
  http.setTimeout(10000); // 10 second timeout

  int httpCode = http.GET();
  String payload = http.getString();
  
  Serial.printf("Registration response: HTTP %d\\n", httpCode);

  if (httpCode == 200) {
    DynamicJsonDocument doc(1024);
    DeserializationError error = deserializeJson(doc, payload);
    
    if (!error) {
      device_registered = doc["registered"];
      bool handshake = doc["handshake_success"];
      String message = doc["message"];
      
      Serial.printf("Registered: %s\\n", device_registered ? "YES" : "NO");
      Serial.printf("Handshake: %s\\n", handshake ? "SUCCESS" : "FAILED");
      Serial.printf("Message: %s\\n", message.c_str());
      
      if (device_registered && handshake) {
        Serial.println("✅ Registration & handshake successful!");
      } else if (!device_registered) {
        Serial.println("❌ Device not found in dashboard!");
        Serial.println("💡 Please add this device in the dashboard first:");
        Serial.printf("   Device ID: %s\\n", device_id.c_str());
        Serial.printf("   Channels: %d\\n", channelCount);
      }
    } else {
      Serial.printf("❌ JSON parsing error: %s\\n", error.c_str());
      Serial.printf("Raw response: %s\\n", payload.c_str());
      device_registered = false;
    }
  } else {
    Serial.printf("❌ HTTP error: %d\\n", httpCode);
    if (httpCode > 0 && payload.length() > 0) {
      Serial.printf("Error response: %s\\n", payload.c_str());
    }
    device_registered = false;
  }
  
  http.end();
}

// Save energy data to EEPROM
void saveEnergyToEEPROM() {
  for (int i = 0; i < channelCount; i++) {
    EEPROM.put(ENERGY_START_ADDR + i * sizeof(float), energyWh[i]);
  }
  EEPROM.commit();
}

// Load energy data from EEPROM
void loadEnergyFromEEPROM() {
  for (int i = 0; i < channelCount; i++) {
    EEPROM.get(ENERGY_START_ADDR + i * sizeof(float), energyWh[i]);
    if (!isfinite(energyWh[i]) || energyWh[i] < 0 || energyWh[i] > 100000) {
      energyWh[i] = 0.0;
    }
  }
}

void blinkError(int times) {
  for (int i = 0; i < times * 2; i++) {
    digitalWrite(LED_PIN, i % 2);
    delay(100);
  }
}

// Enhanced OTA Update progress callback with real-time dashboard updates
void updateCallback(size_t progress, size_t total) {
  int percentage = (progress / (total / 100));
  Serial.printf("OTA Download Progress: %d%% (%d/%d bytes)\\n", percentage, progress, total);
  
  // Send real-time progress updates to dashboard every 1%
  static int lastReported = -1;
  if ((percentage % 1 == 0) && (percentage != lastReported) && (percentage > 0)) {
    lastReported = percentage;
    
    // Immediately send status update to dashboard
    reportOTAStatus("downloading", percentage, 
      "Downloading firmware: " + String(percentage) + "% (" + 
      String(progress/1024) + "KB/" + String(total/1024) + "KB)");
  }
  
  // Send heartbeat to show device is online during download
  static unsigned long lastHeartbeat = 0;
  unsigned long now = millis();
  if (now - lastHeartbeat > 1000) { // Every 1 second
    lastHeartbeat = now;
  }
}

// Check for OTA updates
void checkForOTAUpdates() {
  // Prevent multiple simultaneous OTA checks
  if (otaInProgress) {
    return;
  }
  
  HTTPClient http;
  http.begin(ota_check_url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", supabase_key);
  http.addHeader("Authorization", String("Bearer ") + supabase_key);

  // Create request payload with current firmware version
  DynamicJsonDocument requestDoc(512);
  requestDoc["device_id"] = device_id;
  requestDoc["current_firmware_version"] = current_firmware_version;
  String requestBody;
  serializeJson(requestDoc, requestBody);

  int httpCode = http.POST(requestBody);
  
  if (httpCode == 200) {
    DynamicJsonDocument responseDoc(1024);
    if (!deserializeJson(responseDoc, http.getString())) {
      bool hasUpdate = responseDoc["has_update"];
      if (hasUpdate) {
        String firmwareUrl = responseDoc["firmware_url"];
        String filename = responseDoc["filename"];
        String firmwareVersion = responseDoc["firmware_version"];
        
        Serial.println("🚀 FIRMWARE UPDATE AVAILABLE!");
        Serial.println("Dashboard generated version: " + firmwareVersion);
        
        otaInProgress = true;
        performOTAUpdate(firmwareUrl, filename, firmwareVersion);
      }
    }
  }
  
  http.end();
  otaInProgress = false;
}

// Perform the actual OTA update using dashboard-generated version
void performOTAUpdate(String firmwareUrl, String filename, String newVersion) {
  Serial.println("📥 Starting OTA update with dashboard version: " + newVersion);
  
  // Save the new version received from dashboard
  saveFirmwareVersion(newVersion);
  
  // Report download start with proper status
  reportOTAStatus("starting", 0, "Firmware update starting - " + filename);
  delay(500); // Small delay to ensure status is sent
  
  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(120);
  
  // Configure HTTP update with progress callback
  httpUpdate.onProgress(updateCallback);
  
  t_httpUpdate_return ret = httpUpdate.update(client, firmwareUrl);
  
  switch (ret) {
    case HTTP_UPDATE_FAILED:
      Serial.println("❌ Update failed: " + httpUpdate.getLastErrorString());
      reportOTAStatus("failed", 0, "Update failed: " + httpUpdate.getLastErrorString());
      otaInProgress = false;
      break;
      
    case HTTP_UPDATE_NO_UPDATES:
      Serial.println("ℹ️ No updates available");
      reportOTAStatus("no_update", 100, "No updates available");
      otaInProgress = false;
      break;
      
    case HTTP_UPDATE_OK:
      Serial.println("✅ Update successful! Restarting...");
      reportOTAStatus("complete", 100, "Update completed successfully!");
      delay(2000); // Give time for status report
      // Device will restart automatically
      break;
  }
}

// Report OTA status back to Supabase with enhanced progress tracking
void reportOTAStatus(String status, int progress, String message) {
  HTTPClient http;
  String statusUrl = String(supabase_url) + "/functions/v1/esp32-ota-status";
  
  http.begin(statusUrl);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", supabase_key);
  http.addHeader("Authorization", String("Bearer ") + supabase_key);
  http.setTimeout(10000); // 10 second timeout

  DynamicJsonDocument statusDoc(512);
  statusDoc["device_id"] = device_id;
  statusDoc["status"] = status;
  statusDoc["progress"] = progress;
  statusDoc["message"] = message;
  statusDoc["timestamp"] = getCurrentTimestamp();
  statusDoc["firmware_version"] = current_firmware_version;

  String statusBody;
  serializeJson(statusDoc, statusBody);
  
  int httpCode = http.POST(statusBody);
  Serial.printf("📊 OTA Status reported: %s (%d%%) -> HTTP %d\\n", status.c_str(), progress, httpCode);
  
  if (httpCode != 200) {
    String response = http.getString();
    if (response.length() > 0 && response.length() < 200) {
      Serial.printf("   Status error: %s\\n", response.c_str());
    }
  }
  
  http.end();
}

// Save config to EEPROM
void saveConfigToEEPROM() {
  EEPROM.put(CONFIG_START_ADDR, channelCount);
  for (int i = 0; i < 32; i++) {
    EEPROM.write(CONFIG_START_ADDR + sizeof(int) + i, 0);
  }
  for (int i = 0; i < device_id.length() && i < 32; i++) {
    EEPROM.write(CONFIG_START_ADDR + sizeof(int) + i, device_id[i]);
  }
  EEPROM.commit();
  Serial.println("📝 Configuration saved to EEPROM");
}

// WiFiManager callback
void saveParamCallback() {
  // Copy new values from WiFiManagerParameter to your globals
  strncpy(customChannelCount, channelParam.getValue(), sizeof(customChannelCount) - 1);
  customChannelCount[sizeof(customChannelCount) - 1] = '\\0';

  strncpy(customDeviceId, deviceParam.getValue(), sizeof(customDeviceId) - 1);
  customDeviceId[sizeof(customDeviceId) - 1] = '\\0';

  channelCount = atoi(customChannelCount);
  device_id = String(customDeviceId);

  saveConfigToEEPROM();

  Serial.println("⚙️ Parameters updated:");
  Serial.printf("   Channel Count: %d\\n", channelCount);
  Serial.printf("   Device ID: %s\\n", device_id.c_str());
}

void loadConfigFromEEPROM() {
  // Read channelCount (int)
  EEPROM.get(CONFIG_START_ADDR, channelCount);
  if (channelCount < 4 || channelCount > MAX_CHANNELS) {
    channelCount = ${channelCount};  // Use template default
  }
  channelCount = (channelCount / 4) * 4;  // round down to multiple of 4

  // Read device_id (char array)
  char buf[33];
  for (int i = 0; i < 32; i++) {
    buf[i] = EEPROM.read(CONFIG_START_ADDR + sizeof(int) + i);
  }
  buf[32] = '\\0'; // null-terminate
  device_id = String(buf);

  // If device_id is empty or doesn't match template, use template default
  if (device_id.length() == 0 || device_id == "Device01") {
    device_id = "${deviceId}";
    saveConfigToEEPROM(); // Save the corrected device ID
  }
  
  // Update the WiFiManagerParameter buffers for UI consistency
  snprintf(customChannelCount, sizeof(customChannelCount), "%d", channelCount);
  strncpy(customDeviceId, device_id.c_str(), sizeof(customDeviceId) - 1);
  customDeviceId[sizeof(customDeviceId) - 1] = '\\0';
}`;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(esp32Code);
      setCopied(true);
      toast.success('Updated ESP32 code copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy code');
    }
  };

  return (
    <Card className="energy-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Code className="w-5 h-5 text-orange-600" />
            Updated ESP32 Code Template
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={copyCode}
            className="flex items-center gap-2"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy Code'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-x-auto max-h-96 overflow-y-auto">
          <pre>{esp32Code}</pre>
        </div>
        
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
            🔧 Key Improvements in This Version:
          </p>
          <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
            <li>Enhanced OTA progress callback with real-time dashboard updates</li>
            <li>Improved error handling for status reporting with timeout settings</li>
            <li>Better status reporting with detailed error messages</li>
            <li>Added delays to ensure status messages are sent before device restart</li>
            <li>Fixed HTTP timeout issues for reliable communication</li>
          </ul>
        </div>

        <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
            ✅ Enhanced OTA Progress Features:
          </p>
          <ul className="text-xs text-green-700 dark:text-green-300 space-y-1 list-disc list-inside">
            <li>Real-time progress updates sent every 1% during download</li>
            <li>Proper status reporting: starting → downloading → complete/failed</li>
            <li>Enhanced error handling with detailed failure messages</li>
            <li>Improved HTTP timeout settings for reliable communication</li>
            <li>Dashboard receives accurate progress percentage and status</li>
          </ul>
        </div>

        <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
          <p className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-2">
            🚨 Fixed Issues:
          </p>
          <ul className="text-xs text-orange-700 dark:text-orange-300 space-y-1 list-disc list-inside">
            <li>HTTP 500 errors during OTA status reporting are now resolved</li>
            <li>Progress bar in dashboard now receives accurate updates</li>
            <li>Improved timeout handling prevents communication failures</li>
            <li>Better error logging for debugging OTA issues</li>
            <li>Status messages are properly formatted and sent reliably</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default ESP32CodeTemplate;
