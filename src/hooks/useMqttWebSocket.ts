import { useState, useEffect, useCallback, useRef } from 'react';
import mqtt, { MqttClient } from 'mqtt';

interface TrapData {
  moth_count?: number;
  temperature?: number;
  status?: number;
  latitude?: number;
  longitude?: number;
  last_updated?: string;
}

interface UseMqttWebSocketReturn {
  traps: Record<string, TrapData>;
  isConnected: boolean;
  error: string | null;
  reconnect: () => void;
  sendTestMessage: (trapId: string, status: string, location?: string) => void;
}

// HiveMQ Public Broker WebSocket URL (port 8000 for ws://, 8884 for wss://)
// Note: The public broker doesn't require authentication - it's anonymous access
const HIVEMQ_BROKER_URL = 'wss://broker.hivemq.com:8884/mqtt';

// Topics to subscribe
const TOPICS = ['ladybug/+/status', 'ladybug/+/location'];

export function useMqttWebSocket(): UseMqttWebSocketReturn {
  const [traps, setTraps] = useState<Record<string, TrapData>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<MqttClient | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const parseStatusPayload = (payload: string): { moth_count: number; temperature: number; status: number } | null => {
    try {
      const parts = payload.split(',');
      if (parts.length >= 3) {
        return {
          moth_count: parseInt(parts[0], 10),
          temperature: parseFloat(parts[1]),
          status: parseInt(parts[2], 10)
        };
      }
    } catch (e) {
      console.error('Error parsing status payload:', e);
    }
    return null;
  };

  const parseLocationPayload = (payload: string): { latitude: number; longitude: number } | null => {
    try {
      const parts = payload.split(',');
      if (parts.length >= 2) {
        return {
          latitude: parseFloat(parts[0]),
          longitude: parseFloat(parts[1])
        };
      }
    } catch (e) {
      console.error('Error parsing location payload:', e);
    }
    return null;
  };

  const extractTrapId = (topic: string): string | null => {
    const match = topic.match(/ladybug\/([^/]+)\//);
    return match ? match[1] : null;
  };

  const connect = useCallback(() => {
    // Clean up existing connection
    if (clientRef.current) {
      clientRef.current.end(true);
      clientRef.current = null;
    }

    console.log('Connecting to HiveMQ broker...');
    setError(null);

    try {
      const client = mqtt.connect(HIVEMQ_BROKER_URL, {
        clientId: `ladybug_web_${Math.random().toString(16).substr(2, 8)}`,
        keepalive: 60,
        reconnectPeriod: 5000,
        connectTimeout: 30000,
        clean: true
      });

      client.on('connect', () => {
        console.log('✓ Connected to HiveMQ broker');
        setIsConnected(true);
        setError(null);

        // Subscribe to all trap topics
        TOPICS.forEach(topic => {
          client.subscribe(topic, { qos: 0 }, (err) => {
            if (err) {
              console.error(`Failed to subscribe to ${topic}:`, err);
            } else {
              console.log(`✓ Subscribed to: ${topic}`);
            }
          });
        });
      });

      client.on('message', (topic, message) => {
        const payload = message.toString();
        console.log(`📩 MQTT Message - Topic: ${topic}, Payload: ${payload}`);

        const trapId = extractTrapId(topic);
        if (!trapId) {
          console.warn('Could not extract trap ID from topic:', topic);
          return;
        }

        if (topic.includes('/status')) {
          const statusData = parseStatusPayload(payload);
          if (statusData) {
            setTraps(prev => ({
              ...prev,
              [trapId]: {
                ...prev[trapId],
                ...statusData,
                last_updated: new Date().toISOString()
              }
            }));
          }
        } else if (topic.includes('/location')) {
          const locationData = parseLocationPayload(payload);
          if (locationData) {
            setTraps(prev => ({
              ...prev,
              [trapId]: {
                ...prev[trapId],
                ...locationData,
                last_updated: new Date().toISOString()
              }
            }));
          }
        }
      });

      client.on('close', () => {
        console.log('MQTT connection closed');
        setIsConnected(false);
      });

      client.on('offline', () => {
        console.log('MQTT client offline');
        setIsConnected(false);
      });

      client.on('error', (err) => {
        console.error('MQTT error:', err);
        setError(`Connection error: ${err.message}`);
      });

      client.on('reconnect', () => {
        console.log('Attempting to reconnect to HiveMQ...');
        setError('Reconnecting...');
      });

      clientRef.current = client;
    } catch (e) {
      console.error('Failed to create MQTT client:', e);
      setError('Failed to connect to MQTT broker');
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
    if (clientRef.current && clientRef.current.connected) {
      // Publish status message
      const statusTopic = `ladybug/${trapId}/status`;
      clientRef.current.publish(statusTopic, status, { qos: 0 }, (err) => {
        if (err) {
          console.error('Failed to publish status:', err);
        } else {
          console.log(`✓ Published to ${statusTopic}: ${status}`);
        }
      });

      // Publish location if provided
      if (location) {
        const locationTopic = `ladybug/${trapId}/location`;
        clientRef.current.publish(locationTopic, location, { qos: 0 }, (err) => {
          if (err) {
            console.error('Failed to publish location:', err);
          } else {
            console.log(`✓ Published to ${locationTopic}: ${location}`);
          }
        });
      }
    } else {
      console.warn('MQTT client not connected, cannot send message');
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (clientRef.current) {
        clientRef.current.end(true);
        clientRef.current = null;
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
