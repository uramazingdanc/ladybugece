import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Email Alert Function
 * 
 * This function sends email alerts with PDF reports when farms reach RED alert status.
 * It can be triggered manually or automatically via database webhooks.
 */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Alert email function invoked');

    const { farm_id, alert_level } = await req.json();

    // Validate inputs
    if (!farm_id || !alert_level) {
      return new Response(
        JSON.stringify({ error: 'Missing farm_id or alert_level' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only send emails for RED alerts
    if (alert_level !== 'Red') {
      console.log(`Alert level is ${alert_level}, not sending email`);
      return new Response(
        JSON.stringify({ message: 'Email only sent for Red alerts' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch farm details
    const { data: farm, error: farmError } = await supabase
      .from('farms')
      .select('*, ipm_alerts(*)')
      .eq('id', farm_id)
      .single();

    if (farmError || !farm) {
      console.error('Farm not found:', farmError);
      return new Response(
        JSON.stringify({ error: 'Farm not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch recent readings for this farm
    const { data: readings } = await supabase
      .from('pest_readings')
      .select('*')
      .eq('device_id', farm_id)
      .order('created_at', { ascending: false })
      .limit(10);

    // Generate PDF-like HTML report
    const reportHtml = generateReportHtml(farm, readings || []);

    // Send email if Resend API key is configured
    if (resendApiKey) {
      await sendEmail(resendApiKey, farm, reportHtml);
      console.log('Alert email sent successfully');
    } else {
      console.warn('RESEND_API_KEY not configured, skipping email');
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Alert processed',
        farm_name: farm.farm_name,
        alert_level: alert_level,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-alert-email:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateReportHtml(farm: any, readings: any[]): string {
  const latestReading = readings[0];
  const timestamp = new Date().toISOString();

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #dc2626; color: white; padding: 20px; border-radius: 8px; }
        .alert-badge { background: #dc2626; color: white; padding: 8px 16px; border-radius: 4px; display: inline-block; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
        .data-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .label { font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f5f5f5; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🚨 HIGH RISK ALERT - IMMEDIATE ACTION REQUIRED</h1>
        <p>LADYBUG Onion Armyworm Monitoring System</p>
      </div>

      <div class="section">
        <h2>Alert Summary</h2>
        <div class="data-row">
          <span class="label">Alert Level:</span>
          <span class="alert-badge">RED - HIGH RISK</span>
        </div>
        <div class="data-row">
          <span class="label">Farm Name:</span>
          <span>${farm.farm_name}</span>
        </div>
        <div class="data-row">
          <span class="label">Location:</span>
          <span>${farm.latitude}°N, ${farm.longitude}°E</span>
        </div>
        <div class="data-row">
          <span class="label">Report Generated:</span>
          <span>${new Date(timestamp).toLocaleString()}</span>
        </div>
      </div>

      <div class="section">
        <h2>Current Status</h2>
        ${latestReading ? `
          <div class="data-row">
            <span class="label">Moth Count:</span>
            <span>${latestReading.moth_count} moths</span>
          </div>
          <div class="data-row">
            <span class="label">Temperature:</span>
            <span>${latestReading.temperature}°C</span>
          </div>
          ${latestReading.degree_days ? `
            <div class="data-row">
              <span class="label">Degree Days:</span>
              <span>${latestReading.degree_days}</span>
            </div>
          ` : ''}
          <div class="data-row">
            <span class="label">Last Updated:</span>
            <span>${new Date(latestReading.created_at).toLocaleString()}</span>
          </div>
        ` : '<p>No recent readings available</p>'}
      </div>

      <div class="section">
        <h2>Recent Readings History</h2>
        <table>
          <thead>
            <tr>
              <th>Date/Time</th>
              <th>Moth Count</th>
              <th>Temperature</th>
              <th>Degree Days</th>
            </tr>
          </thead>
          <tbody>
            ${readings.slice(0, 10).map(reading => `
              <tr>
                <td>${new Date(reading.created_at).toLocaleString()}</td>
                <td>${reading.moth_count}</td>
                <td>${reading.temperature}°C</td>
                <td>${reading.degree_days || 'N/A'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="section">
        <h2>Recommended Actions</h2>
        <ul>
          <li><strong>Immediate inspection</strong> of the affected farm area</li>
          <li><strong>Deploy pest control measures</strong> according to IPM guidelines</li>
          <li><strong>Monitor adjacent farms</strong> for potential spread</required>
          <li><strong>Coordinate with local agricultural office</strong> for support</li>
          <li><strong>Update intervention records</strong> in the system</li>
        </ul>
      </div>

      <div class="section">
        <p style="color: #666; font-size: 12px;">
          This is an automated alert from the LADYBUG (Onion Armyworm Monitoring System).
          For more information, visit the dashboard at your deployment URL.
        </p>
      </div>
    </body>
    </html>
  `;
}

async function sendEmail(apiKey: string, farm: any, htmlContent: string) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'LADYBUG Alert System <onboarding@resend.dev>',
      to: ['government@example.com'], // Configure recipient email
      subject: `🚨 RED ALERT: ${farm.farm_name} - Immediate Action Required`,
      html: htmlContent,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send email: ${error}`);
  }

  return await response.json();
}
