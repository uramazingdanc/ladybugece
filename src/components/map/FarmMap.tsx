import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { supabase } from '@/integrations/supabase/client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

function MapRecenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function FarmMap() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapCenter, setMapCenter] = useState<[number, number]>([14.5995, 120.9842]); // Manila default

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
        <p className="text-muted-foreground">Loading map...</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative">
      <MapContainer
        center={mapCenter}
        zoom={13}
        scrollWheelZoom={true}
        className="h-full w-full rounded-lg"
        style={{ background: 'hsl(var(--muted))' }}
      >
        <MapRecenter center={mapCenter} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-card border border-border rounded-lg shadow-lg p-4 z-[1000]">
        <h4 className="font-semibold mb-2 text-sm">Legend</h4>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: 'hsl(142, 76%, 36%)' }}></div>
            <span>Safe (Green)</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: 'hsl(48, 96%, 53%)' }}></div>
            <span>Warning (Yellow)</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: 'hsl(0, 84%, 60%)' }}></div>
            <span>At Risk (Red)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
