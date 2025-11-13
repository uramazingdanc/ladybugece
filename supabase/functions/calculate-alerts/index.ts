import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// IPM Thresholds (based on research guidelines)
const DANGER_THRESHOLD = 20; // Red alert
const WARNING_THRESHOLD = 10; // Yellow alert

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Calculating alerts...');

    const { farm_id, moth_count } = await req.json();

    if (!farm_id || moth_count === undefined) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: farm_id, moth_count' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Calculating alert for farm:', farm_id, 'moth count:', moth_count);

    // Determine alert level based on IPM thresholds
    let alertLevel: 'Green' | 'Yellow' | 'Red' = 'Green';
    
    if (moth_count >= DANGER_THRESHOLD) {
      alertLevel = 'Red';
    } else if (moth_count >= WARNING_THRESHOLD) {
      alertLevel = 'Yellow';
    }

    console.log('Alert level determined:', alertLevel);

    // Upsert the alert status
    const { data, error } = await supabase
      .from('ipm_alerts')
      .upsert({
        farm_id,
        alert_level: alertLevel,
        last_moth_count: moth_count,
        last_updated: new Date().toISOString()
      }, {
        onConflict: 'farm_id'
      })
      .select();

    if (error) {
      console.error('Error upserting alert:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to update alert status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Alert updated successfully:', data);

    // If alert is Yellow or Red, we could trigger notifications here
    if (alertLevel === 'Yellow' || alertLevel === 'Red') {
      console.log(`⚠️ ${alertLevel} alert for farm ${farm_id}!`);
      // TODO: Implement push notifications here
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        alert_level: alertLevel,
        farm_id,
        moth_count
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in calculate-alerts:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
