# MQTT Integration Guide

## System Architecture

This system uses an edge-computing architecture where ESP devices perform on-board calculations and communicate via MQTT.

```
┌─────────────┐       MQTT        ┌──────────────┐      HTTP      ┌─────────────┐
│ ESP Device  │ ──────────────▶   │  EMQX Cloud  │ ────────────▶  │   Backend   │
│ (Edge CPU)  │  Publish Status   │    Broker    │  Webhook/POST  │  (Supabase) │
└─────────────┘                   └──────────────┘                └─────────────┘
      │
      │ On-board Processing:
      ├─ Read Sensors
      ├─ Calculate Degree-Days
      └─ Determine Alert Level
```

## MQTT Broker: EMQX Cloud

We use **EMQX Cloud Serverless** (free tier) which includes:
- ✅ HTTP webhook integration
- ✅ 1M session minutes/month
- ✅ TLS/SSL encryption (port 8883)
- ✅ Username/password authentication

**Setup Guide:** See [EMQX_CLOUD_SETUP.md](./EMQX_CLOUD_SETUP.md)

## MQTT Topic Structure

**Topic:** `LADYBUG/farm_data`

All devices publish to the same topic. Device identification is done via the `device_id` field in the payload.

## Message Payload Format

The ESP device should publish JSON messages with the following structure:

```json
{
  "device_id": "ESP_FARM_001",
  "moth_count": 45,
  "temperature_c": 28.5,
  "computed_degree_days": 320.0,
  "computed_status": "yellow_medium_risk"
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `device_id` | string | Yes | Unique identifier for the ESP device |
| `moth_count` | integer | Yes | Number of moths detected |
| `temperature_c` | float | Yes | Temperature reading in Celsius |
| `computed_degree_days` | float | No | Calculated degree-days (computed on ESP) |
| `computed_status` | string | No | Pre-computed alert status |

### Status Values

The `computed_status` field maps to alert levels:

- **`green`** or **`green_low_risk`** → Green alert (Safe)
- **`yellow`** or **`yellow_medium_risk`** → Yellow alert (Warning)
- **`red`** or **`red_high_risk`** → Red alert (Danger)

## Alert Level Logic (Edge Computing)

The ESP device calculates alert levels using these thresholds:

- **Green**: moth_count < 15 (Safe)
- **Yellow**: 15 ≤ moth_count < 30 (Warning)
- **Red**: moth_count ≥ 30 (Danger)

## ESP32 Connection Code

### Basic Setup

```cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>

// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// EMQX Cloud credentials
const char* mqtt_server = "xxx.emqxsl.com";  // Your EMQX cluster address
const int mqtt_port = 8883;                   // TLS port
const char* mqtt_user = "ladybugdevice";      // Your EMQX username
const char* mqtt_password = "@Ladybug2025";   // Your EMQX password
const char* mqtt_topic = "LADYBUG/farm_data";

WiFiClientSecure espClient;
PubSubClient client(espClient);

void setup() {
  Serial.begin(115200);
  
  // Connect to WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");
  
  // Configure MQTT
  espClient.setInsecure(); // For testing; use proper certificates in production
  client.setServer(mqtt_server, mqtt_port);
  
  // Connect to MQTT broker
  connectMQTT();
}

void connectMQTT() {
  while (!client.connected()) {
    Serial.print("Connecting to EMQX...");
    
    if (client.connect("ESP32_Farm_Device", mqtt_user, mqtt_password)) {
      Serial.println("connected");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" retrying in 5 seconds");
      delay(5000);
    }
  }
}

void publishData(String deviceId, int mothCount, float temp, float degreeDays, String status) {
  // Ensure connection
  if (!client.connected()) {
    connectMQTT();
  }
  
  // Create JSON payload
  StaticJsonDocument<256> doc;
  doc["device_id"] = deviceId;
  doc["moth_count"] = mothCount;
  doc["temperature_c"] = temp;
  doc["computed_degree_days"] = degreeDays;
  doc["computed_status"] = status;
  
  // Serialize to string
  char jsonBuffer[256];
  serializeJson(doc, jsonBuffer);
  
  // Publish to MQTT
  if (client.publish(mqtt_topic, jsonBuffer, false)) {
    Serial.println("Data published successfully");
  } else {
    Serial.println("Publish failed");
  }
}

void loop() {
  client.loop(); // Maintain MQTT connection
  
  // Your sensor reading logic here
  int mothCount = readMothCount();
  float temperature = readTemperature();
  float degreeDays = calculateDegreeDays(temperature);
  String status = calculateStatus(degreeDays, mothCount);
  
  // Publish data
  publishData("ESP_FARM_001", mothCount, temperature, degreeDays, status);
  
  delay(60000); // Publish every minute
}
```

### Helper Functions

```cpp
// Example: Calculate degree-days
float calculateDegreeDays(float temp) {
  const float baseTemp = 10.0; // Base temperature for codling moth
  float dd = (temp > baseTemp) ? (temp - baseTemp) : 0;
  return dd;
}

// Example: Determine alert status
String calculateStatus(float degreeDays, int mothCount) {
  if (mothCount >= 30) {
    return "red_high_risk";
  } else if (mothCount >= 15) {
    return "yellow_medium_risk";
  } else {
    return "green_low_risk";
  }
}
```

## Data Flow

1. **ESP32 Device** reads sensors (moth trap, temperature)
2. **ESP32** computes degree-days and alert status locally
3. **ESP32** publishes JSON to `LADYBUG/farm_data` topic on EMQX Cloud
4. **EMQX Data Integration** rule forwards message via HTTP webhook
5. **Supabase Edge Function** (`mqtt-bridge`) receives HTTP POST
6. **Edge Function** parses payload and calls `ingest-data`
7. **`ingest-data` Function** stores data and updates alert status
8. **Dashboard** displays real-time farm status

## Backend Endpoints

### 1. MQTT Bridge Endpoint (Used by EMQX Webhook)
**URL:** `https://hncumnbxaucdvjcnfptq.supabase.co/functions/v1/mqtt-bridge`  
**Method:** POST  
**Use:** Receives webhooks from EMQX Cloud Data Integration

### 2. Direct Ingest Endpoint (Alternative)
**URL:** `https://hncumnbxaucdvjcnfptq.supabase.co/functions/v1/ingest-data`  
**Method:** POST  
**Use:** Can be called directly if bypassing MQTT

## Database Schema

The system stores data in these tables:

- **pest_readings**: Stores all sensor readings including degree_days
- **ipm_alerts**: Stores current alert status per farm
- **devices**: Device registry linking devices to farms
- **farms**: Farm information with geolocation

## Testing

### Test with EMQX WebSocket Client

1. Log in to EMQX Cloud Console
2. Go to **Tools** → **Websocket Client**
3. Connect with your credentials
4. Publish test message:
   - **Topic:** `LADYBUG/farm_data`
   - **QoS:** `1`
   - **Payload:**
     ```json
     {
       "device_id": "TEST_ESP_01",
       "moth_count": 25,
       "temperature_c": 28.5,
       "computed_degree_days": 320.0,
       "computed_status": "yellow_medium_risk"
     }
     ```

### Test with mosquitto_pub

```bash
mosquitto_pub -h xxx.emqxsl.com -p 8883 \
  -u ladybugdevice \
  -P '@Ladybug2025' \
  -t 'LADYBUG/farm_data' \
  --cafile /etc/ssl/certs/ca-certificates.crt \
  -m '{"device_id":"TEST_CLI_01","moth_count":25,"temperature_c":28.5,"computed_degree_days":320.0,"computed_status":"yellow"}'
```

### Test with curl (Direct to Backend)

```bash
curl -X POST https://hncumnbxaucdvjcnfptq.supabase.co/functions/v1/mqtt-bridge \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "TEST_CURL_01",
    "moth_count": 25,
    "temperature_c": 28.5,
    "computed_degree_days": 320.0,
    "computed_status": "yellow"
  }'
```

## Security Considerations

✅ **Production-Ready Security:**

1. **TLS/SSL Encryption**: EMQX Cloud uses encrypted connections (port 8883)
2. **Authentication**: Username/password credentials required
3. **Webhook Security**: HTTPS webhook to Supabase
4. **Row Level Security**: Supabase RLS policies protect data
5. **Secure Secrets**: Credentials stored in Supabase Secrets

### Production Recommendations:

- Use device certificates instead of username/password (EMQX supports X.509)
- Rotate credentials regularly
- Monitor EMQX access logs for unusual activity
- Enable IP whitelisting if devices have static IPs

## Edge Computing Benefits

- **Reduced Latency**: Alert decisions made instantly on-device
- **Lower Bandwidth**: Only computed status sent, not raw data
- **Offline Capability**: Device can operate independently
- **Scalability**: Backend only stores results, not processing
- **Reliability**: Device continues working even if network is down temporarily

## Troubleshooting

### ESP32 Can't Connect to EMQX
- ✅ Verify cluster address: `xxx.emqxsl.com`
- ✅ Use port `8883` for TLS
- ✅ Check username/password credentials
- ✅ Ensure WiFi is connected
- ✅ Check EMQX authentication settings

### Data Not Reaching Database
- ✅ Verify webhook is configured in EMQX Data Integration
- ✅ Check Edge Function logs in Supabase
- ✅ Ensure device exists in `devices` table
- ✅ Check JSON payload format matches expected schema

### Connection Keeps Dropping
- ✅ Increase keep-alive interval in MQTT client
- ✅ Check WiFi signal strength
- ✅ Monitor EMQX connection metrics
- ✅ Implement reconnection logic in ESP code

## Next Steps

1. ✅ Set up EMQX Cloud deployment ([EMQX_CLOUD_SETUP.md](./EMQX_CLOUD_SETUP.md))
2. ✅ Configure Data Integration webhook
3. ✅ Upload code to ESP32 devices
4. ✅ Register devices in dashboard
5. ✅ Monitor real-time data flow
6. ✅ Set up email alerts for RED status

---

**For complete setup instructions, see [EMQX_CLOUD_SETUP.md](./EMQX_CLOUD_SETUP.md)**
