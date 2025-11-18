import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import OSM from 'ol/source/OSM';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { fromLonLat } from 'ol/proj';
import { Style, Circle as CircleStyle, Fill, Stroke } from 'ol/style';
import Overlay from 'ol/Overlay';

interface Farm {
  id: string;
  farm_name: string;
  latitude: number;
  longitude: number;
  alert_level?: 'Green' | 'Yellow' | 'Red';
  last_moth_count?: number;
  last_updated?: string;
}

// Helper function to get marker color based on alert level
const getMarkerColor = (alertLevel?: string): string => {
  switch (alertLevel) {
    case 'Red':
      return 'hsl(0, 72%, 51%)';
    case 'Yellow':
      return 'hsl(45, 100%, 51%)';
    case 'Green':
      return 'hsl(142, 76%, 36%)';
    default:
      return 'hsl(142, 76%, 36%)';
  }
};

// Helper function to get alert color for popup
const getAlertColor = (alertLevel?: string): string => {
  switch (alertLevel) {
    case 'Red':
      return 'hsl(0, 72%, 51%)';
    case 'Yellow':
      return 'hsl(45, 100%, 51%)';
    case 'Green':
      return 'hsl(142, 76%, 36%)';
    default:
      return 'hsl(142, 76%, 36%)';
  }
};

export default function FarmMap() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<Overlay | null>(null);

  useEffect(() => {
    fetchFarms();
    
    // Subscribe to realtime updates for both alerts and readings
    const channel = supabase
      .channel('farm_map_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ipm_alerts'
        },
        (payload) => {
          console.log('Map: Real-time alert update:', payload);
          fetchFarms();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pest_readings'
        },
        (payload) => {
          console.log('Map: New pest reading from MQTT:', payload);
          fetchFarms();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || farms.length === 0) return;

    // Initialize map if not already initialized
    if (!mapInstanceRef.current) {
      // Create popup overlay
      if (popupRef.current) {
        overlayRef.current = new Overlay({
          element: popupRef.current,
          autoPan: {
            animation: {
              duration: 250,
            },
          },
        });
      }

      // Create map
      const map = new Map({
        target: mapRef.current,
        layers: [
          new TileLayer({
            source: new OSM(),
          }),
        ],
        view: new View({
          center: fromLonLat([121.7740, 12.8797]), // Central Philippines
          zoom: 7,
        }),
        overlays: overlayRef.current ? [overlayRef.current] : [],
      });

      mapInstanceRef.current = map;

      // Add click handler for popups
      map.on('click', (evt) => {
        const feature = map.forEachFeatureAtPixel(evt.pixel, (feat) => feat);
        
        if (feature && overlayRef.current && popupRef.current) {
          const coordinates = (feature.getGeometry() as Point).getCoordinates();
          const properties = feature.getProperties();
          
          // Update popup content
          popupRef.current.innerHTML = `
            <div class="p-4 bg-card border border-border rounded-lg shadow-lg min-w-[200px]">
              <button class="absolute top-2 right-2 text-muted-foreground hover:text-foreground" onclick="this.parentElement.style.display='none'">
                ✕
              </button>
              <h3 class="font-bold text-lg mb-2">${properties.farm_name}</h3>
              <div class="space-y-1 text-sm">
                <div class="flex items-center gap-2">
                  <span class="font-semibold">Status:</span>
                  <span class="px-2 py-1 rounded text-white font-medium" style="background-color: ${getAlertColor(properties.alert_level)}">
                    ${properties.alert_level || 'Unknown'}
                  </span>
                </div>
                ${properties.last_moth_count !== undefined ? `
                  <div>
                    <span class="font-semibold">Moth Count:</span> ${properties.last_moth_count}
                  </div>
                ` : ''}
                ${properties.last_updated ? `
                  <div>
                    <span class="font-semibold">Last Updated:</span> ${new Date(properties.last_updated).toLocaleString()}
                  </div>
                ` : ''}
              </div>
            </div>
          `;
          
          overlayRef.current.setPosition(coordinates);
          popupRef.current.style.display = 'block';
        } else if (overlayRef.current && popupRef.current) {
          popupRef.current.style.display = 'none';
        }
      });

      // Change cursor on hover
      map.on('pointermove', (evt) => {
        const hit = map.hasFeatureAtPixel(evt.pixel);
        map.getTargetElement().style.cursor = hit ? 'pointer' : '';
      });
    }

    // Update markers
    const vectorSource = new VectorSource();
    
    farms.forEach((farm) => {
      const feature = new Feature({
        geometry: new Point(fromLonLat([farm.longitude, farm.latitude])),
        farm_name: farm.farm_name,
        alert_level: farm.alert_level,
        last_moth_count: farm.last_moth_count,
        last_updated: farm.last_updated,
      });

      const markerColor = getMarkerColor(farm.alert_level);
      
      feature.setStyle(
        new Style({
          image: new CircleStyle({
            radius: 10,
            fill: new Fill({
              color: markerColor,
            }),
            stroke: new Stroke({
              color: '#ffffff',
              width: 3,
            }),
          }),
        })
      );

      vectorSource.addFeature(feature);
    });

    // Remove old vector layer if exists
    const layers = mapInstanceRef.current.getLayers().getArray();
    const oldVectorLayer = layers.find((layer) => layer instanceof VectorLayer);
    if (oldVectorLayer) {
      mapInstanceRef.current.removeLayer(oldVectorLayer);
    }

    // Add new vector layer
    const vectorLayer = new VectorLayer({
      source: vectorSource,
    });
    
    mapInstanceRef.current.addLayer(vectorLayer);

    return () => {
      // Cleanup on unmount
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setTarget(undefined);
        mapInstanceRef.current = null;
      }
    };
  }, [farms]);

  const fetchFarms = async () => {
    try {
      setError(null);
      
      const { data: farmsData, error: farmsError } = await supabase
        .from('farms')
        .select('*');

      if (farmsError) throw farmsError;

      const { data: alertsData, error: alertsError } = await supabase
        .from('ipm_alerts')
        .select('*');

      if (alertsError) throw alertsError;

      const farmsWithAlerts = farmsData?.map(farm => {
        const alert = alertsData?.find(a => a.farm_id === farm.id);
        return {
          ...farm,
          alert_level: alert?.alert_level as 'Green' | 'Yellow' | 'Red' | undefined,
          last_moth_count: alert?.last_moth_count,
          last_updated: alert?.last_updated,
        };
      }) || [];

      setFarms(farmsWithAlerts);
      setLoading(false);
    } catch (err: any) {
      console.error('Error fetching farms:', err);
      setError(err.message || 'Failed to load farm data');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading map data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <Card className="max-w-md">
          <div className="p-6 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
            <div>
              <h3 className="font-semibold text-lg mb-2">
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
          <div className="overflow-hidden relative">
            <div 
              ref={mapRef} 
              style={{ height: '600px', width: '100%' }}
              className="z-0"
            />
            <div 
              ref={popupRef}
              style={{ display: 'none' }}
              className="absolute z-10"
            />
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
