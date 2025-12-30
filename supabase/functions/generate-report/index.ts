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

    // Fetch all farms with their devices and current alert status
    const { data: farms, error: farmsError } = await supabase
      .from('farms')
      .select(`
        id,
        farm_name,
        latitude,
        longitude,
        devices (
          id,
          device_name
        ),
        ipm_alerts (
          alert_level,
          last_moth_count,
          last_temperature,
          last_larva_density,
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

    // Fetch pest readings with farm data using RPC for historical data
    const { data: readings, error: readingsError } = await supabase.rpc('get_readings_with_farms', {
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString()
    });

    if (readingsError) {
      console.error('Error fetching readings:', readingsError);
      // Continue without historical readings - we'll use current status
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
          return 'Unknown';
      }
    };

    // Generate CSV content
    let csvContent = '';

    // Section 1: Summary Statistics
    csvContent += '=== ANALYTICS SUMMARY ===\n';
    csvContent += 'Report Generated,' + new Date().toLocaleString() + '\n';
    csvContent += 'Report Period,' + days + ' days\n';
    csvContent += 'Start Date,' + startDate.toLocaleDateString() + '\n';
    csvContent += 'End Date,' + endDate.toLocaleDateString() + '\n\n';

    // Calculate alert statistics and moth count/larva density totals from current farm status
    let greenCount = 0;
    let yellowCount = 0;
    let redCount = 0;
    let totalMothCount = 0;
    let totalLarvaDensity = 0;
    let mothCountEntries = 0;
    let larvaDensityEntries = 0;

    farms?.forEach(farm => {
      // ipm_alerts is an array, get the first one
      const alertData = Array.isArray(farm.ipm_alerts) ? farm.ipm_alerts[0] : farm.ipm_alerts;
      const alertLevel = alertData?.alert_level || 'Green';
      switch (alertLevel) {
        case 'Green': greenCount++; break;
        case 'Yellow': yellowCount++; break;
        case 'Red': redCount++; break;
      }
      
      // Accumulate moth count and larva density from current status
      if (alertData?.last_moth_count !== null && alertData?.last_moth_count !== undefined) {
        totalMothCount += alertData.last_moth_count;
        mothCountEntries++;
      }
      if (alertData?.last_larva_density !== null && alertData?.last_larva_density !== undefined) {
        totalLarvaDensity += alertData.last_larva_density;
        larvaDensityEntries++;
      }
    });

    // Calculate historical totals and averages from pest readings
    let historicalMothTotal = 0;
    let historicalLarvaTotal = 0;
    let historicalMothCount = 0;
    let historicalLarvaCount = 0;

    if (readings && readings.length > 0) {
      readings.forEach((reading: any) => {
        if (reading.moth_count !== null && reading.moth_count !== undefined) {
          historicalMothTotal += reading.moth_count;
          historicalMothCount++;
        }
        if (reading.larva_density !== null && reading.larva_density !== undefined) {
          historicalLarvaTotal += reading.larva_density;
          historicalLarvaCount++;
        }
      });
    }

    // Calculate averages
    const avgMothCount = mothCountEntries > 0 ? (totalMothCount / mothCountEntries).toFixed(2) : 'N/A';
    const avgLarvaDensity = larvaDensityEntries > 0 ? (totalLarvaDensity / larvaDensityEntries).toFixed(2) : 'N/A';
    const historicalAvgMoth = historicalMothCount > 0 ? (historicalMothTotal / historicalMothCount).toFixed(2) : 'N/A';
    const historicalAvgLarva = historicalLarvaCount > 0 ? (historicalLarvaTotal / historicalLarvaCount).toFixed(2) : 'N/A';

    csvContent += '=== ALERT DISTRIBUTION ===\n';
    csvContent += 'Total Farms Monitored,' + (farms?.length || 0) + '\n';
    csvContent += 'Green Alert (Low Risk),' + greenCount + '\n';
    csvContent += 'Yellow Alert (Medium Risk),' + yellowCount + '\n';
    csvContent += 'Red Alert (High Risk),' + redCount + '\n\n';

    csvContent += '=== PEST INCIDENTS SUMMARY (Current Status) ===\n';
    csvContent += 'Total Moth Count (All Farms),' + totalMothCount + '\n';
    csvContent += 'Average Moth Count per Farm,' + avgMothCount + '\n';
    csvContent += 'Total Predicted Larva Density,' + totalLarvaDensity.toFixed(2) + '\n';
    csvContent += 'Average Larva Density per Farm,' + avgLarvaDensity + '\n\n';

    csvContent += '=== HISTORICAL TRENDS (' + days + ' days) ===\n';
    csvContent += 'Total Readings Collected,' + (readings?.length || 0) + '\n';
    csvContent += 'Historical Moth Count Total,' + historicalMothTotal + '\n';
    csvContent += 'Historical Moth Count Average,' + historicalAvgMoth + '\n';
    csvContent += 'Historical Larva Density Total,' + historicalLarvaTotal.toFixed(2) + '\n';
    csvContent += 'Historical Larva Density Average,' + historicalAvgLarva + '\n\n';

    // Section 2: Current Farm Status (matches dashboard view)
    csvContent += '=== CURRENT FARM STATUS ===\n';
    csvContent += 'Farm_ID,Longitude,Latitude,Last Moth Count,Last Temperature,Predicted Larva Density,Farm Status,Last Updated\n';

    farms?.forEach(farm => {
      // ipm_alerts is an array, get the first one
      const alert = Array.isArray(farm.ipm_alerts) ? farm.ipm_alerts[0] : farm.ipm_alerts;
      const alertLevel = alert?.alert_level || 'Green';
      const farmStatus = getStatusText(alertLevel);
      const lastUpdated = alert?.last_updated 
        ? new Date(alert.last_updated).toLocaleString() 
        : 'N/A';
      
      csvContent += `${farm.farm_name},${farm.longitude},${farm.latitude},${alert?.last_moth_count || 0},${alert?.last_temperature || ''},${alert?.last_larva_density || ''},${farmStatus},${lastUpdated}\n`;
    });

    csvContent += '\n';

    // Section 3: Historical Readings (if available)
    if (readings && readings.length > 0) {
      csvContent += '=== HISTORICAL PEST READINGS ===\n';
      csvContent += 'Date,Time,Farm_ID,Longitude,Latitude,Moth Count,Temperature,Predicted Larva Density,Farm Status\n';
      
      readings.forEach((reading: any) => {
        const farmName = reading.farm_name || 'Unknown';
        const longitude = reading.longitude || '';
        const latitude = reading.latitude || '';
        const alertLevel = reading.alert_level || 'Unknown';
        const farmStatus = getStatusText(alertLevel);
        const larvaDensity = reading.larva_density !== null ? reading.larva_density : '';
        
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
    } else {
      csvContent += '=== HISTORICAL PEST READINGS ===\n';
      csvContent += 'No historical readings available for the selected period.\n';
      csvContent += 'Note: Data is collected in real-time via MQTT. Current farm status is shown above.\n';
    }

    console.log('CSV analytics report generated successfully');
    console.log(`Report contains ${farms?.length || 0} farms and ${readings?.length || 0} historical readings`);

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
