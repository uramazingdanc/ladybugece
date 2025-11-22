# HiveMQ Cloud HTTP Extension Setup Guide

This guide explains how to configure HiveMQ Cloud to send MQTT messages directly to your Supabase Edge Function via HTTP webhooks, eliminating the need for Make.com or maintaining an MQTT client connection.

## Architecture Overview

```
ESP Devices → HiveMQ Cloud (MQTT) → HTTP Extension → Supabase mqtt-bridge → Supabase DB
```

**Benefits:**
- ✅ No external automation tools needed (no Make.com subscription)
- ✅ More reliable than maintaining persistent MQTT connections
- ✅ Native HiveMQ Cloud feature (built-in, no extra cost)
- ✅ Automatic retries and error handling
- ✅ Simpler Edge Function code (HTTP handler instead of MQTT client)

## Step 1: Get Your Supabase Edge Function URL

Your mqtt-bridge function URL is:
```
https://hncumnbxaucdvjcnfptq.supabase.co/functions/v1/mqtt-bridge
```

You'll also need your Supabase anon key for authentication (optional but recommended).

## Step 2: Configure HiveMQ Cloud HTTP Extension

1. **Log in to HiveMQ Cloud Console**
   - Go to https://console.hivemq.cloud/
   - Select your cluster (`navyorchid`)

2. **Navigate to Integrations/Extensions**
   - Click on **Data Hub** or **Extensions** (depending on your cluster type)
   - Look for **HTTP Extension** or **HTTP Integration**

3. **Create New HTTP Extension**
   
   **Basic Settings:**
   - **Name:** `Supabase MQTT Bridge`
   - **Enabled:** ✅ Yes
   
   **HTTP Endpoint Configuration:**
   - **URL:** `https://hncumnbxaucdvjcnfptq.supabase.co/functions/v1/mqtt-bridge`
   - **Method:** `POST`
   - **Headers:**
     ```
     Content-Type: application/json
     apikey: YOUR_SUPABASE_ANON_KEY
     ```
   
   **MQTT Trigger:**
   - **Topic Filter:** `LADYBUG/farm_data`
   - **QoS:** `1` (At least once)
   
   **Payload Transformation:**
   - **Type:** `Forward as-is` or `JSON`
   - The MQTT message payload will be sent directly as the HTTP POST body

4. **Save and Enable**
   - Save the configuration
   - Enable the extension
   - HiveMQ will now forward all messages on `LADYBUG/farm_data` to your Edge Function

## Step 3: Test the Integration

### Option A: Test from HiveMQ Web Client

1. Go to **Web Client** tab in HiveMQ Cloud Console
2. Connect using your credentials
3. Publish a test message:
   - **Topic:** `LADYBUG/farm_data`
   - **Payload:**
     ```json
     {
       "device_id": "TEST_WEB_CLIENT_01",
       "moth_count": 7,
       "temperature_c": 25.1,
       "computed_degree_days": 110.0,
       "computed_status": "yellow"
     }
     ```
   - **QoS:** `1`
4. Click **Send Message**

### Option B: Test from Command Line

```bash
mosquitto_pub -h YOUR_HIVEMQ_HOST.hivemq.cloud \
  -p 8883 \
  -u ladybuggroup \
  -P '@Ladybug2025' \
  -t 'LADYBUG/farm_data' \
  -m '{"device_id":"TEST_CLI_01","moth_count":5,"temperature_c":24.5,"computed_degree_days":105.0,"computed_status":"green"}' \
  --cafile /etc/ssl/certs/ca-certificates.crt
```

## Step 4: Verify Data in Supabase

1. **Check Edge Function Logs:**
   - Go to Supabase Dashboard → Edge Functions → mqtt-bridge → Logs
   - Look for: `Processing MQTT message from HiveMQ webhook`

2. **Check Database:**
   - Go to Database → Table Editor → `pest_readings`
   - Verify new row with your test data appears

3. **Check Frontend:**
   - Open your LADYBUG dashboard
   - Verify the farm status updates with the new alert level

## ESP Device Configuration

Your ESP devices should publish to HiveMQ Cloud exactly as before:

```cpp
// ESP32 Arduino Code
#include <WiFi.h>
#include <PubSubClient.h>

const char* mqtt_server = "YOUR_CLUSTER.hivemq.cloud";
const int mqtt_port = 8883;
const char* mqtt_user = "ladybuggroup";
const char* mqtt_pass = "@Ladybug2025";

WiFiClientSecure espClient;
PubSubClient client(espClient);

void publishData() {
  StaticJsonDocument<256> doc;
  doc["device_id"] = "ESP_FARM_001";
  doc["moth_count"] = 12;
  doc["temperature_c"] = 28.5;
  doc["computed_degree_days"] = 152.5;
  doc["computed_status"] = "yellow";
  
  char jsonBuffer[256];
  serializeJson(doc, jsonBuffer);
  
  client.publish("LADYBUG/farm_data", jsonBuffer, false);
}
```

**No changes needed to your ESP code!** The devices continue publishing to MQTT as before. HiveMQ Cloud automatically forwards the messages to Supabase via HTTP.

## Monitoring and Troubleshooting

### Check HiveMQ Extension Status

1. Go to HiveMQ Cloud Console → Extensions
2. Check the HTTP Extension status
3. View delivery statistics and errors

### Common Issues

**Issue:** Messages not reaching Supabase
- ✅ Verify HTTP Extension is enabled
- ✅ Check extension logs in HiveMQ console
- ✅ Verify the Supabase URL is correct
- ✅ Check Edge Function logs for errors

**Issue:** Authentication errors
- ✅ Verify the `apikey` header is set correctly
- ✅ Make sure the Edge Function has `verify_jwt = false` in config.toml

**Issue:** Data not appearing in database
- ✅ Check Edge Function logs for processing errors
- ✅ Verify the `device_id` exists in the `devices` table
- ✅ Check RLS policies allow insertion

### View Logs

**Supabase Edge Function Logs:**
```bash
# In Lovable Dashboard, go to:
Cloud → Edge Functions → mqtt-bridge → Logs
```

**HiveMQ Extension Logs:**
```bash
# In HiveMQ Cloud Console, go to:
Extensions → HTTP Extension → Activity/Logs
```

## Security Best Practices

1. **Use HTTPS:** ✅ Already configured (supabase.co uses HTTPS)
2. **Authentication:** Consider adding API key validation in the Edge Function
3. **Rate Limiting:** HiveMQ Cloud has built-in rate limiting
4. **Payload Validation:** The Edge Function validates all incoming data
5. **Database Security:** RLS policies protect data access

## Cost Comparison

| Solution | Monthly Cost | Complexity |
|----------|-------------|------------|
| **HiveMQ HTTP Extension** | $0 (Free tier) | Low |
| Make.com | $9+ (requires paid plan) | Medium |
| Custom MQTT Client | $0 | High (maintenance) |

**✅ Recommended: HiveMQ HTTP Extension** - Most reliable and cost-effective solution.

## Next Steps

1. ✅ Configure HTTP Extension in HiveMQ Cloud
2. ✅ Test with Web Client
3. ✅ Verify data appears in Supabase
4. ✅ Update ESP devices if needed
5. ✅ Monitor logs for any issues
6. ✅ Set up email alerts for RED status

Your LADYBUG system is now fully operational with a robust, serverless MQTT-to-database pipeline!
