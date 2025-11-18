import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Activity, Wifi, WifiOff, Thermometer } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface DeviceReading {
  id: number;
  device_id: string;
  moth_count: number;
  temperature: number;
  degree_days: number | null;
  created_at: string;
}

interface Device {
  id: string;
  device_name: string;
  farm_id: string;
  farms?: {
    farm_name: string;
  };
}

interface DeviceStatus extends Device {
  lastReading?: DeviceReading;
  isOnline: boolean;
}

export default function DeviceMonitor() {
  const [devices, setDevices] = useState<DeviceStatus[]>([]);
  const [realtimeReadings, setRealtimeReadings] = useState<Record<string, DeviceReading>>({});

  useEffect(() => {
    fetchDevices();

    // Subscribe to real-time pest_readings updates
    const channel = supabase
      .channel('device-monitor')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pest_readings'
        },
        (payload) => {
          console.log('Real-time reading received:', payload);
          const newReading = payload.new as DeviceReading;
          setRealtimeReadings(prev => ({
            ...prev,
            [newReading.device_id]: newReading
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchDevices = async () => {
    const { data: devicesData } = await supabase
      .from('devices')
      .select('*, farms(farm_name)');

    if (devicesData) {
      // Fetch last reading for each device
      const devicesWithStatus = await Promise.all(
        devicesData.map(async (device) => {
          const { data: lastReading } = await supabase
            .from('pest_readings')
            .select('*')
            .eq('device_id', device.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          const isOnline = lastReading 
            ? (new Date().getTime() - new Date(lastReading.created_at).getTime()) < 300000 // 5 minutes
            : false;

          return {
            ...device,
            lastReading: lastReading || undefined,
            isOnline
          };
        })
      );

      setDevices(devicesWithStatus);
    }
  };

  // Merge real-time readings with device data
  const devicesWithLiveData = devices.map(device => {
    const liveReading = realtimeReadings[device.id];
    if (liveReading) {
      return {
        ...device,
        lastReading: liveReading,
        isOnline: true
      };
    }
    return device;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="h-5 w-5 text-primary" />
        <h2 className="text-2xl font-bold">Live Device Monitoring</h2>
        <Badge variant="outline" className="ml-auto">
          <span className="relative flex h-2 w-2 mr-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          Real-time
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {devicesWithLiveData.map((device) => (
          <Card key={device.id} className="relative overflow-hidden">
            {realtimeReadings[device.id] && (
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 to-blue-500 animate-pulse" />
            )}
            
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{device.device_name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {device.farms?.farm_name || 'Unknown Farm'}
                  </p>
                </div>
                {device.isOnline ? (
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                    <Wifi className="w-3 h-3 mr-1" />
                    Online
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-gray-500/10 text-gray-600 border-gray-500/20">
                    <WifiOff className="w-3 h-3 mr-1" />
                    Offline
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent>
              {device.lastReading ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-primary/5 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Moth Count</p>
                      <p className="text-2xl font-bold text-primary">
                        {device.lastReading.moth_count}
                      </p>
                    </div>
                    <div className="bg-secondary/5 rounded-lg p-3">
                      <div className="flex items-center gap-1">
                        <Thermometer className="w-3 h-3" />
                        <p className="text-xs text-muted-foreground">Temp</p>
                      </div>
                      <p className="text-2xl font-bold">
                        {device.lastReading.temperature.toFixed(1)}°C
                      </p>
                    </div>
                  </div>

                  {device.lastReading.degree_days !== null && (
                    <div className="bg-accent/5 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Degree-Days (Edge Computed)</p>
                      <p className="text-xl font-bold text-accent">
                        {device.lastReading.degree_days.toFixed(1)}
                      </p>
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground pt-2 border-t">
                    Last reading: {formatDistanceToNow(new Date(device.lastReading.created_at), { addSuffix: true })}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No readings yet
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {devicesWithLiveData.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No devices registered yet</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
