# Mosquitto Bridge Setup for SIM800 GSM Module

This guide explains how to connect SIM800 GSM modules to the LADYBUG system using `test.mosquitto.org` as an intermediary broker.

## Why This Approach?

The SIM800 GSM module does not support TLS encryption, which is required by modern MQTT cloud services like EMQX Cloud and HiveMQ Cloud. This bridge solution allows the SIM800 to connect to a public broker that supports plain TCP connections.

## Architecture

```
SIM800 GSM Module
       ↓
       ↓ (Plain TCP, Port 1883)
       ↓
test.mosquitto.org
       ↓
       ↓ (MQTT Subscribe)
       ↓
Python Bridge Script (runs on PC/Raspberry Pi/VPS)
       ↓
       ↓ (HTTPS POST)
       ↓
Supabase Edge Function (mqtt-bridge)
       ↓
       ↓
Database (pest_readings, ipm_alerts)
```

## Component Details

### 1. Public MQTT Broker

- **Broker**: `test.mosquitto.org`
- **Port**: 1883 (plain TCP, no TLS)
- **Authentication**: None required (public broker)
- **Note**: This is for development/testing. For production, consider self-hosted Mosquitto.

### 2. Topic Format

| Topic Pattern | Description | Payload Format |
|---------------|-------------|----------------|
| `ladybug/{device_id}/status` | Sensor readings | `moth_count,temperature,status_code` |
| `ladybug/{device_id}/location` | GPS coordinates | `latitude,longitude` |

**Status Codes:**
- `1` = Green (Safe)
- `2` = Yellow (Moderate)
- `3` = Red (High Risk)

**Examples:**
```
Topic: ladybug/trap1/status
Payload: 5,28.5,1

Topic: ladybug/trap1/location
Payload: 14.5995,120.9842
```

## Setup Instructions

### Step 1: Create the Python Bridge Script

Create a file called `mosquitto_bridge.py`:

```python
#!/usr/bin/env python3
"""
Mosquitto Bridge for LADYBUG System
Forwards MQTT messages from test.mosquitto.org to Supabase Edge Function
"""

import paho.mqtt.client as mqtt
import requests
import json
import time
from datetime import datetime

# =============================================================================
# CONFIGURATION - Update these values!
# =============================================================================

# Mosquitto broker settings (no changes needed for test.mosquitto.org)
MOSQUITTO_BROKER = "test.mosquitto.org"
MOSQUITTO_PORT = 1883

# Supabase Edge Function URL
SUPABASE_FUNCTION_URL = "https://hncumnbxaucdvjcnfptq.supabase.co/functions/v1/mqtt-bridge"

# Supabase Anonymous Key (safe to include, it's a public key)
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhuY3VtbmJ4YXVjZHZqY25mcHRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5ODQwMDUsImV4cCI6MjA3ODU2MDAwNX0.bX9y8k0Jn_9g6GYs4d5supHdx_yntqrj0kAcvJ_Rdk8"

# MQTT Topics to subscribe (+ is wildcard for device_id)
TOPICS = [
    ("ladybug/+/status", 0),
    ("ladybug/+/location", 0)
]

# =============================================================================
# MQTT CALLBACKS
# =============================================================================

def on_connect(client, userdata, flags, rc):
    """Called when connected to MQTT broker"""
    if rc == 0:
        print(f"[{datetime.now()}] ✓ Connected to {MOSQUITTO_BROKER}:{MOSQUITTO_PORT}")
        # Subscribe to all topics
        for topic, qos in TOPICS:
            client.subscribe(topic, qos)
            print(f"[{datetime.now()}] ✓ Subscribed to: {topic}")
    else:
        print(f"[{datetime.now()}] ✗ Connection failed with code {rc}")

def on_disconnect(client, userdata, rc):
    """Called when disconnected from MQTT broker"""
    print(f"[{datetime.now()}] ⚠ Disconnected from broker (code {rc})")
    if rc != 0:
        print(f"[{datetime.now()}] Attempting to reconnect...")

def on_message(client, userdata, msg):
    """Called when a message is received"""
    topic = msg.topic
    payload = msg.payload.decode('utf-8')
    
    print(f"\n[{datetime.now()}] 📩 Received MQTT Message")
    print(f"  Topic: {topic}")
    print(f"  Payload: {payload}")
    
    # Forward to Supabase
    forward_to_supabase(topic, payload)

def forward_to_supabase(topic: str, payload: str):
    """Forward MQTT message to Supabase Edge Function"""
    try:
        data = {
            "topic": topic,
            "payload": payload
        }
        
        headers = {
            "Content-Type": "application/json",
            "apikey": SUPABASE_ANON_KEY
        }
        
        print(f"[{datetime.now()}] → Forwarding to Supabase...")
        
        response = requests.post(
            SUPABASE_FUNCTION_URL,
            json=data,
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"[{datetime.now()}] ✓ Supabase response: {result}")
        else:
            print(f"[{datetime.now()}] ✗ Supabase error: {response.status_code} - {response.text}")
            
    except requests.exceptions.Timeout:
        print(f"[{datetime.now()}] ✗ Request timeout")
    except requests.exceptions.RequestException as e:
        print(f"[{datetime.now()}] ✗ Request error: {e}")
    except Exception as e:
        print(f"[{datetime.now()}] ✗ Unexpected error: {e}")

# =============================================================================
# MAIN
# =============================================================================

def main():
    print("=" * 60)
    print("LADYBUG Mosquitto Bridge")
    print("=" * 60)
    print(f"Broker: {MOSQUITTO_BROKER}:{MOSQUITTO_PORT}")
    print(f"Supabase URL: {SUPABASE_FUNCTION_URL}")
    print("=" * 60)
    
    # Create MQTT client
    client = mqtt.Client(client_id="ladybug-bridge")
    
    # Set callbacks
    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    client.on_message = on_message
    
    # Connect to broker
    print(f"\n[{datetime.now()}] Connecting to {MOSQUITTO_BROKER}...")
    
    try:
        client.connect(MOSQUITTO_BROKER, MOSQUITTO_PORT, keepalive=60)
        
        # Start the loop
        print(f"[{datetime.now()}] Starting MQTT loop (Ctrl+C to stop)...")
        client.loop_forever()
        
    except KeyboardInterrupt:
        print(f"\n[{datetime.now()}] Shutting down...")
        client.disconnect()
    except Exception as e:
        print(f"[{datetime.now()}] ✗ Error: {e}")

if __name__ == "__main__":
    main()
```

### Step 2: Install Python Dependencies

```bash
pip install paho-mqtt requests
```

### Step 3: Run the Bridge Script

```bash
python mosquitto_bridge.py
```

You should see:
```
============================================================
LADYBUG Mosquitto Bridge
============================================================
Broker: test.mosquitto.org:1883
Supabase URL: https://hncumnbxaucdvjcnfptq.supabase.co/functions/v1/mqtt-bridge
============================================================

[2024-01-15 10:30:00] Connecting to test.mosquitto.org...
[2024-01-15 10:30:01] ✓ Connected to test.mosquitto.org:1883
[2024-01-15 10:30:01] ✓ Subscribed to: ladybug/+/status
[2024-01-15 10:30:01] ✓ Subscribed to: ladybug/+/location
[2024-01-15 10:30:01] Starting MQTT loop (Ctrl+C to stop)...
```

## SIM800 Arduino/ESP Configuration

### Connection Settings

```cpp
// SIM800 MQTT Configuration
#define MQTT_BROKER     "test.mosquitto.org"
#define MQTT_PORT       1883
#define MQTT_CLIENT_ID  "trap1"  // Unique per device!

// Topics (replace "trap1" with your device ID)
#define TOPIC_STATUS    "ladybug/trap1/status"
#define TOPIC_LOCATION  "ladybug/trap1/location"
```

### Example Publishing Code

```cpp
#include <SoftwareSerial.h>

// SIM800 pins
SoftwareSerial sim800(7, 8);  // RX, TX

// Sensor data
int mothCount = 0;
float temperature = 0.0;
int statusCode = 1;  // 1=Green, 2=Yellow, 3=Red

void setup() {
    Serial.begin(9600);
    sim800.begin(9600);
    
    // Initialize SIM800 and connect to MQTT
    initSIM800();
    connectMQTT();
}

void loop() {
    // Read sensors
    readSensors();
    
    // Publish data every 5 minutes
    publishStatus();
    
    delay(300000);  // 5 minutes
}

void publishStatus() {
    // Format: moth_count,temperature,status_code
    char payload[50];
    sprintf(payload, "%d,%.1f,%d", mothCount, temperature, statusCode);
    
    // Send MQTT publish command
    char cmd[200];
    sprintf(cmd, "AT+MQTTPUB=\"%s\",\"%s\",0,0", TOPIC_STATUS, payload);
    sendCommand(cmd);
    
    Serial.print("Published: ");
    Serial.println(payload);
}

void publishLocation(float lat, float lng) {
    // Format: latitude,longitude
    char payload[50];
    sprintf(payload, "%.6f,%.6f", lat, lng);
    
    char cmd[200];
    sprintf(cmd, "AT+MQTTPUB=\"%s\",\"%s\",0,0", TOPIC_LOCATION, payload);
    sendCommand(cmd);
}

// ... rest of SIM800 helper functions
```

## Testing the Complete Flow

### 1. Test with MQTT Explorer

1. Connect to `test.mosquitto.org:1883` (no TLS)
2. Publish a test message:
   - Topic: `ladybug/trap1/status`
   - Payload: `5,28.5,1`
3. Watch the bridge script console for the forwarded message
4. Check the database for the new reading

### 2. Verify in Database

Check if the reading was inserted:
- Go to the Dashboard → View the farm with device "trap1"
- The alert level should be "Green" (status code 1)

## Production Deployment

### Option A: Raspberry Pi

1. Install the script on your Raspberry Pi
2. Create a systemd service:

```ini
# /etc/systemd/system/ladybug-bridge.service
[Unit]
Description=LADYBUG Mosquitto Bridge
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/ladybug
ExecStart=/usr/bin/python3 /home/pi/ladybug/mosquitto_bridge.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

3. Enable and start:
```bash
sudo systemctl enable ladybug-bridge
sudo systemctl start ladybug-bridge
sudo systemctl status ladybug-bridge
```

### Option B: VPS (DigitalOcean/Vultr/Linode)

1. Create a $5/month droplet (cheapest option)
2. Install Python and dependencies
3. Use the same systemd service configuration
4. Consider using Docker for easier management

### Option C: Always-On PC

For development/testing only - not recommended for production.

## Troubleshooting

### Bridge Script Issues

| Problem | Solution |
|---------|----------|
| "Connection refused" | Check if port 1883 is not blocked by firewall |
| "No messages received" | Verify topic format matches exactly |
| "Supabase error 400" | Check payload format (CSV) |
| "Supabase error 500" | Check Edge Function logs |

### SIM800 Issues

| Problem | Solution |
|---------|----------|
| "MQTT connect failed" | Check APN settings and network registration |
| "Publish failed" | Verify broker address and port |
| "No response" | Check SIM800 baud rate and wiring |

### Checking Edge Function Logs

View logs in the Lovable dashboard:
1. Go to your project
2. Open the backend panel
3. Navigate to Edge Functions → mqtt-bridge → Logs

## Security Considerations

⚠️ **Important**: `test.mosquitto.org` is a PUBLIC broker:
- Anyone can subscribe to your topics
- Anyone can publish to your topics
- Do NOT send sensitive data

For production, consider:
1. **Self-hosted Mosquitto** with username/password authentication
2. **Topic prefixing** with a unique project ID: `ladybug-{random}/trap1/status`
3. **VPN** between your devices and the broker

## Quick Reference

| Component | Value |
|-----------|-------|
| Broker | `test.mosquitto.org` |
| Port | `1883` |
| Protocol | Plain TCP (no TLS) |
| Status Topic | `ladybug/{device_id}/status` |
| Location Topic | `ladybug/{device_id}/location` |
| Status Payload | `moth_count,temperature,status_code` |
| Location Payload | `latitude,longitude` |
| Edge Function | `https://hncumnbxaucdvjcnfptq.supabase.co/functions/v1/mqtt-bridge` |
