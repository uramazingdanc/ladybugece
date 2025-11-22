import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import mqtt from 'https://esm.sh/mqtt@5.3.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * MQTT Bridge - Direct HiveMQ Cloud Subscriber
 * 
 * This function acts as an MQTT client that subscribes directly to HiveMQ Cloud
 * and processes messages from ESP devices in real-time.
 * 
 * Architecture: ESP Devices → HiveMQ Cloud → Supabase Edge Function (MQTT Client) → Supabase DB
 * 
 * Expected payload format from ESP device:
 * {
 *   "device_id": "ESP_FARM_001",
 *   "moth_count": 12,
 *   "temperature_c": 28,
 *   "computed_degree_days": 152.5,
 *   "computed_status": "yellow_medium_risk"
 * }
 * 
 * MQTT Topic: LADYBUG/farm_data
 */

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// HiveMQ Cloud credentials
const HIVEMQ_HOST = Deno.env.get('HIVEMQ_HOST')!;
const HIVEMQ_USERNAME = Deno.env.get('HIVEMQ_USERNAME')!;
const HIVEMQ_PASSWORD = Deno.env.get('HIVEMQ_PASSWORD')!;

async function processMessage(payload: any) {
  try {
    const { 
      device_id, 
      moth_count, 
      temperature_c, 
      temperature,
      computed_degree_days, 
      degree_days,
      computed_status 
    } = payload;

    console.log('Processing MQTT message:', payload);

    // Map computed_status to alert_level (Green/Yellow/Red)
    let alert_level = null;
    if (computed_status) {
      const statusLower = computed_status.toLowerCase();
      if (statusLower.includes('red')) {
        alert_level = 'Red';
      } else if (statusLower.includes('yellow')) {
        alert_level = 'Yellow';
      } else if (statusLower.includes('green')) {
        alert_level = 'Green';
      }
      console.log(`Mapped computed_status "${computed_status}" to alert_level "${alert_level}"`);
    }

    // Use either new field names or legacy field names for backward compatibility
    const temp = temperature_c || temperature || 0;
    const degDays = computed_degree_days || degree_days;

    // Validate required fields
    if (!device_id) {
      console.error('Missing device_id');
      return;
    }

    // Forward to ingest-data function
    const { data: ingestResponse, error: ingestError } = await supabase.functions.invoke('ingest-data', {
      body: {
        device_id,
        moth_count: moth_count || 0,
        temperature: temp,
        degree_days: degDays,
        alert_level: alert_level
      }
    });

    if (ingestError) {
      console.error('Error calling ingest-data:', ingestError);
    } else {
      console.log('MQTT data processed successfully:', ingestResponse);
    }
  } catch (error) {
    console.error('Error processing message:', error);
  }
}

async function connectAndSubscribe() {
  console.log('Connecting to HiveMQ Cloud...');
  
  try {
    const client = mqtt.connect(`mqtts://${HIVEMQ_HOST}:8883`, {
      username: HIVEMQ_USERNAME,
      password: HIVEMQ_PASSWORD,
      clientId: `supabase_mqtt_${Date.now()}`,
      reconnectPeriod: 10000,
    });

    client.on('connect', () => {
      console.log('Connected to HiveMQ Cloud');
      client.subscribe('LADYBUG/farm_data', { qos: 1 }, (err) => {
        if (err) {
          console.error('Subscribe error:', err);
        } else {
          console.log('Subscribed to LADYBUG/farm_data');
        }
      });
    });

    client.on('message', async (topic, message) => {
      try {
        const payload = JSON.parse(message.toString());
        await processMessage(payload);
      } catch (e) {
        console.error('Error parsing MQTT message:', e);
      }
    });

    client.on('error', (error) => {
      console.error('MQTT connection error:', error);
    });

    client.on('reconnect', () => {
      console.log('Reconnecting to HiveMQ Cloud...');
    });

    // Keep connection alive
    await new Promise(() => {}); // Never resolve to keep function running
  } catch (error) {
    console.error('Fatal MQTT error:', error);
    // Retry connection after delay
    console.log('Retrying connection in 10 seconds...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    await connectAndSubscribe();
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Start MQTT subscription as background task
  connectAndSubscribe().catch(console.error);

  return new Response(
    JSON.stringify({ 
      success: true,
      message: 'MQTT subscriber started',
      status: 'listening to LADYBUG/farm_data'
    }),
    { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
});
