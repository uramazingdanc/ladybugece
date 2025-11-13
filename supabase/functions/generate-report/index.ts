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

    // Fetch pest readings for the time period
    const { data: readings, error: readingsError } = await supabase
      .from('pest_readings')
      .select(`
        id,
        moth_count,
        temperature,
        created_at,
        device_id,
        devices!pest_readings_device_id_fkey (
          farm_id,
          device_name
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

    // Generate statistics
    const totalFarms = farms?.length || 0;
    const redAlerts = farms?.filter(f => f.ipm_alerts?.[0]?.alert_level === 'Red').length || 0;
    const yellowAlerts = farms?.filter(f => f.ipm_alerts?.[0]?.alert_level === 'Yellow').length || 0;
    const greenAlerts = farms?.filter(f => f.ipm_alerts?.[0]?.alert_level === 'Green').length || 0;

    const totalReadings = readings?.length || 0;
    const avgMothCount = readings && readings.length > 0
      ? readings.reduce((sum, r) => sum + r.moth_count, 0) / readings.length
      : 0;
    const avgTemperature = readings && readings.length > 0
      ? readings.reduce((sum, r) => sum + r.temperature, 0) / readings.length
      : 0;

    // Create GIS report data
    const gisReport = {
      metadata: {
        generated_at: new Date().toISOString(),
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          days
        }
      },
      summary: {
        total_farms: totalFarms,
        alert_distribution: {
          red: redAlerts,
          yellow: yellowAlerts,
          green: greenAlerts
        },
        total_readings: totalReadings,
        average_moth_count: Math.round(avgMothCount * 100) / 100,
        average_temperature: Math.round(avgTemperature * 100) / 100
      },
      farms: farms?.map(farm => ({
        id: farm.id,
        name: farm.farm_name,
        owner: (Array.isArray(farm.profiles) ? farm.profiles[0] as any : farm.profiles as any)?.full_name || 'Unknown',
        coordinates: {
          latitude: farm.latitude,
          longitude: farm.longitude
        },
        current_status: {
          alert_level: farm.ipm_alerts?.[0]?.alert_level || 'Green',
          last_moth_count: farm.ipm_alerts?.[0]?.last_moth_count || 0,
          last_updated: farm.ipm_alerts?.[0]?.last_updated
        }
      })) || [],
      readings_sample: readings?.slice(0, 100) // Include recent 100 readings
    };

    console.log('Report generated successfully');

    return new Response(
      JSON.stringify(gisReport),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="ladybug-report-${days}days.json"`
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
