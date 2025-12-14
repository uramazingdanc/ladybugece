import { useState, useEffect, useCallback, useRef } from 'react';

interface TrapData {
  moth_count?: number;
  temperature?: number;
  status?: number;
  latitude?: number;
  longitude?: number;
  last_updated?: string;
}

interface MqttMessage {
  type: 'mqtt_message' | 'initial_state';
  topic?: string;
  trapId?: string;
  data?: TrapData;
  traps?: Record<string, TrapData>;
  timestamp: string;
}

interface UseMqttWebSocketReturn {
  traps: Record<string, TrapData>;
  isConnected: boolean;
  error: string | null;
  reconnect: () => void;
  sendTestMessage: (trapId: string, status: string, location?: string) => void;
}

const WEBSOCKET_URL = 'wss://hncumnbxaucdvjcnfptq.functions.supabase.co/functions/v1/mqtt-websocket';

export function useMqttWebSocket(): UseMqttWebSocketReturn {
  const [traps, setTraps] = useState<Record<string, TrapData>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    console.log('Connecting to MQTT WebSocket bridge...');
    setError(null);

    try {
      const ws = new WebSocket(WEBSOCKET_URL);

      ws.onopen = () => {
        console.log('Connected to MQTT WebSocket bridge');
        setIsConnected(true);
        setError(null);

        // Subscribe to all trap topics
        ws.send(JSON.stringify({
          type: 'subscribe',
          topics: ['ladybug/+/status', 'ladybug/+/location']
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message: MqttMessage = JSON.parse(event.data);
          console.log('Received MQTT message:', message);

          if (message.type === 'initial_state' && message.traps) {
            setTraps(message.traps);
          } else if (message.type === 'mqtt_message' && message.trapId && message.data) {
            setTraps(prev => ({
              ...prev,
              [message.trapId!]: {
                ...prev[message.trapId!],
                ...message.data
              }
            }));
          }
        } catch (e) {
          console.error('Error parsing MQTT message:', e);
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        wsRef.current = null;

        // Attempt to reconnect after 5 seconds
        if (!event.wasClean) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('Attempting to reconnect...');
            connect();
          }, 5000);
        }
      };

      ws.onerror = (e) => {
        console.error('WebSocket error:', e);
        setError('Connection error. Retrying...');
      };

      wsRef.current = ws;
    } catch (e) {
      console.error('Failed to create WebSocket:', e);
      setError('Failed to connect to MQTT bridge');
    }
  }, []);

  const reconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    connect();
  }, [connect]);

  // Send test message (for development/testing)
  const sendTestMessage = useCallback((trapId: string, status: string, location?: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // Send status message
      wsRef.current.send(JSON.stringify({
        type: 'mqtt_data',
        topic: `ladybug/${trapId}/status`,
        payload: status
      }));

      // Send location if provided
      if (location) {
        wsRef.current.send(JSON.stringify({
          type: 'mqtt_data',
          topic: `ladybug/${trapId}/location`,
          payload: location
        }));
      }
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return {
    traps,
    isConnected,
    error,
    reconnect,
    sendTestMessage
  };
}

// Helper function to convert status number to alert level
export function statusToAlertLevel(status?: number): 'Green' | 'Yellow' | 'Red' {
  switch (status) {
    case 1: return 'Green';
    case 2: return 'Yellow';
    case 3: return 'Red';
    default: return 'Green';
  }
}

// Helper function to get status label
export function getStatusLabel(status?: number): string {
  switch (status) {
    case 1: return 'Safe';
    case 2: return 'Moderate';
    case 3: return 'High Risk';
    default: return 'Unknown';
  }
}
