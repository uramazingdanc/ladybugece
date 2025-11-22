# EMQX Cloud Setup Guide - HTTP Webhook Integration

## Overview

This guide covers setting up **EMQX Cloud** (free tier) to forward MQTT messages to your Supabase Edge Function via HTTP webhooks.

**Architecture:**
```
ESP Devices → EMQX Cloud MQTT Broker → HTTP Webhook → Supabase mqtt-bridge Function → Database
```

## Why EMQX Cloud?

- ✅ **Free tier includes HTTP webhooks** (unlike HiveMQ Cloud Starter)
- ✅ Simple webhook configuration
- ✅ Reliable and scalable
- ✅ Easy-to-use dashboard

---

## Step 1: Create EMQX Cloud Account

1. Go to [https://www.emqx.com/en/cloud](https://www.emqx.com/en/cloud)
2. Click **"Start Free"** or **"Sign Up"**
3. Create your account (email verification required)
4. Log in to the EMQX Cloud Console

---

## Step 2: Create a Serverless Deployment (Free Tier)

1. In the EMQX Cloud Console, click **"New Deployment"**
2. Select **"Serverless"** (this is the free tier)
3. Choose a region close to your location (e.g., AWS ap-southeast-1 for Southeast Asia)
4. Give it a name: `ladybug-mqtt-broker`
5. Click **"Create"**
6. Wait for deployment to complete (usually 1-2 minutes)

---

## Step 3: Get Connection Details

Once deployment is ready:

1. Click on your deployment name
2. Go to **"Overview"** tab
3. Note down:
   - **Cluster Address** (e.g., `xxx.emqxsl.com`)
   - **Port**: `8883` (for secure MQTT over TLS)
   - **Connection Port** for WebSocket: `8084`

---

## Step 4: Create Authentication Credentials

1. In your deployment, go to **"Authentication"** in the left menu
2. Click **"Add"** or **"Create Authentication"**
3. Choose **"Username/Password"** authentication
4. Add credentials:
   - **Username**: `ladybugdevice`
   - **Password**: `@Ladybug2025` (or your preferred secure password)
5. Click **"Confirm"**

---

## Step 5: Configure Data Integration (HTTP Webhook)

This is the critical step that connects EMQX to Supabase.

### 5.1 Create a Rule

1. Go to **"Data Integration"** → **"Rules"** in the left menu
2. Click **"Create Rule"**
3. In the **SQL Editor**, enter:
   ```sql
   SELECT
     payload.device_id as device_id,
     payload.moth_count as moth_count,
     payload.temperature_c as temperature_c,
     payload.computed_degree_days as computed_degree_days,
     payload.computed_status as computed_status
   FROM
     "LADYBUG/farm_data"
   ```
4. This rule will trigger for all messages published to `LADYBUG/farm_data`
5. Click **"Next"**

### 5.2 Add HTTP Server Action

1. Under **"Action"**, click **"Add Action"**
2. Select **"HTTP Server"** (or "Webhook")
3. Configure the webhook:
   - **Name**: `Supabase_Webhook`
   - **Method**: `POST`
   - **URL**: 
     ```
     https://hncumnbxaucdvjcnfptq.supabase.co/functions/v1/mqtt-bridge
     ```
   - **Headers**: Add the following headers:
     ```
     Content-Type: application/json
     apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhuY3VtbmJ4YXVjZHZqY25mcHRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5ODQwMDUsImV4cCI6MjA3ODU2MDAwNX0.bX9y8k0Jn_9g6GYs4d5supHdx_yntqrj0kAcvJ_Rdk8
     ```
   - **Body Template**: Use the default or:
     ```json
     ${payload}
     ```
4. Click **"Confirm"**
5. Click **"Create** to save the rule

---

## Step 6: Update ESP32 Connection Code

Update your ESP32 device code to connect to EMQX Cloud:

```cpp
// EMQX Cloud Connection Settings
const char* mqtt_server = "xxx.emqxsl.com";  // Your EMQX cluster address
const int mqtt_port = 8883;                   // Secure MQTT port
const char* mqtt_user = "ladybugdevice";      // Your username
const char* mqtt_password = "@Ladybug2025";   // Your password
const char* mqtt_topic = "LADYBUG/farm_data";

// In your setup() function, connect using TLS
WiFiClientSecure espClient;
espClient.setInsecure();  // For testing; use proper certificates in production
PubSubClient client(espClient);

client.setServer(mqtt_server, mqtt_port);
client.connect("ESP32_Farm_Device", mqtt_user, mqtt_password);
```

---

## Step 7: Test the Pipeline

### Test with EMQX Websocket Client

1. In EMQX Cloud Console, go to **"Tools"** → **"Websocket Client"**
2. Click **"Connect"**
3. Enter your credentials:
   - Host: Your cluster address
   - Port: `8084` (WebSocket port)
   - Username: `ladybugdevice`
   - Password: `@Ladybug2025`
4. Click **"Connect"**
5. Once connected, publish a test message:
   - **Topic**: `LADYBUG/farm_data`
   - **QoS**: `1`
   - **Payload**:
     ```json
     {
       "device_id": "TEST_EMQX_01",
       "moth_count": 15,
       "temperature_c": 27.5,
       "computed_degree_days": 125.0,
       "computed_status": "yellow_medium_risk"
     }
     ```
6. Click **"Publish"**

### Verify in Supabase

1. Open your Supabase Dashboard
2. Go to **Database** → **Table Editor**
3. Check the `pest_readings` table for the new test data
4. Check **Edge Functions** → **mqtt-bridge** → **Logs** to see if the webhook was received

---

## Step 8: Monitor Data Flow

### In EMQX Cloud:
1. Go to **"Monitoring"** to see:
   - Connected clients
   - Message throughput
   - Rule execution statistics

### In Supabase:
1. Check **Edge Functions** → **mqtt-bridge** → **Logs**
2. Check **Database** → **Table Editor** → `pest_readings`

---

## Troubleshooting

### Webhook Not Triggering
- Verify the rule SQL matches your topic: `LADYBUG/farm_data`
- Check that the HTTP Server action URL is correct
- Look at **Data Integration** → **Rules** → Your Rule → **Metrics** for execution stats

### Connection Issues
- Ensure ESP32 is using port `8883` for TLS
- Verify username/password in both ESP32 code and EMQX authentication
- Check that ESP32 has internet connectivity

### Data Not Appearing in Database
- Check Supabase Edge Function logs for errors
- Verify the `ingest-data` function is working
- Check that the device_id exists in the `devices` table

---

## Cost Considerations

EMQX Serverless (Free Tier):
- **1M session minutes/month** (plenty for testing and small deployments)
- **1GB data transfer/month**
- **No credit card required**

For production at scale, consider upgrading to a paid plan.

---

## Summary

You now have a complete, free MQTT-to-Database pipeline:

1. ✅ ESP32 devices publish to EMQX Cloud
2. ✅ EMQX Cloud forwards via HTTP webhook to Supabase
3. ✅ Supabase Edge Function processes and stores data
4. ✅ Dashboard displays real-time farm status

Your `mqtt-bridge` Edge Function is already configured correctly—no code changes needed!
