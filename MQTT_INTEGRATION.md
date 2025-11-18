# MQTT Integration Guide

## System Architecture

This system uses an edge-computing architecture where ESP devices perform on-board calculations and communicate via MQTT.

```
┌─────────────┐       MQTT        ┌──────────────┐      HTTP      ┌─────────────┐
│ ESP Device  │ ──────────────▶   │  freemqtt.com│ ────────────▶  │   Backend   │
│ (Edge CPU)  │  Publish Status   │    Broker    │  Bridge/POST   │  (Supabase) │
└─────────────┘                   └──────────────┘                └─────────────┘
      │
      │ On-board Processing:
      ├─ Read Sensors
      ├─ Calculate Degree-Days
      └─ Determine Alert Level
```

## MQTT Topic Structure

**Topic Format:** `ladybug/{device_id}/status`

Example: `ladybug/ESP_001/status`

## Message Payload Format

The ESP device should publish JSON messages with the following structure:

```json
{
  "device_id": "ESP_001",
  "moth_count": 45,
  "temperature": 28.5,
  "degree_days": 320,
  "alert_level": "Yellow",
  "timestamp": "2025-01-18T10:30:00Z"
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `device_id` | string | Yes | Unique identifier for the ESP device |
| `moth_count` | integer | Yes | Number of moths detected |
| `temperature` | float | Yes | Temperature reading in Celsius |
| `degree_days` | float | No | Calculated degree-days (computed on ESP) |
| `alert_level` | string | No | Pre-computed alert status: "Green", "Yellow", or "Red" |
| `timestamp` | string | No | ISO 8601 timestamp of measurement |

## Alert Level Logic (Edge Computing)

The ESP device calculates alert levels using these thresholds:

- **Green**: moth_count < 15 (Safe)
- **Yellow**: 15 ≤ moth_count < 30 (Warning)
- **Red**: moth_count ≥ 30 (Danger)

## Integration Options

### Option 1: Direct HTTP POST (Recommended for ESP devices)

The ESP device can publish to MQTT and also POST directly to the backend:

```cpp
// ESP32 Arduino Example
#include <WiFi.h>
#include <HTTPClient.h>
#include <PubSubClient.h>

const char* mqtt_server = "freemqtt.com";
const char* webhook_url = "https://hncumnbxaucdvjcnfptq.supabase.co/functions/v1/ingest-data";

void publishData() {
  // Compute alert level on-device
  String alertLevel = moth_count < 15 ? "Green" : (moth_count < 30 ? "Yellow" : "Red");
  
  // Create JSON payload
  String payload = "{\"device_id\":\"" + device_id + "\","
                   "\"moth_count\":" + String(moth_count) + ","
                   "\"temperature\":" + String(temperature) + ","
                   "\"degree_days\":" + String(degree_days) + ","
                   "\"alert_level\":\"" + alertLevel + "\"}";
  
  // Publish to MQTT (for monitoring)
  client.publish(("ladybug/" + device_id + "/status").c_str(), payload.c_str());
  
  // POST to backend (for storage)
  HTTPClient http;
  http.begin(webhook_url);
  http.addHeader("Content-Type", "application/json");
  http.POST(payload);
  http.end();
}
```

### Option 2: MQTT Bridge Service

Set up a bridge service that subscribes to MQTT and forwards to the webhook:

```javascript
// Node.js MQTT Bridge Example
const mqtt = require('mqtt');
const axios = require('axios');

const client = mqtt.connect('mqtt://freemqtt.com');
const WEBHOOK_URL = 'https://hncumnbxaucdvjcnfptq.supabase.co/functions/v1/mqtt-bridge';

client.on('connect', () => {
  console.log('Connected to MQTT broker');
  client.subscribe('ladybug/+/status', (err) => {
    if (err) console.error('Subscription error:', err);
  });
});

client.on('message', async (topic, message) => {
  try {
    const payload = JSON.parse(message.toString());
    console.log('Received MQTT message:', payload);
    
    // Forward to backend webhook
    await axios.post(WEBHOOK_URL, payload, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('Data forwarded to backend');
  } catch (error) {
    console.error('Error processing message:', error);
  }
});
```

## Backend Endpoints

### 1. Direct Ingest Endpoint
**URL:** `https://hncumnbxaucdvjcnfptq.supabase.co/functions/v1/ingest-data`  
**Method:** POST  
**Use:** Direct data ingestion with edge-computed values

### 2. MQTT Bridge Endpoint
**URL:** `https://hncumnbxaucdvjcnfptq.supabase.co/functions/v1/mqtt-bridge`  
**Method:** POST  
**Use:** Webhook for MQTT bridge service

## Database Schema

The system stores data in these tables:

- **pest_readings**: Stores all sensor readings including degree_days
- **ipm_alerts**: Stores current alert status per farm
- **devices**: Device registry linking devices to farms

## Testing

### Test with curl:

```bash
curl -X POST https://hncumnbxaucdvjcnfptq.supabase.co/functions/v1/ingest-data \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "ESP_001",
    "moth_count": 25,
    "temperature": 28.5,
    "degree_days": 320,
    "alert_level": "Yellow"
  }'
```

### Test MQTT with mosquitto:

```bash
mosquitto_pub -h freemqtt.com -t "ladybug/ESP_001/status" \
  -m '{"device_id":"ESP_001","moth_count":25,"temperature":28.5,"degree_days":320,"alert_level":"Yellow"}'
```

## Security Considerations

⚠️ **Note:** freemqtt.com is a public broker without authentication. For production:

1. Consider using a private MQTT broker with TLS/SSL
2. Implement device authentication (username/password or certificates)
3. Use encrypted connections
4. Validate webhook requests with API keys or tokens

## Edge Computing Benefits

- **Reduced Latency**: Alert decisions made instantly on-device
- **Lower Bandwidth**: Only computed status sent, not raw data
- **Offline Capability**: Device can operate independently
- **Scalability**: Backend only stores results, not processing
