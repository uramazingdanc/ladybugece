import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Received data ingestion request');

    // Parse the incoming data from hardware
    const { device_id, moth_count, temperature } = await req.json();

    console.log('Data received:', { device_id, moth_count, temperature });

    // Validate required fields
    if (!device_id || moth_count === undefined || temperature === undefined) {
      console.error('Missing required fields');
      return new Response(
        JSON.stringify({ error: 'Missing required fields: device_id, moth_count, temperature' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate device exists
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('id, farm_id')
      .eq('id', device_id)
      .single();

    if (deviceError || !device) {
      console.error('Device not found:', deviceError);
      return new Response(
        JSON.stringify({ error: 'Device not found or not registered' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Device validated:', device);

    // Insert pest reading
    const { data: reading, error: readingError } = await supabase
      .from('pest_readings')
      .insert({
        device_id,
        moth_count,
        temperature
      })
      .select()
      .single();

    if (readingError) {
      console.error('Error inserting reading:', readingError);
      return new Response(
        JSON.stringify({ error: 'Failed to insert reading' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Reading inserted:', reading);

    // Call calculate-alerts function
    const calculateAlertsUrl = `${supabaseUrl}/functions/v1/calculate-alerts`;
    const calculateResponse = await fetch(calculateAlertsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        farm_id: device.farm_id,
        moth_count
      })
    });

    if (!calculateResponse.ok) {
      console.error('Error calling calculate-alerts');
    } else {
      console.log('Alert calculation triggered successfully');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        reading_id: reading.id,
        message: 'Data ingested successfully'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in ingest-data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
