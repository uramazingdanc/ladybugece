import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * MQTT Bridge Webhook Endpoint
 * 
 * This function receives data forwarded from an MQTT bridge service.
 * The bridge subscribes to freemqtt.com topics and forwards messages here.
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
 * Computed status values: "green", "yellow", "yellow_medium_risk", "red"
 * MQTT Topic: LADYBUG/farm_data
 */

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('MQTT Bridge webhook received data');

    const payload = await req.json();
    const { 
      device_id, 
      moth_count, 
      temperature_c, 
      temperature,
      computed_degree_days, 
      degree_days,
      computed_status 
    } = payload;

    console.log('MQTT payload:', payload);

    // Map computed_status to alert_level (Green/Yellow/Red)
    // ESP sends: "green", "yellow", "yellow_medium_risk", "red"
    // Database expects: "Green", "Yellow", "Red"
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
      return new Response(
        JSON.stringify({ error: 'Missing device_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Forward to ingest-data function with edge-computed data
    const { data: ingestResponse, error: ingestError } = await supabase.functions.invoke('ingest-data', {
      body: {
        device_id,
        moth_count: moth_count || 0,
        temperature: temp,
        degree_days: degDays,
        alert_level: alert_level // Pre-computed by ESP device
      }
    });

    if (ingestError) {
      console.error('Error calling ingest-data:', ingestError);
      return new Response(
        JSON.stringify({ error: 'Failed to process MQTT data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('MQTT data processed successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'MQTT data processed',
        data: ingestResponse
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in mqtt-bridge:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
