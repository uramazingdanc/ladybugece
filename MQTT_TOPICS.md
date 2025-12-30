# MQTT Topic Structure

This document describes the MQTT topic structure used by the LADYBUG system.

## Topics

### Status Topic
**Topic:** `ladybug/trap{n}/status`  
**Format:** `moth_count,temperature,larva_density,status`

**Fields:**
- `moth_count` - Number of moths detected
- `temperature` - Temperature in °C
- `larva_density` - Predicted/estimated larva density
- `status` - Alert status code (1-3)

**Status Legend:**
- `1` - Safe (Green)
- `2` - Moderate (Yellow)
- `3` - High Risk (Red)

**Example:** `10,34.5,100,2` (10 moths, 34.5°C, larva density 100, Moderate)

### Location Topic
**Topic:** `ladybug/trap{n}/location`  
**Format:** `latitude,longitude`

**Example:** `15.51848755,121.2739912`

## Device Mapping

| Trap ID | Device ID | Latitude | Longitude |
|---------|-----------|----------|-----------|
| Trap 011 | trap011 | 15.51848755 | 121.2739912 |
| Trap 012 | trap012 | 15.526633 | 121.276333 |
| Trap 013 | trap013 | 15.526976 | 121.278758 |
| Trap 014 | trap014 | 15.526212 | 121.271809 |
| Trap 015 | trap015 | 15.547348 | 121.255534 |
| Trap 016 | trap016 | 15.547594 | 121.258341 |
| Trap 017 | trap017 | 15.548236 | 121.260953 |
| Trap 018 | trap018 | 15.549381 | 121.264945 |
| Trap 019 | trap019 | 15.55541 | 121.253535 |
| Trap 020 | trap020 | 15.552646 | 121.254953 |

## Architecture

```
ESP Device → MQTT Broker (EMQX) → Webhook → Supabase Edge Function → WebSocket → Browser
```

### Backend Endpoint

**Edge Function:** `mqtt-websocket`

This function serves two purposes:
1. **HTTP POST** - Receives MQTT webhook data from EMQX Cloud
2. **WebSocket** - Provides real-time connection to browser clients

### EMQX Webhook Configuration

Configure EMQX Cloud to forward messages to:
```
POST https://hncumnbxaucdvjcnfptq.functions.supabase.co/functions/v1/mqtt-websocket
```

**Headers:**
- `Content-Type: application/json`
- `apikey: <SUPABASE_ANON_KEY>`

**Payload Template:**
```json
{
  "topic": "${topic}",
  "payload": "${payload}"
}
```

## Testing

### Via cURL (HTTP)
```bash
# Send status data
curl -X POST "https://hncumnbxaucdvjcnfptq.functions.supabase.co/functions/v1/mqtt-websocket" \
  -H "Content-Type: application/json" \
  -H "apikey: YOUR_ANON_KEY" \
  -d '{"topic": "ladybug/trap011/status", "payload": "5,28,1"}'

# Send location data
curl -X POST "https://hncumnbxaucdvjcnfptq.functions.supabase.co/functions/v1/mqtt-websocket" \
  -H "Content-Type: application/json" \
  -H "apikey: YOUR_ANON_KEY" \
  -d '{"topic": "ladybug/trap011/location", "payload": "15.51848755,121.2739912"}'
```

### Via MQTT (EMQX Cloud)
```bash
# Using mosquitto_pub
mosquitto_pub -h YOUR_EMQX_HOST -p 8883 \
  -u YOUR_USERNAME -P YOUR_PASSWORD \
  -t "ladybug/trap011/status" -m "5,28,1" \
  --cafile /etc/ssl/certs/ca-certificates.crt
```

## ESP32 Example Code

```cpp
#include <WiFi.h>
#include <PubSubClient.h>

const char* mqtt_server = "YOUR_EMQX_HOST";
const int mqtt_port = 8883;
const char* mqtt_user = "YOUR_USERNAME";
const char* mqtt_pass = "YOUR_PASSWORD";
const char* trap_id = "trap011";

WiFiClientSecure espClient;
PubSubClient client(espClient);

void publishStatus(int mothCount, float temperature, int status) {
  char topic[50];
  char payload[50];
  
  snprintf(topic, sizeof(topic), "ladybug/%s/status", trap_id);
  snprintf(payload, sizeof(payload), "%d,%.1f,%d", mothCount, temperature, status);
  
  client.publish(topic, payload);
}

void publishLocation(float lat, float lng) {
  char topic[50];
  char payload[50];
  
  snprintf(topic, sizeof(topic), "ladybug/%s/location", trap_id);
  snprintf(payload, sizeof(payload), "%.6f,%.6f", lat, lng);
  
  client.publish(topic, payload);
}
```
