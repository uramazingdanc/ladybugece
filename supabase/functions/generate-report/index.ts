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

    console.log('Generating analytics report from current dashboard data...');

    // Fetch current farm status from ipm_alerts (what the dashboard shows)
    const { data: alerts, error: alertsError } = await supabase
      .from('ipm_alerts')
      .select(`
        farm_id,
        alert_level,
        last_moth_count,
        last_temperature,
        last_larva_density,
        last_updated,
        farms!inner (
          farm_name,
          latitude,
          longitude
        )
      `)
      .order('last_updated', { ascending: false });

    if (alertsError) {
      console.error('Error fetching alerts:', alertsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch dashboard data' }),
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

    // Header row matching the exact format from dashboard
    csvContent += 'Date,Time,Farm_ID,longitude,latitude,Moth count,Temperature,larva density,Farm status\n';

    if (alerts && alerts.length > 0) {
      alerts.forEach((alert: any) => {
        const farm = alert.farms;
        const farmName = farm?.farm_name || 'Unknown';
        const longitude = farm?.longitude || '';
        const latitude = farm?.latitude || '';
        const alertLevel = alert.alert_level || 'Green';
        const farmStatus = getStatusText(alertLevel);
        const larvaDensity = alert.last_larva_density !== null && alert.last_larva_density !== undefined 
          ? alert.last_larva_density 
          : '';
        
        // Split timestamp into date and time
        const dateObj = new Date(alert.last_updated);
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
        
        csvContent += `${date},${time},${farmName},${longitude},${latitude},${alert.last_moth_count},${alert.last_temperature},${larvaDensity},${farmStatus}\n`;
      });
    }

    console.log('CSV analytics report generated successfully');
    console.log(`Report contains ${alerts?.length || 0} farm records`);

    return new Response(
      csvContent,
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="ladybug-analytics-report.csv"`
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
