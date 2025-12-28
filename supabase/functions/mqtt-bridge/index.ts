import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * MQTT Bridge - Multi-Source HTTP Receiver
 * 
 * This function receives HTTP POST requests from:
 * 1. EMQX Cloud's webhook
 * 2. Mosquitto bridge script (for SIM800 devices via test.mosquitto.org)
 * 3. Any HTTP client sending the expected JSON format
 * 
 * Handles two topic types:
 * - ladybug/trap{n}/status - CSV format: moth_count,temperature,status_code
 * - ladybug/trap{n}/location - CSV format: latitude,longitude
 * 
 * Architecture Options:
 * A) ESP Devices → EMQX Cloud → HTTP Webhook → This Function → Database
 * B) SIM800 → test.mosquitto.org → Bridge Script → This Function → Database
 */

// Request logging helper
function logRequest(source: string, data: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${source}] Request received:`, JSON.stringify(data));
}

function logSuccess(source: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${source}] ✓ ${message}`, data ? JSON.stringify(data) : '');
}

function logError(source: string, message: string, error?: any) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [${source}] ✗ ${message}`, error ? JSON.stringify(error) : '');
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Status code to alert level mapping
function statusCodeToAlertLevel(statusCode: number): 'Green' | 'Yellow' | 'Red' {
  switch (statusCode) {
    case 1: return 'Green';  // Safe
    case 2: return 'Yellow'; // Moderate
    case 3: return 'Red';    // High Risk
    default: return 'Green';
  }
}

// Parse topic to extract device_id and message type
function parseTopic(topic: string): { device_id: string; messageType: 'status' | 'location' } | null {
  // Expected format: ladybug/trap1/status or ladybug/trap1/location
  const parts = topic.toLowerCase().split('/');
  
  if (parts.length !== 3 || parts[0] !== 'ladybug') {
    logError('PARSER', `Invalid topic format: ${topic}`, { expected: 'ladybug/{device_id}/status or location' });
    return null;
  }
  
  const device_id = parts[1]; // e.g., "trap1"
  const messageType = parts[2] as 'status' | 'location';
  
  if (messageType !== 'status' && messageType !== 'location') {
    logError('PARSER', `Unknown message type: ${messageType}`, { validTypes: ['status', 'location'] });
    return null;
  }
  
  return { device_id, messageType };
}

// Parse status CSV payload: moth_count,temperature,status_code
function parseStatusPayload(payload: string): { moth_count: number; temperature: number; status: number } | null {
  const parts = payload.trim().split(',');
  
  if (parts.length !== 3) {
    console.error('Invalid status payload format:', payload);
    return null;
  }
  
  const moth_count = parseInt(parts[0], 10);
  const temperature = parseFloat(parts[1]);
  const status = parseInt(parts[2], 10);
  
  if (isNaN(moth_count) || isNaN(temperature) || isNaN(status)) {
    console.error('Invalid numeric values in status payload:', payload);
    return null;
  }
  
  return { moth_count, temperature, status };
}

// Parse location CSV payload: latitude,longitude
function parseLocationPayload(payload: string): { latitude: number; longitude: number } | null {
  const parts = payload.trim().split(',');
  
  if (parts.length !== 2) {
    console.error('Invalid location payload format:', payload);
    return null;
  }
  
  const latitude = parseFloat(parts[0]);
  const longitude = parseFloat(parts[1]);
  
  if (isNaN(latitude) || isNaN(longitude)) {
    console.error('Invalid numeric values in location payload:', payload);
    return null;
  }
  
  return { latitude, longitude };
}

// Handle status message - forward to ingest-data
async function handleStatusMessage(device_id: string, data: { moth_count: number; temperature: number; status: number }) {
  const alert_level = statusCodeToAlertLevel(data.status);
  
  logSuccess('STATUS', `Processing for ${device_id}`, { 
    moths: data.moth_count, 
    temp: data.temperature, 
    status: data.status, 
    alertLevel: alert_level 
  });
  
  const { data: response, error } = await supabase.functions.invoke('ingest-data', {
    body: {
      device_id,
      moth_count: data.moth_count,
      temperature: data.temperature,
      alert_level
    }
  });
  
  if (error) {
    logError('STATUS', `Failed to call ingest-data for ${device_id}`, error);
    return { success: false, error };
  }
  
  logSuccess('STATUS', `Data ingested for ${device_id}`, response);
  return { success: true, data: response };
}

// Handle location message - update farm coordinates
async function handleLocationMessage(device_id: string, location: { latitude: number; longitude: number }) {
  logSuccess('LOCATION', `Processing for ${device_id}`, { lat: location.latitude, lng: location.longitude });
  
  // Find the device and its associated farm
  const { data: device, error: deviceError } = await supabase
    .from('devices')
    .select('farm_id')
    .eq('id', device_id)
    .maybeSingle();
  
  if (deviceError) {
    logError('LOCATION', `Failed to find device ${device_id}`, deviceError);
    return { success: false, error: deviceError };
  }
  
  if (!device) {
    logError('LOCATION', `Device ${device_id} not found in database`, { suggestion: 'Register the device first' });
    return { success: false, error: 'Device not found' };
  }
  
  // Update the farm's coordinates
  const { error: updateError } = await supabase
    .from('farms')
    .update({
      latitude: location.latitude,
      longitude: location.longitude,
      updated_at: new Date().toISOString()
    })
    .eq('id', device.farm_id);
  
  if (updateError) {
    logError('LOCATION', `Failed to update farm location for ${device_id}`, updateError);
    return { success: false, error: updateError };
  }
  
  logSuccess('LOCATION', `Farm location updated for device ${device_id}`, { farmId: device.farm_id });
  return { success: true };
}

// Process incoming webhook/bridge message
async function processMessage(payload: any, source: string = 'WEBHOOK') {
  try {
    const { topic, payload: messagePayload } = payload;
    
    // Handle legacy JSON format (backward compatibility)
    if (!topic && payload.device_id) {
      logRequest(`${source}/LEGACY`, payload);
      return handleLegacyMessage(payload);
    }
    
    if (!topic || messagePayload === undefined) {
      logError(source, 'Missing topic or payload', payload);
      return { success: false, error: 'Missing topic or payload' };
    }
    
    logRequest(source, { topic, payload: messagePayload });
    
    // Parse topic
    const topicInfo = parseTopic(topic);
    if (!topicInfo) {
      return { success: false, error: 'Invalid topic format' };
    }
    
    const { device_id, messageType } = topicInfo;
    logSuccess(source, `Parsed: device=${device_id}, type=${messageType}`);
    
    // Process based on message type
    if (messageType === 'status') {
      const statusData = parseStatusPayload(messagePayload);
      if (!statusData) {
        return { success: false, error: 'Invalid status payload format' };
      }
      return handleStatusMessage(device_id, statusData);
    } else if (messageType === 'location') {
      const locationData = parseLocationPayload(messagePayload);
      if (!locationData) {
        return { success: false, error: 'Invalid location payload format' };
      }
      return handleLocationMessage(device_id, locationData);
    }
    
    return { success: false, error: 'Unknown message type' };
  } catch (error) {
    logError(source, 'Error processing message', error);
    return { success: false, error: String(error) };
  }
}

// Handle legacy JSON format for backward compatibility
async function handleLegacyMessage(payload: any) {
  const { 
    device_id, 
    moth_count, 
    temperature_c, 
    temperature,
    computed_degree_days, 
    degree_days,
    computed_status 
  } = payload;

  logSuccess('LEGACY', `Processing for ${device_id}`, payload);

  let alert_level = null;
  if (computed_status) {
    const statusLower = computed_status.toLowerCase();
    if (statusLower.includes('red')) {
      alert_level = 'Red';
    } else if (statusLower.includes('yellow')) {
      alert_level = 'Yellow';
    } else if (statusLower.includes('green')) {
      alert_level = 'Green';
    }
  }

  const temp = temperature_c || temperature || 0;
  const degDays = computed_degree_days || degree_days;

  if (!device_id) {
    logError('LEGACY', 'Missing device_id in payload');
    return { success: false, error: 'Missing device_id' };
  }

  const { data: response, error } = await supabase.functions.invoke('ingest-data', {
    body: {
      device_id,
      moth_count: moth_count || 0,
      temperature: temp,
      degree_days: degDays,
      alert_level
    }
  });

  if (error) {
    logError('LEGACY', `Failed to call ingest-data for ${device_id}`, error);
    return { success: false, error };
  }

  logSuccess('LEGACY', `Data ingested for ${device_id}`, response);
  return { success: true, data: response };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Determine source from headers or user-agent
  const userAgent = req.headers.get('user-agent') || '';
  const source = userAgent.includes('python') ? 'MOSQUITTO-BRIDGE' : 
                 userAgent.includes('curl') ? 'CURL-TEST' : 
                 'WEBHOOK';

  try {
    const payload = await req.json();
    logRequest(source, payload);
    
    const result = await processMessage(payload, source);

    return new Response(
      JSON.stringify(result),
      { 
        status: result.success ? 200 : 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    logError(source, 'Handler error', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Failed to process request',
        details: String(error)
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
