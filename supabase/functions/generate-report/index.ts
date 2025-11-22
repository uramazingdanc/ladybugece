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

    console.log('Generating report...');

    // Get the days parameter (default to 7 days)
    const url = new URL(req.url);
    const days = parseInt(url.searchParams.get('days') || '7');

    console.log('Generating report for last', days, 'days');

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Fetch all farms with their current alert status
    const { data: farms, error: farmsError } = await supabase
      .from('farms')
      .select(`
        id,
        farm_name,
        latitude,
        longitude,
        owner_id,
        profiles!farms_owner_id_fkey (
          full_name
        ),
        ipm_alerts (
          alert_level,
          last_moth_count,
          last_updated
        )
      `);

    if (farmsError) {
      console.error('Error fetching farms:', farmsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch farms data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch pest readings for the time period with farm data
    const { data: readings, error: readingsError } = await supabase
      .from('pest_readings')
      .select(`
        moth_count,
        temperature,
        created_at,
        device_id,
        devices!pest_readings_device_id_fkey (
          farm_id,
          farms!devices_farm_id_fkey (
            id,
            latitude,
            longitude,
            ipm_alerts (
              alert_level
            )
          )
        )
      `)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false });

    if (readingsError) {
      console.error('Error fetching readings:', readingsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch readings data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate CSV with columns: Time Stamp, Farm_ID, longitude, latitude, Moth count, Temperature, Farm status
    const csvHeader = 'Time Stamp,Farm_ID,longitude,latitude,Moth count,Temperature,Farm status\n';
    
    const csvRows = readings?.map(reading => {
      const device = reading.devices as any;
      const farm = device?.farms;
      const farmId = farm?.id || '';
      const longitude = farm?.longitude || '';
      const latitude = farm?.latitude || '';
      const alertLevel = farm?.ipm_alerts?.[0]?.alert_level || 'Unknown';
      const timestamp = new Date(reading.created_at).toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      
      return `${timestamp},${farmId},${longitude},${latitude},${reading.moth_count},${reading.temperature},${alertLevel}`;
    }).join('\n') || '';

    const csvContent = csvHeader + csvRows;

    console.log('CSV report generated successfully');

    return new Response(
      csvContent,
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="ladybug-report-${days}days.csv"`
        } 
      }
    );

  } catch (error) {
    console.error('Error in generate-report:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
