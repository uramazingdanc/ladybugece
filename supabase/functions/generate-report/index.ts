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

    console.log('Generating analytics report...');

    // Get the days parameter (default to 7 days)
    const url = new URL(req.url);
    const days = parseInt(url.searchParams.get('days') || '7');

    console.log('Generating report for last', days, 'days');

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Fetch pest readings with farm data using RPC for historical data
    const { data: readings, error: readingsError } = await supabase.rpc('get_readings_with_farms', {
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString()
    });

    if (readingsError) {
      console.error('Error fetching readings:', readingsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch readings data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Map alert levels to descriptive status
    const getStatusText = (alertLevel: string): string => {
      switch (alertLevel) {
        case 'Red':
          return 'critical';
        case 'Yellow':
          return 'medium risk';
        case 'Green':
          return 'low risk';
        default:
          return 'low risk';
      }
    };

    // Generate CSV content - simple data table format matching the screenshot
    let csvContent = '';

    // Header row matching the exact format: Date, Time, Farm_ID, longitude, latitude, Moth count, Temperature, larva density, Farm status
    csvContent += 'Date,Time,Farm_ID,longitude,latitude,Moth count,Temperature,larva density,Farm status\n';

    if (readings && readings.length > 0) {
      readings.forEach((reading: any) => {
        const farmName = reading.farm_name || 'Unknown';
        const longitude = reading.longitude || '';
        const latitude = reading.latitude || '';
        const alertLevel = reading.alert_level || 'Green';
        const farmStatus = getStatusText(alertLevel);
        const larvaDensity = reading.larva_density !== null && reading.larva_density !== undefined 
          ? reading.larva_density 
          : '';
        
        // Split timestamp into date and time
        const dateObj = new Date(reading.created_at);
        const date = dateObj.toLocaleDateString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
        const time = dateObj.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
        
        csvContent += `${date},${time},${farmName},${longitude},${latitude},${reading.moth_count},${reading.temperature},${larvaDensity},${farmStatus}\n`;
      });
    }

    console.log('CSV analytics report generated successfully');
    console.log(`Report contains ${readings?.length || 0} pest readings`);

    return new Response(
      csvContent,
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="ladybug-analytics-report-${days}days.csv"`
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
