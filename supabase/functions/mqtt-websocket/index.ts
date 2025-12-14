import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

/**
 * MQTT WebSocket Bridge
 * 
 * This edge function acts as a WebSocket server that:
 * 1. Connects to MQTT broker (EMQX/HiveMQ) via WebSocket
 * 2. Subscribes to ladybug/trap{n}/status and ladybug/trap{n}/location topics
 * 3. Forwards messages to connected browser clients
 * 4. Also ingests data into Supabase database
 * 
 * Topic formats:
 * - ladybug/trap{n}/status: moth_count,temperature,status (e.g., "5,37,1")
 *   Status: 1=Safe(Green), 2=Moderate(Yellow), 3=High Risk(Red)
 * - ladybug/trap{n}/location: latitude,longitude (e.g., "32.30642,-122.61458")
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Store for connected WebSocket clients
const connectedClients = new Set<WebSocket>();

// Store for trap data (combines status and location)
const trapData: Record<string, {
  moth_count?: number;
  temperature?: number;
  status?: number;
  latitude?: number;
  longitude?: number;
  last_updated?: string;
}> = {};

// Map status code to alert level
function statusToAlertLevel(status: number): 'Green' | 'Yellow' | 'Red' {
  switch (status) {
    case 1: return 'Green';  // Safe
    case 2: return 'Yellow'; // Moderate
    case 3: return 'Red';    // High Risk
    default: return 'Green';
  }
}

// Parse status message: "moth_count,temperature,status"
function parseStatusMessage(message: string): { moth_count: number; temperature: number; status: number } | null {
  try {
    const parts = message.trim().split(',');
    if (parts.length !== 3) return null;
    
    return {
      moth_count: parseInt(parts[0], 10),
      temperature: parseFloat(parts[1]),
      status: parseInt(parts[2], 10)
    };
  } catch (e) {
    console.error('Error parsing status message:', e);
    return null;
  }
}

// Parse location message: "latitude,longitude"
function parseLocationMessage(message: string): { latitude: number; longitude: number } | null {
  try {
    const parts = message.trim().split(',');
    if (parts.length !== 2) return null;
    
    return {
      latitude: parseFloat(parts[0]),
      longitude: parseFloat(parts[1])
    };
  } catch (e) {
    console.error('Error parsing location message:', e);
    return null;
  }
}

// Extract trap ID from topic (e.g., "ladybug/trap1/status" -> "trap1")
function extractTrapId(topic: string): string | null {
  const match = topic.match(/ladybug\/(trap\d+)\/(status|location)/);
  return match ? match[1] : null;
}

// Process incoming MQTT message
async function processMqttMessage(topic: string, message: string) {
  console.log(`MQTT message received - Topic: ${topic}, Message: ${message}`);
  
  const trapId = extractTrapId(topic);
  if (!trapId) {
    console.error('Could not extract trap ID from topic:', topic);
    return;
  }

  // Initialize trap data if needed
  if (!trapData[trapId]) {
    trapData[trapId] = {};
  }

  const isStatus = topic.endsWith('/status');
  const isLocation = topic.endsWith('/location');

  if (isStatus) {
    const statusData = parseStatusMessage(message);
    if (statusData) {
      trapData[trapId].moth_count = statusData.moth_count;
      trapData[trapId].temperature = statusData.temperature;
      trapData[trapId].status = statusData.status;
      trapData[trapId].last_updated = new Date().toISOString();

      // Ingest data into database
      await ingestTrapData(trapId, statusData);
    }
  } else if (isLocation) {
    const locationData = parseLocationMessage(message);
    if (locationData) {
      trapData[trapId].latitude = locationData.latitude;
      trapData[trapId].longitude = locationData.longitude;
      
      // Update farm location in database
      await updateTrapLocation(trapId, locationData);
    }
  }

  // Broadcast to all connected clients
  broadcastToClients({
    type: 'mqtt_message',
    topic,
    trapId,
    data: trapData[trapId],
    timestamp: new Date().toISOString()
  });
}

// Ingest trap status data into database
async function ingestTrapData(trapId: string, data: { moth_count: number; temperature: number; status: number }) {
  try {
    // Check if device exists
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('id, farm_id')
      .eq('id', trapId)
      .single();

    if (deviceError || !device) {
      console.log(`Device ${trapId} not found, skipping ingestion`);
      return;
    }

    // Insert pest reading
    const { error: readingError } = await supabase
      .from('pest_readings')
      .insert({
        device_id: trapId,
        moth_count: data.moth_count,
        temperature: data.temperature
      });

    if (readingError) {
      console.error('Error inserting reading:', readingError);
      return;
    }

    // Update alert level
    const alertLevel = statusToAlertLevel(data.status);
    const { error: alertError } = await supabase
      .from('ipm_alerts')
      .upsert({
        farm_id: device.farm_id,
        alert_level: alertLevel,
        last_moth_count: data.moth_count,
        last_temperature: data.temperature,
        last_updated: new Date().toISOString()
      }, {
        onConflict: 'farm_id'
      });

    if (alertError) {
      console.error('Error updating alert:', alertError);
    } else {
      console.log(`Data ingested for ${trapId}, alert level: ${alertLevel}`);
    }

  } catch (error) {
    console.error('Error in ingestTrapData:', error);
  }
}

// Update trap/farm location in database
async function updateTrapLocation(trapId: string, location: { latitude: number; longitude: number }) {
  try {
    const { data: device } = await supabase
      .from('devices')
      .select('farm_id')
      .eq('id', trapId)
      .single();

    if (device) {
      const { error } = await supabase
        .from('farms')
        .update({
          latitude: location.latitude,
          longitude: location.longitude,
          updated_at: new Date().toISOString()
        })
        .eq('id', device.farm_id);

      if (error) {
        console.error('Error updating farm location:', error);
      } else {
        console.log(`Location updated for ${trapId}`);
      }
    }
  } catch (error) {
    console.error('Error in updateTrapLocation:', error);
  }
}

// Broadcast message to all connected WebSocket clients
function broadcastToClients(message: object) {
  const messageStr = JSON.stringify(message);
  for (const client of connectedClients) {
    try {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    } catch (e) {
      console.error('Error sending to client:', e);
    }
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const { headers } = req;
  const upgradeHeader = headers.get('upgrade') || '';

  // Check if this is a WebSocket upgrade request
  if (upgradeHeader.toLowerCase() === 'websocket') {
    const { socket, response } = Deno.upgradeWebSocket(req);

    socket.onopen = () => {
      console.log('Client connected');
      connectedClients.add(socket);
      
      // Send current trap data to new client
      socket.send(JSON.stringify({
        type: 'initial_state',
        traps: trapData,
        timestamp: new Date().toISOString()
      }));
    };

    socket.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        
        // Handle messages from browser clients
        if (message.type === 'subscribe') {
          console.log('Client subscribed to topics:', message.topics);
        } else if (message.type === 'mqtt_data') {
          // Allow browser to forward MQTT data (for testing or external MQTT client)
          await processMqttMessage(message.topic, message.payload);
        }
      } catch (e) {
        console.error('Error processing client message:', e);
      }
    };

    socket.onclose = () => {
      console.log('Client disconnected');
      connectedClients.delete(socket);
    };

    socket.onerror = (e) => {
      console.error('WebSocket error:', e);
    };

    return response;
  }

  // Handle HTTP POST for direct MQTT webhook integration
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      console.log('Received HTTP POST:', body);
      
      // Handle EMQX webhook format
      if (body.topic && body.payload) {
        await processMqttMessage(body.topic, body.payload);
        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Handle direct format (topic and message in body)
      if (body.topic && body.message) {
        await processMqttMessage(body.topic, body.message);
        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Invalid payload format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      console.error('Error processing POST:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to process request' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // Return info for GET requests
  return new Response(
    JSON.stringify({
      service: 'MQTT WebSocket Bridge',
      description: 'Connect via WebSocket to receive real-time trap data',
      topics: [
        'ladybug/trap{n}/status - Format: moth_count,temperature,status',
        'ladybug/trap{n}/location - Format: latitude,longitude'
      ],
      status_legend: {
        1: 'Safe (Green)',
        2: 'Moderate (Yellow)', 
        3: 'High Risk (Red)'
      },
      connected_clients: connectedClients.size,
      active_traps: Object.keys(trapData)
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
