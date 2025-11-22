# Make.com MQTT to Supabase Integration with HiveMQ Cloud

This guide explains how to use Make.com with HiveMQ Cloud to bridge MQTT messages from ESP devices to the LADYBUG Supabase backend.

## Architecture Overview

```
ESP Devices → MQTT Broker (HiveMQ Cloud) → Make.com Webhook → Supabase Edge Function
```

ESP devices publish sensor data and pre-computed alert statuses to HiveMQ Cloud MQTT broker. Make.com receives webhook notifications from HiveMQ Cloud and forwards messages to the Supabase `mqtt-bridge` edge function via HTTP POST.

## Step 1: Set Up HiveMQ Cloud

1. Go to [HiveMQ Cloud](https://console.hivemq.cloud/)
2. Sign up for a free account
3. Create a new cluster (free tier available)
4. Note your cluster URL (e.g., `xxxxxx.s2.eu.hivemq.cloud`)
5. Create credentials:
   - Go to "Access Management"
   - Create a new user with username and password
   - Set permissions for topic `LADYBUG/#`

## Step 2: Configure HiveMQ Cloud Data Hub (Extension)

1. In your HiveMQ Cloud cluster, go to "Data Hub" or "Extensions"
2. Create a new HTTP data stream/webhook:
   - **Name**: `LADYBUG_to_Make`
   - **Topic Filter**: `LADYBUG/farm_data`
   - **Webhook URL**: (We'll get this from Make.com in Step 3)
   - **Method**: `POST`
   - **Content-Type**: `application/json`

## Step 3: Create Make.com Webhook

1. Go to [Make.com](https://www.make.com/) and sign up
2. Create a new scenario
3. Add **Webhooks → Custom Webhook** as the first module
4. Click "Create a webhook"
5. Copy the webhook URL (e.g., `https://hook.us1.make.com/xxxxx`)
6. Go back to HiveMQ Cloud Data Hub and paste this URL as the webhook destination

## Step 4: Configure Data Mapping in Make.com

1. After the webhook module, click the "+" button
2. Search for "HTTP" and add **HTTP → Make a Request**

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

### Body Mapping:

Map the webhook payload to Supabase format. HiveMQ sends the MQTT message in the webhook body:

```json
{
  "device_id": "{{payload.device_id}}",
  "moth_count": "{{payload.moth_count}}",
  "temperature_c": "{{payload.temperature_c}}",
  "computed_degree_days": "{{payload.computed_degree_days}}",
  "computed_status": "{{payload.computed_status}}"
}
```

## Step 5: Test the Integration

1. Use an MQTT client (like MQTT Explorer or mosquitto_pub) to publish a test message:
   ```bash
   mosquitto_pub -h your-cluster.s2.eu.hivemq.cloud \
     -p 8883 -u your-username -P your-password \
     -t "LADYBUG/farm_data" \
     --cafile path/to/ca.pem \
     -m '{"device_id":"ESP_FARM_001","moth_count":12,"temperature_c":28.5,"computed_degree_days":152.3,"computed_status":"yellow_medium_risk"}'
   ```

2. Check Make.com execution history to verify the webhook was triggered
3. Verify data appears in Supabase database

## Step 6: Activate the Scenario

1. Once testing is successful, toggle the scenario to "ON"
2. Name your scenario (e.g., "HiveMQ to Supabase Bridge")
3. Save the scenario

The bridge will now forward all MQTT messages from HiveMQ Cloud to Supabase automatically.

## ESP Device Configuration

Configure your ESP devices to connect to HiveMQ Cloud and publish to the `LADYBUG/farm_data` topic:

### MQTT Connection Settings:
- **Broker**: `your-cluster.s2.eu.hivemq.cloud`
- **Port**: `8883` (TLS/SSL)
- **Username**: Your HiveMQ Cloud username
- **Password**: Your HiveMQ Cloud password
- **Topic**: `LADYBUG/farm_data`

### Message Format:

ESP devices should publish JSON messages with this format:

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

### HiveMQ Cloud Console:
- Monitor active connections and message throughput
- View message rates and bandwidth usage
- Check client connection status

### Make.com Dashboard:
- View execution history in the scenario page
- Monitor for errors or failed webhook executions
- Check data throughput and processing times

### Supabase Logs:
- Go to Lovable Cloud → Edge Functions → `mqtt-bridge`
- View function invocation logs
- Check for successful data ingestion

### LADYBUG Dashboard:
- Open the Farm Map to see real-time alert updates
- View Analytics for historical trends

## Troubleshooting

### No messages received in Make.com:
- Verify HiveMQ Cloud webhook is correctly configured
- Check that ESP devices are successfully connecting to HiveMQ Cloud
- Ensure devices are publishing to the correct topic `LADYBUG/farm_data`
- Verify webhook URL in HiveMQ matches Make.com webhook URL
- Check HiveMQ Cloud logs for connection/publish errors

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

## HiveMQ Cloud Pricing

**Free Tier:**
- Up to 100 concurrent connections
- 10 GB data transfer per month
- Suitable for testing and small deployments

For production deployments with more devices, consider upgrading to a paid HiveMQ Cloud plan.

## Security Best Practices

HiveMQ Cloud provides enterprise-grade security:

1. **TLS/SSL Encryption**: All connections use port 8883 with TLS encryption
2. **Authentication**: Username/password authentication required for all clients
3. **Access Control**: Set topic-level permissions in HiveMQ Access Management
4. **Private Cluster**: Your HiveMQ Cloud cluster is isolated and private
5. **Data Validation**: Ensure ESP devices send validated data formats before publishing
