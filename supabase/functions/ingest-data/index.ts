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

    // Parse the incoming data from hardware (edge-computed)
    const { device_id, moth_count, temperature, degree_days, alert_level } = await req.json();

    console.log('Data received:', { device_id, moth_count, temperature, degree_days, alert_level });

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

    // Insert pest reading with optional degree_days
    const readingData: any = {
      device_id,
      moth_count,
      temperature
    };
    
    if (degree_days !== undefined) {
      readingData.degree_days = degree_days;
    }

    const { data: reading, error: readingError } = await supabase
      .from('pest_readings')
      .insert(readingData)
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

    // If alert_level is provided (edge-computed), update directly
    if (alert_level) {
      console.log('Using edge-computed alert level:', alert_level);
      const { error: alertError } = await supabase
        .from('ipm_alerts')
        .upsert({
          farm_id: device.farm_id,
          alert_level: alert_level,
          last_moth_count: moth_count,
          last_temperature: temperature,
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'farm_id'
        });

      if (alertError) {
        console.error('Error updating alert:', alertError);
      } else {
        console.log('Alert updated with edge-computed status');
        
        // Trigger email alert for RED status
        if (alert_level === 'Red') {
          console.log('RED alert detected, triggering email notification');
          try {
            const { data: emailResult, error: emailError } = await supabase.functions.invoke('send-alert-email', {
              body: {
                farm_id: device.farm_id,
                alert_level: alert_level
              }
            });
            
            if (emailError) {
              console.error('Error sending alert email:', emailError);
            } else {
              console.log('Alert email triggered successfully:', emailResult);
            }
          } catch (emailError) {
            console.error('Failed to trigger email alert:', emailError);
            // Don't fail the main request if email fails
          }
        }
      }
    } else {
      // Fallback to server-side calculation if no alert_level provided
      console.log('No edge-computed alert, falling back to server calculation');
      const { data: alertResponse } = await supabase.functions.invoke('calculate-alerts', {
        body: { farm_id: device.farm_id, moth_count }
      });
      console.log('Server-side alert calculation result:', alertResponse);
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
