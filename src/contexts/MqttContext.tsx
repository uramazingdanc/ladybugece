import { createContext, useContext, ReactNode } from 'react';
import { useMqttWebSocket } from '@/hooks/useMqttWebSocket';

interface TrapData {
  moth_count?: number;
  temperature?: number;
  larva_density?: number;
  status?: number;
  latitude?: number;
  longitude?: number;
  last_updated?: string;
}

interface MqttContextValue {
  traps: Record<string, TrapData>;
  isConnected: boolean;
  error: string | null;
  reconnect: () => void;
  sendTestMessage: (trapId: string, status: string, location?: string) => void;
}

const MqttContext = createContext<MqttContextValue | null>(null);

export function MqttProvider({ children }: { children: ReactNode }) {
  const mqttState = useMqttWebSocket();

  return (
    <MqttContext.Provider value={mqttState}>
      {children}
    </MqttContext.Provider>
  );
}

export function useMqttContext(): MqttContextValue {
  const context = useContext(MqttContext);
  if (!context) {
    throw new Error('useMqttContext must be used within a MqttProvider');
  }
  return context;
}
