import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, TrendingUp, Thermometer, MapPin, Settings, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AlertStatusCard from './AlertStatusCard';
import MothCountChart from './MothCountChart';

interface Farm {
  id: string;
  farm_name: string;
  latitude: number;
  longitude: number;
}

interface AlertData {
  alert_level: 'Green' | 'Yellow' | 'Red';
  last_moth_count: number;
  last_updated: string;
}

interface Reading {
  moth_count: number;
  temperature: number;
  created_at: string;
}

export default function FarmerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedFarm, setSelectedFarm] = useState<Farm | null>(null);
  const [alertData, setAlertData] = useState<AlertData | null>(null);
  const [recentReadings, setRecentReadings] = useState<Reading[]>([]);
  const [latestTemp, setLatestTemp] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchFarms();
    }
  }, [user]);

  useEffect(() => {
    if (selectedFarm) {
      fetchAlertData();
      fetchReadings();
      subscribeToAlerts();
    }
  }, [selectedFarm]);

  const fetchFarms = async () => {
    const { data, error } = await supabase
      .from('farms')
      .select('*')
      .eq('owner_id', user?.id);

    if (data && data.length > 0) {
      setFarms(data);
      setSelectedFarm(data[0]);
    }
    setLoading(false);
  };

  const fetchAlertData = async () => {
    if (!selectedFarm) return;

    const { data } = await supabase
      .from('ipm_alerts')
      .select('*')
      .eq('farm_id', selectedFarm.id)
      .single();

    if (data) {
      setAlertData(data);
    }
  };

  const fetchReadings = async () => {
    if (!selectedFarm) return;

    // Get devices for this farm
    const { data: devices } = await supabase
      .from('devices')
      .select('id')
      .eq('farm_id', selectedFarm.id);

    if (devices && devices.length > 0) {
      const deviceIds = devices.map(d => d.id);

      // Get last 7 days of readings
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: readings } = await supabase
        .from('pest_readings')
        .select('moth_count, temperature, created_at')
        .in('device_id', deviceIds)
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(50);

      if (readings && readings.length > 0) {
        setRecentReadings(readings);
        setLatestTemp(readings[0].temperature);
      }
    }
  };

  const subscribeToAlerts = () => {
    if (!selectedFarm) return;

    const channel = supabase
      .channel('farm-alerts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ipm_alerts',
          filter: `farm_id=eq.${selectedFarm.id}`
        },
        (payload) => {
          setAlertData(payload.new as AlertData);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  if (loading) {
    return <div className="text-center py-12">Loading your farms...</div>;
  }

  if (farms.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">No Farms Yet</h2>
        <p className="text-muted-foreground mb-6 text-lg">Add your first farm to start monitoring</p>
        <Button size="lg" onClick={() => navigate('/manage-farms')} className="gap-2">
          <Plus className="w-5 h-5" />
          Add Farm
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Farm Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">{selectedFarm?.farm_name}</h2>
          <p className="text-muted-foreground flex items-center gap-2 mt-1">
            <MapPin className="w-4 h-4" />
            {selectedFarm?.latitude.toFixed(4)}, {selectedFarm?.longitude.toFixed(4)}
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/manage-farms')} className="gap-2">
          <Settings className="w-4 h-4" />
          Manage Farms
        </Button>
      </div>

      {/* Alert Status */}
      {alertData && <AlertStatusCard alertData={alertData} />}

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Last Moth Count
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-foreground">
              {alertData?.last_moth_count || 0}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              moths detected
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Thermometer className="w-5 h-5 text-accent" />
              Temperature
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-foreground">
              {latestTemp?.toFixed(1) || '--'}°C
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              current reading
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Moth Count Chart */}
      {recentReadings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>7-Day Moth Activity</CardTitle>
            <CardDescription>Track moth population trends over time</CardDescription>
          </CardHeader>
          <CardContent>
            <MothCountChart readings={recentReadings} />
          </CardContent>
        </Card>
      )}

      {/* Community Map Button */}
      <Card className="bg-gradient-to-r from-primary/10 to-crop/10 border-primary/20">
        <CardHeader>
          <CardTitle>Community Monitoring</CardTitle>
          <CardDescription>See infestation levels in your area</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => navigate('/community-map')} size="lg" className="w-full gap-2">
            <MapPin className="w-5 h-5" />
            View Community Map
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
