# Make.com MQTT to Supabase Integration

This guide explains how to use Make.com to bridge MQTT messages from ESP devices to the LADYBUG Supabase backend.

## Architecture Overview

```
ESP Devices → MQTT Broker (freemqtt.com) → Make.com → Supabase Edge Function
```

ESP devices publish sensor data and pre-computed alert statuses to an MQTT broker. Make.com subscribes to the MQTT topic and forwards messages to the Supabase `mqtt-bridge` edge function via HTTP POST.

## Step 1: Create a Make.com Account

1. Go to [Make.com](https://www.make.com/)
2. Sign up for a free account
3. Navigate to "Scenarios" in the dashboard

## Step 2: Create a New Scenario

1. Click "Create a new scenario"
2. Search for "MQTT" in the modules list
3. Add the **MQTT → Watch Messages** module as the first step

## Step 3: Configure MQTT Connection

In the MQTT Watch Messages module:

### Connection Settings:
- **Broker URL**: `mqtt://broker.hivemq.com` (or your preferred broker)
  - For freemqtt.com: `mqtt://broker.freemqtt.com`
- **Port**: `1883` (standard MQTT port)
- **Client ID**: `make_ladybug_bridge` (can be any unique name)
- **Username**: Leave empty (unless your broker requires auth)
- **Password**: Leave empty (unless your broker requires auth)

### Topic Settings:
- **Topic**: `LADYBUG/farm_data`
- **QoS**: `0` or `1` (quality of service level)

## Step 4: Add HTTP Request Module

1. Click the "+" button after the MQTT module
2. Search for "HTTP" and select **HTTP → Make a Request**

### HTTP Request Configuration:

- **URL**: `https://hncumnbxaucdvjcnfptq.supabase.co/functions/v1/mqtt-bridge`
- **Method**: `POST`
- **Headers**:
  ```
  Content-Type: application/json
  apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhuY3VtbmJ4YXVjZHZqY25mcHRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5ODQwMDUsImV4cCI6MjA3ODU2MDAwNX0.bX9y8k0Jn_9g6GYs4d5supHdx_yntqrj0kAcvJ_Rdk8
  ```
- **Body Type**: `Raw`
- **Content Type**: `JSON (application/json)`
- **Request Content**: Map the MQTT message fields

### Body Mapping:

Click "Parse response" and map the MQTT payload fields:

```json
{
  "device_id": "{{1.data.device_id}}",
  "moth_count": "{{1.data.moth_count}}",
  "temperature_c": "{{1.data.temperature_c}}",
  "computed_degree_days": "{{1.data.computed_degree_days}}",
  "computed_status": "{{1.data.computed_status}}"
}
```

**Note**: The `1.data.*` references map to the MQTT message data from step 1.

## Step 5: Test the Scenario

1. Click "Run once" at the bottom of the scenario
2. Have an ESP device publish a test message to the MQTT topic
3. Make.com will capture the message and forward it to Supabase
4. Check the execution history to verify success

## Step 6: Activate the Scenario

1. Once testing is successful, click the "ON/OFF" toggle to activate
2. Name your scenario (e.g., "LADYBUG MQTT Bridge")
3. Save the scenario

The bridge will now run continuously, forwarding MQTT messages in real-time.

## ESP Device Message Format

Your ESP devices should publish JSON messages to the `LADYBUG/farm_data` topic with this format:

```json
{
  "device_id": "ESP_FARM_001",
  "moth_count": 12,
  "temperature_c": 28.5,
  "computed_degree_days": 152.3,
  "computed_status": "yellow_medium_risk"
}
```

### Field Descriptions:

- **device_id**: Unique identifier for the ESP device (must exist in the `devices` table)
- **moth_count**: Number of moths detected
- **temperature_c**: Temperature in Celsius
- **computed_degree_days**: Cumulative degree-days calculated by the ESP
- **computed_status**: Pre-computed alert level
  - Values: `"green"`, `"yellow"`, `"yellow_medium_risk"`, `"red"`

## Monitoring

### Make.com Dashboard:
- View execution history in the scenario page
- Monitor for errors or failed executions
- Check data throughput and processing times

### Supabase Logs:
- Go to Lovable Cloud → Edge Functions → `mqtt-bridge`
- View function invocation logs
- Check for successful data ingestion

### LADYBUG Dashboard:
- Open the Farm Map to see real-time alert updates
- Check Live Devices tab for device status
- View Analytics for historical trends

## Troubleshooting

### No messages received in Make.com:
- Verify MQTT broker URL and port
- Check that ESP devices are publishing to the correct topic
- Ensure the Make.com scenario is activated (toggle ON)
- Test MQTT connection using MQTT Explorer

### HTTP request fails:
- Verify the Supabase function URL is correct
- Check that the `apikey` header matches your project
- Ensure the edge function is deployed and running
- Check Supabase function logs for errors

### Data not appearing in dashboard:
- Verify device exists in the `devices` table
- Check that device is linked to a valid farm
- Review Supabase database logs for insertion errors
- Ensure RLS policies allow data insertion

## Cost Considerations

**Make.com Free Tier:**
- 1,000 operations per month
- 1 active scenario
- 15-minute execution intervals

For production deployments with high message volumes, consider upgrading to a paid Make.com plan.

## Alternative MQTT Brokers

While this guide uses freemqtt.com/HiveMQ public brokers, you can use any MQTT broker:

- **Mosquitto** (self-hosted)
- **AWS IoT Core**
- **Azure IoT Hub**
- **CloudMQTT**
- **HiveMQ Cloud**

Simply update the broker URL in the Make.com MQTT module configuration.

## Security Best Practices

For production deployments:

1. **Use TLS/SSL**: Configure MQTT over TLS (port 8883)
2. **Authentication**: Use username/password for MQTT broker
3. **Private Broker**: Avoid public MQTT brokers in production
4. **API Security**: Use Supabase service role key for authenticated requests
5. **Data Validation**: Ensure ESP devices send validated data formats
