# MQTT Bridge Setup Guide

This guide explains how to connect your ESP devices using freemqtt.com to the LADYBUG Supabase backend.

## Architecture Overview

```
ESP Device → freemqtt.com (MQTT Broker) → Bridge Service → Supabase Edge Function → Database
```

## Option 1: Using Make.com (Recommended - No Code Required)

Make.com (formerly Integromat) provides a visual automation platform that can subscribe to MQTT and forward to HTTP endpoints.

### Steps:

1. **Create a Make.com Account**
   - Go to https://make.com
   - Sign up for a free account

2. **Create a New Scenario**
   - Click "Create a new scenario"
   - Add an MQTT module as the trigger

3. **Configure MQTT Connection**
   - **Broker**: `freemqtt.hivemq.cloud`
   - **Port**: `1883`
   - **Topic**: `LADYBUG/farm_data`
   - **Client ID**: `make_bridge_001` (or any unique ID)
   - Leave username/password empty (public broker)

4. **Add HTTP Module**
   - Add "HTTP > Make a request" module
   - **URL**: `https://hncumnbxaucdvjcnfptq.supabase.co/functions/v1/mqtt-bridge`
   - **Method**: POST
   - **Headers**: 
     - `Content-Type`: `application/json`
     - `apikey`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhuY3VtbmJ4YXVjZHZqY25mcHRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5ODQwMDUsImV4cCI6MjA3ODU2MDAwNX0.bX9y8k0Jn_9g6GYs4d5supHdx_yntqrj0kAcvJ_Rdk8`
   - **Body**: Map the MQTT message payload directly

5. **Test and Activate**
   - Test with a sample MQTT message
   - Turn on the scenario

**Cost**: Free tier includes 1,000 operations/month

---

## Option 2: Using Pipedream (Alternative No-Code)

Similar to Make.com but with different pricing structure.

### Steps:

1. Go to https://pipedream.com
2. Create new workflow
3. Select "MQTT" as trigger
4. Configure freemqtt.com connection
5. Add HTTP request step to your Supabase function
6. Deploy workflow

**Cost**: Free tier includes 10,000 invocations/month

---

## Option 3: Custom Node.js Bridge (Self-Hosted)

For full control, you can run your own bridge service.

### Installation:

```bash
npm install mqtt node-fetch
```

### Code (`mqtt-bridge.js`):

```javascript
const mqtt = require('mqtt');
const fetch = require('node-fetch');

const MQTT_BROKER = 'mqtt://freemqtt.hivemq.cloud:1883';
const MQTT_TOPIC = 'LADYBUG/farm_data';
const SUPABASE_URL = 'https://hncumnbxaucdvjcnfptq.supabase.co/functions/v1/mqtt-bridge';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhuY3VtbmJ4YXVjZHZqY25mcHRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5ODQwMDUsImV4cCI6MjA3ODU2MDAwNX0.bX9y8k0Jn_9g6GYs4d5supHdx_yntqrj0kAcvJ_Rdk8';

const client = mqtt.connect(MQTT_BROKER, {
  clientId: 'ladybug_bridge_' + Math.random().toString(16).substr(2, 8)
});

client.on('connect', () => {
  console.log('Connected to MQTT broker');
  client.subscribe(MQTT_TOPIC, (err) => {
    if (err) {
      console.error('Subscription error:', err);
    } else {
      console.log(`Subscribed to ${MQTT_TOPIC}`);
    }
  });
});

client.on('message', async (topic, message) => {
  console.log(`Received message on ${topic}:`, message.toString());
  
  try {
    const payload = JSON.parse(message.toString());
    
    const response = await fetch(SUPABASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    console.log('Forwarded to Supabase:', result);
  } catch (error) {
    console.error('Error processing message:', error);
  }
});

client.on('error', (error) => {
  console.error('MQTT Error:', error);
});

console.log('MQTT Bridge Service Started');
```

### Running the Bridge:

```bash
node mqtt-bridge.js
```

### Deployment Options:
- **Railway.app**: Free tier with simple deployment
- **Render.com**: Free tier for background workers
- **Heroku**: Paid plans available
- **VPS**: Run on any Linux server (DigitalOcean, Linode, etc.)

---

## Option 4: Direct HTTP (Simplest - Modify ESP Code)

If you can modify your ESP device code, skip MQTT entirely and POST directly to the edge function.

### ESP32 Arduino Code:

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* serverUrl = "https://hncumnbxaucdvjcnfptq.supabase.co/functions/v1/mqtt-bridge";
const char* apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhuY3VtbmJ4YXVjZHZqY25mcHRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5ODQwMDUsImV4cCI6MjA3ODU2MDAwNX0.bX9y8k0Jn_9g6GYs4d5supHdx_yntqrj0kAcvJ_Rdk8";

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("WiFi connected");
}

void sendData(String deviceId, int mothCount, float temp, float degreeDays, String status) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("apikey", apiKey);

    StaticJsonDocument<256> doc;
    doc["device_id"] = deviceId;
    doc["moth_count"] = mothCount;
    doc["temperature_c"] = temp;
    doc["computed_degree_days"] = degreeDays;
    doc["computed_status"] = status;

    String payload;
    serializeJson(doc, payload);

    int httpCode = http.POST(payload);
    
    if (httpCode > 0) {
      String response = http.getString();
      Serial.println("Response: " + response);
    } else {
      Serial.println("Error: " + String(httpCode));
    }
    
    http.end();
  }
}

void loop() {
  // Your sensor reading logic here
  int mothCount = readMothCount();
  float temperature = readTemperature();
  float degreeDays = calculateDegreeDays(temperature);
  String status = calculateStatus(degreeDays, mothCount);
  
  sendData("ESP_FARM_001", mothCount, temperature, degreeDays, status);
  
  delay(60000); // Send every minute
}
```

---

## ESP Device Message Format

Your ESP device should publish JSON messages in this format:

```json
{
  "device_id": "ESP_FARM_001",
  "moth_count": 15,
  "temperature_c": 28.5,
  "computed_degree_days": 152.5,
  "computed_status": "yellow_medium_risk"
}
```

### Status Values:
- `"green"` - Safe, low risk
- `"yellow"` - Low-medium risk
- `"yellow_medium_risk"` - Medium risk
- `"red"` - High risk, immediate action required

---

## Testing the Bridge

1. **Using the Device Test Page**: Navigate to `/device-test` in your app
2. **Using MQTT Explorer**: Download MQTT Explorer and publish test messages
3. **Using mosquitto_pub**:
```bash
mosquitto_pub -h freemqtt.hivemq.cloud -p 1883 \
  -t "LADYBUG/farm_data" \
  -m '{"device_id":"ESP_TEST_001","moth_count":15,"temperature_c":28,"computed_degree_days":150,"computed_status":"yellow"}'
```

---

## Email Alert Configuration

To enable automatic email alerts for RED status:

1. Create a Resend account: https://resend.com
2. Verify your domain: https://resend.com/domains
3. Get your API key: https://resend.com/api-keys
4. Add the secret in Lovable Cloud:
   - Go to Cloud → Secrets
   - Add `RESEND_API_KEY` with your key
5. Update the recipient email in `send-alert-email` function

---

## Monitoring

- **Edge Function Logs**: Check Cloud → Edge Functions → Logs
- **Database**: View real-time data in Cloud → Database → Tables
- **Dashboard**: Monitor live status at `/` (dashboard)

---

## Troubleshooting

### MQTT Connection Issues:
- Check broker URL: `freemqtt.hivemq.cloud`
- Verify port: `1883` for plain MQTT, `8883` for TLS
- Ensure topic matches: `LADYBUG/farm_data`

### Edge Function Errors:
- Check device exists in database
- Verify JSON format matches expected schema
- Review edge function logs for specific errors

### Data Not Appearing:
- Verify device is registered in Devices tab
- Check farm exists and is linked to device
- Ensure alert level mapping is correct

---

## Production Recommendations

1. **Use Option 4 (Direct HTTP)** - Simplest and most reliable
2. **Secure your API**: Use Supabase Row Level Security
3. **Monitor costs**: Track Supabase and email service usage
4. **Regular backups**: Export database regularly
5. **Update device firmware**: Keep ESP code up to date

---

## Support

For issues or questions:
- Check LADYBUG dashboard logs
- Review Supabase edge function logs
- Test using the `/device-test` page
- Consult MQTT_INTEGRATION.md for detailed protocol info
