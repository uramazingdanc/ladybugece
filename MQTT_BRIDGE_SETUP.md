# MQTT Bridge Setup - EMQX Cloud HTTP Webhook Integration

This document describes the **HTTP webhook approach** using **EMQX Cloud** for the MQTT data pipeline.

## ⚠️ IMPORTANT: Using EMQX Cloud (Free Tier with Webhooks)

**EMQX Cloud** offers HTTP webhooks on the **free Serverless tier**, making it the ideal choice for this project.

👉 **Follow the complete setup guide: [EMQX_CLOUD_SETUP.md](./EMQX_CLOUD_SETUP.md)**

## Architecture Overview

```
ESP Devices → EMQX Cloud MQTT Broker → HTTP Webhook → Supabase Edge Function → Database
```

### Why HTTP Webhook Approach?

1. **No Direct MQTT Client Needed**: Supabase Edge Functions run in Deno, which has compatibility issues with many MQTT client libraries
2. **Simpler Architecture**: The MQTT broker (EMQX Cloud) handles the MQTT protocol complexity
3. **HTTP is Universal**: Edge Functions excel at handling HTTP requests
4. **Stateless**: No need to maintain persistent MQTT connections
5. **Reliable**: EMQX's webhook system is production-ready
6. **Free Tier Available**: EMQX Cloud includes webhooks on the free serverless tier

## How It Works

1. **ESP32 Device** publishes MQTT message to topic `LADYBUG/farm_data` on EMQX Cloud
2. **EMQX Data Integration Rule** is configured to forward messages from this topic via HTTP webhook
3. **Supabase Edge Function** (`mqtt-bridge`) receives the HTTP POST request with the MQTT payload
4. **Edge Function** parses the JSON data and calls the `ingest-data` function
5. **`ingest-data` Function** stores the data in the database and triggers alert calculations

## Configuration Steps

### 1. EMQX Cloud Setup

See **[EMQX_CLOUD_SETUP.md](./EMQX_CLOUD_SETUP.md)** for complete instructions on:
- Creating EMQX Cloud serverless deployment (free)
- Setting up authentication credentials
- Configuring Data Integration with HTTP webhook rule
- Testing the webhook connection

### 2. Supabase Edge Function

The `mqtt-bridge` Edge Function is already deployed and configured to:
- Accept HTTP POST requests from EMQX webhooks
- Parse JSON payloads with device data
- Forward to the `ingest-data` function
- Handle errors gracefully with CORS support

**Function URL:**
```
https://hncumnbxaucdvjcnfptq.supabase.co/functions/v1/mqtt-bridge
```

### 3. Expected Payload Format

The ESP device should publish JSON in this format:

```json
{
  "device_id": "ESP_FARM_001",
  "moth_count": 12,
  "temperature_c": 28.5,
  "computed_degree_days": 152.5,
  "computed_status": "yellow_medium_risk"
}
```

**Status Values:**
- `green` or `green_low_risk` → Green alert
- `yellow`, `yellow_medium_risk` → Yellow alert
- `red`, `red_high_risk` → Red alert

## ESP Device Configuration

Update your ESP32 code to connect to EMQX Cloud:

```cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>

// EMQX Cloud Connection Settings
const char* mqtt_server = "xxx.emqxsl.com";  // Your EMQX cluster address
const int mqtt_port = 8883;                   // Secure MQTT port
const char* mqtt_user = "ladybugdevice";      // Your username
const char* mqtt_password = "@Ladybug2025";   // Your password
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
  
  // Set up MQTT
  espClient.setInsecure(); // For testing; use certificates in production
  client.setServer(mqtt_server, mqtt_port);
}

void publishData(String deviceId, int mothCount, float temp, float degreeDays, String status) {
  if (!client.connected()) {
    client.connect("ESP32_Farm_Device", mqtt_user, mqtt_password);
  }
  
  StaticJsonDocument<256> doc;
  doc["device_id"] = deviceId;
  doc["moth_count"] = mothCount;
  doc["temperature_c"] = temp;
  doc["computed_degree_days"] = degreeDays;
  doc["computed_status"] = status;
  
  char jsonBuffer[256];
  serializeJson(doc, jsonBuffer);
  
  client.publish(mqtt_topic, jsonBuffer, false);
  Serial.println("Data published to EMQX Cloud");
}
```

## Testing the Pipeline

### Test from EMQX Web Client

1. Log in to EMQX Cloud Console
2. Go to **Tools** → **Websocket Client**
3. Connect with your credentials
4. Publish test message:
   - **Topic:** `LADYBUG/farm_data`
   - **QoS:** `1`
   - **Payload:**
     ```json
     {
       "device_id": "TEST_EMQX_01",
       "moth_count": 7,
       "temperature_c": 25.1,
       "computed_degree_days": 110.0,
       "computed_status": "yellow"
     }
     ```

### Verify Data Flow

1. **Check Supabase Logs:**
   - Cloud → Edge Functions → mqtt-bridge → Logs
   - Look for: `Processing MQTT message from HiveMQ webhook`

2. **Check Database:**
   - Database → Table Editor → `pest_readings`
   - Verify new row appears with test data

3. **Check Dashboard:**
   - Open LADYBUG dashboard
   - Verify farm status updates

## Monitoring

### EMQX Cloud Monitoring
- Go to **Monitoring** tab in EMQX Console
- View connected clients, message throughput
- Check Data Integration → Rules → Metrics

### Supabase Monitoring
- Edge Functions → mqtt-bridge → Logs
- Edge Functions → ingest-data → Logs
- Database → Table Editor (real-time data)

## Troubleshooting

### Webhook Not Triggering
- Verify Data Integration rule is enabled
- Check rule SQL matches topic: `LADYBUG/farm_data`
- Verify HTTP Server action URL is correct
- Check EMQX rule execution metrics

### Data Not in Database
- Check device exists in `devices` table
- Verify Edge Function logs for errors
- Ensure JSON payload matches expected format
- Check RLS policies allow insertion

### ESP Connection Issues
- Verify EMQX cluster address and port
- Check username/password credentials
- Ensure ESP has internet connectivity
- Test with EMQX WebSocket client first

## Cost & Scalability

**EMQX Cloud Serverless (Free Tier):**
- 1M session minutes/month
- 1GB data transfer/month
- HTTP webhooks included
- No credit card required

**Supabase (Free Tier):**
- 500MB database
- 50,000 API requests/month
- 2GB bandwidth
- Edge Functions included

This is sufficient for testing and small-scale deployments. For production at scale, consider upgrading both services.

## Next Steps

1. ✅ Complete EMQX Cloud setup ([EMQX_CLOUD_SETUP.md](./EMQX_CLOUD_SETUP.md))
2. ✅ Configure ESP32 devices with EMQX credentials
3. ✅ Test with WebSocket client
4. ✅ Monitor data flow in dashboard
5. ✅ Set up email alerts for RED status (optional)

---

**The mqtt-bridge function works with any MQTT broker that supports HTTP webhooks—no code changes needed!**
