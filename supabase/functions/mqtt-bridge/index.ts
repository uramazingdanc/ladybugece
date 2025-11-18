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
 * Expected payload format:
 * {
 *   "device_id": "ESP_001",
 *   "moth_count": 45,
 *   "temperature": 28.5,
 *   "degree_days": 320,
 *   "alert_level": "Yellow",
 *   "timestamp": "2025-01-18T10:30:00Z"
 * }
 * 
 * MQTT Topic Structure: ladybug/{device_id}/status
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
    const { device_id, moth_count, temperature, degree_days, alert_level, timestamp } = payload;

    console.log('MQTT payload:', payload);

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
        temperature: temperature || 0,
        degree_days,
        alert_level
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
