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

    console.log('Generating analytics report with all historical data...');

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

    // Generate CSV content
    let csvContent = '';
    csvContent += 'Date,Time,Farm_ID,longitude,latitude,Moth count,Temperature,larva density,Farm status\n';

    const allRows: string[] = [];

    // 1. Fetch ALL historical pest_readings with farm info
    const { data: readings, error: readingsError } = await supabase
      .from('pest_readings')
      .select(`
        created_at,
        moth_count,
        temperature,
        larva_density,
        device_id,
        devices!inner (
          farm_id,
          farms!inner (
            farm_name,
            latitude,
            longitude
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (readingsError) {
      console.error('Error fetching pest_readings:', readingsError);
    }

    // 2. Fetch current ipm_alerts for latest status and data
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
      console.error('Error fetching ipm_alerts:', alertsError);
    }

    // Create a map of farm_id to alert_level for historical readings
    const alertLevelMap: Record<string, string> = {};
    if (alerts) {
      alerts.forEach((alert: any) => {
        alertLevelMap[alert.farm_id] = alert.alert_level;
      });
    }

    // Add historical pest_readings to report
    if (readings && readings.length > 0) {
      console.log(`Adding ${readings.length} historical pest readings to report`);
      readings.forEach((reading: any) => {
        const device = reading.devices;
        const farm = device?.farms;
        const farmName = farm?.farm_name || 'Unknown';
        const longitude = farm?.longitude || '';
        const latitude = farm?.latitude || '';
        const alertLevel = alertLevelMap[device?.farm_id] || 'Green';
        const farmStatus = getStatusText(alertLevel);
        const larvaDensity = reading.larva_density !== null && reading.larva_density !== undefined 
          ? reading.larva_density 
          : '';
        
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
        
        allRows.push(`${date},${time},${farmName},${longitude},${latitude},${reading.moth_count},${reading.temperature},${larvaDensity},${farmStatus}`);
      });
    }

    // 3. If no historical readings, fall back to current ipm_alerts data
    if (allRows.length === 0 && alerts && alerts.length > 0) {
      console.log(`No historical readings found. Adding ${alerts.length} current alerts to report`);
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
        
        allRows.push(`${date},${time},${farmName},${longitude},${latitude},${alert.last_moth_count},${alert.last_temperature},${larvaDensity},${farmStatus}`);
      });
    }

    // Add all rows to CSV
    csvContent += allRows.join('\n');
    if (allRows.length > 0) {
      csvContent += '\n';
    }

    console.log('CSV analytics report generated successfully');
    console.log(`Report contains ${allRows.length} total records`);

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
