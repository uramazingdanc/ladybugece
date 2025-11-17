import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, LayerGroup } from 'react-leaflet';
import { supabase } from '@/integrations/supabase/client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';

// Fix for default marker icons in React-Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom colored markers for alert levels
const createColoredIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background-color: ${color};
      width: 30px;
      height: 30px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
};

const greenIcon = createColoredIcon('hsl(142, 76%, 36%)');
const yellowIcon = createColoredIcon('hsl(48, 96%, 53%)');
const redIcon = createColoredIcon('hsl(0, 84%, 60%)');

interface Farm {
  id: string;
  farm_name: string;
  latitude: number;
  longitude: number;
  alert_level?: 'Green' | 'Yellow' | 'Red';
  last_moth_count?: number;
  last_updated?: string;
}


function MapContent({ farms, getMarkerIcon, getAlertColor }: { 
  farms: Farm[], 
  getMarkerIcon: (alertLevel?: string) => L.DivIcon,
  getAlertColor: (alertLevel?: string) => string 
}) {
  return (
    <>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={20}
      />
      {farms.map((farm) => (
        <Marker
          key={farm.id}
          position={[farm.latitude, farm.longitude]}
          icon={getMarkerIcon(farm.alert_level)}
        >
          <Popup>
            <div className="p-2">
              <h3 className="font-bold text-lg mb-2">{farm.farm_name}</h3>
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Status:</span>
                  <span
                    className="px-2 py-1 rounded text-white font-medium"
                    style={{ backgroundColor: getAlertColor(farm.alert_level) }}
                  >
                    {farm.alert_level}
                  </span>
                </div>
                {farm.last_moth_count !== undefined && (
                  <div>
                    <span className="font-semibold">Moth Count:</span> {farm.last_moth_count}
                  </div>
                )}
                {farm.last_updated && (
                  <div>
                    <span className="font-semibold">Last Updated:</span>{' '}
                    {new Date(farm.last_updated).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}

export default function FarmMap() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([12.8797, 121.7740]); // Central Philippines

  useEffect(() => {
    fetchFarms();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel('ipm_alerts_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ipm_alerts'
        },
        () => {
          fetchFarms();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchFarms = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data: farmsData, error: farmsError } = await supabase
        .from('farms')
        .select('*');

      if (farmsError) throw farmsError;

      // Fetch alert data for each farm
      const { data: alertsData } = await supabase
        .from('ipm_alerts')
        .select('*');

      const farmsWithAlerts = (farmsData || []).map(farm => {
        const alert = alertsData?.find(a => a.farm_id === farm.id);
        return {
          ...farm,
          alert_level: alert?.alert_level || 'Green',
          last_moth_count: alert?.last_moth_count,
          last_updated: alert?.last_updated,
        };
      });

      setFarms(farmsWithAlerts);
      
      // Center map on first farm if available
      if (farmsWithAlerts.length > 0) {
        setMapCenter([farmsWithAlerts[0].latitude, farmsWithAlerts[0].longitude]);
      }
    } catch (error) {
      console.error('Error fetching farms:', error);
      setError(error instanceof Error ? error.message : 'Failed to load farm data');
    } finally {
      setLoading(false);
    }
  };

  const getMarkerIcon = (alertLevel?: string) => {
    switch (alertLevel) {
      case 'Red':
        return redIcon;
      case 'Yellow':
        return yellowIcon;
      default:
        return greenIcon;
    }
  };

  const getAlertColor = (alertLevel?: string) => {
    switch (alertLevel) {
      case 'Red':
        return 'hsl(0, 84%, 60%)';
      case 'Yellow':
        return 'hsl(48, 96%, 53%)';
      default:
        return 'hsl(142, 76%, 36%)';
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-muted/30">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Loading map...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-muted/30 p-4">
        <Card className="p-8 text-center max-w-md">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">
                Failed to Load Map
              </h3>
              <p className="text-sm text-muted-foreground">
                {error}
              </p>
            </div>
            <Button onClick={fetchFarms} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Retry
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <div>
            <h3 className="text-xl font-semibold">Interactive Farm Map</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time overview of pest alert levels across all monitored farms
            </p>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="overflow-hidden">
            <MapContainer
              key={`${mapCenter[0]}-${mapCenter[1]}`}
              center={mapCenter}
              zoom={7}
              scrollWheelZoom={true}
              style={{ height: '600px', width: '100%' }}
              className="z-0"
            >
              <MapContent farms={farms} getMarkerIcon={getMarkerIcon} getAlertColor={getAlertColor} />
            </MapContainer>
          </div>

          {/* Legend */}
          <div className="px-6 py-4 border-t bg-card flex justify-start gap-8 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-alert-green"></div>
              <span className="text-muted-foreground">Low Risk</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-alert-yellow"></div>
              <span className="text-muted-foreground">Medium Risk</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-alert-red"></div>
              <span className="text-muted-foreground">High Risk</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
