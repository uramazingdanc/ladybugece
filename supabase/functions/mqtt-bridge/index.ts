import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * MQTT Bridge - HiveMQ Cloud HTTP Webhook Receiver
 * 
 * This function receives HTTP POST requests from HiveMQ Cloud's HTTP Extension.
 * HiveMQ forwards MQTT messages as HTTP requests, eliminating the need for an MQTT client.
 * 
 * Architecture: ESP Devices → HiveMQ Cloud → HTTP Extension → Supabase Edge Function → Supabase DB
 * 
 * Expected payload format from HiveMQ HTTP Extension:
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

    console.log('Processing MQTT message from HiveMQ webhook:', payload);

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
      return { success: false, error: 'Missing device_id' };
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
      return { success: false, error: ingestError };
    } else {
      console.log('MQTT data processed successfully:', ingestResponse);
      return { success: true, data: ingestResponse };
    }
  } catch (error) {
    console.error('Error processing message:', error);
    return { success: false, error: String(error) };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse the incoming JSON payload from HiveMQ HTTP Extension
    const payload = await req.json();
    
    // Process the message
    const result = await processMessage(payload);

    return new Response(
      JSON.stringify(result),
      { 
        status: result.success ? 200 : 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error in mqtt-bridge handler:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Failed to process request',
        details: String(error)
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
