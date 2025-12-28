# HiveMQ Quick Start for LADYBUG Prototype

A simplified guide for getting your SIM800 GSM traps connected using HiveMQ's free public broker.

## Prerequisites

- Python 3.x installed on your PC
- SIM800 GSM module with active SIM card
- MQTT Explorer (optional, for testing)

## Quick Setup (3 Steps)

### Step 1: Run the Bridge Script

```bash
# Install dependencies
pip install paho-mqtt requests

# Create hivemq_bridge.py with the content from MOSQUITTO_BRIDGE_SETUP.md
# Then run:
python hivemq_bridge.py
```

### Step 2: Configure SIM800

```cpp
#define MQTT_BROKER     "broker.hivemq.com"
#define MQTT_PORT       1883
#define MQTT_CLIENT_ID  "trap1"
#define TOPIC_STATUS    "ladybug/trap1/status"
#define TOPIC_LOCATION  "ladybug/trap1/location"
```

### Step 3: Test with MQTT Explorer

1. Connect to `broker.hivemq.com:1883`
2. Publish to `ladybug/trap1/status` with payload `5,28.5,2`
3. Check your bridge console and LADYBUG dashboard

## Data Flow

```
SIM800 → broker.hivemq.com:1883 → Python Bridge → Supabase → Dashboard
```

## Payload Formats

| Message Type | Topic | Payload | Example |
|--------------|-------|---------|---------|
| Status | `ladybug/trap1/status` | `moth_count,temp,status` | `5,28.5,2` |
| Location | `ladybug/trap1/location` | `lat,lng` | `14.5995,120.9842` |

**Status Codes:** 1=Green, 2=Yellow, 3=Red

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Bridge won't connect | Check firewall allows port 1883 |
| No data in dashboard | Verify device ID matches a farm |
| SIM800 connection fails | Check APN and network signal |

## Limitations (Prototype Only)

- ⚠️ Public broker - anyone can see/publish to topics
- ⚠️ No authentication
- ⚠️ Not for production use

For production, see [ORACLE_MOSQUITTO_SETUP.md](./ORACLE_MOSQUITTO_SETUP.md) for a free self-hosted solution.
