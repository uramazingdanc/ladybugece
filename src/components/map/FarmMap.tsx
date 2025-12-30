import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, RefreshCw, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { Style, Circle as CircleStyle, Fill, Stroke, RegularShape } from 'ol/style';
import Overlay from 'ol/Overlay';
import FarmListPanel from './FarmListPanel';
import FarmFormDialog from './FarmFormDialog';
import DeleteFarmDialog from './DeleteFarmDialog';
import { statusToAlertLevel } from '@/hooks/useMqttWebSocket';
import { useMqttContext } from '@/contexts/MqttContext';

interface Farm {
  id: string;
  farm_name: string;
  latitude: number;
  longitude: number;
  alert_level?: 'Green' | 'Yellow' | 'Red';
  last_moth_count?: number;
  last_updated?: string;
  temperature?: number;
  larva_density?: number;
  device_id?: string;
}

interface LiveTrap {
  id: string;
  latitude: number;
  longitude: number;
  alert_level: 'Green' | 'Yellow' | 'Red';
  moth_count?: number;
  temperature?: number;
  larva_density?: number;
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

  // Dialog states
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedFarm, setSelectedFarm] = useState<Farm | null>(null);

  // MQTT live trap data from shared context
  const { traps: mqttTraps, isConnected: mqttConnected } = useMqttContext();

  // Convert MQTT traps to LiveTrap format (only those with GPS coordinates)
  const liveTraps: LiveTrap[] = Object.entries(mqttTraps)
    .filter(([_, data]) => data.latitude !== undefined && data.longitude !== undefined)
    .map(([id, data]) => ({
      id,
      latitude: data.latitude!,
      longitude: data.longitude!,
      alert_level: statusToAlertLevel(data.status),
      moth_count: data.moth_count,
      temperature: data.temperature,
      larva_density: data.larva_density,
      last_updated: data.last_updated
    }));

  const fetchFarms = useCallback(async () => {
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

      // Fetch devices to get device_id for each farm
      const { data: devicesData, error: devicesError } = await supabase
        .from('devices')
        .select('*');

      if (devicesError) throw devicesError;

      const farmsWithAlerts = (farmsData || []).map((farm) => {
        const alert = alertsData?.find(a => a.farm_id === farm.id);
        const device = devicesData?.find(d => d.farm_id === farm.id);
        
        return {
          ...farm,
          alert_level: alert?.alert_level as 'Green' | 'Yellow' | 'Red' | undefined,
          last_moth_count: alert?.last_moth_count,
          last_updated: alert?.last_updated,
          temperature: alert?.last_temperature,
          larva_density: alert?.last_larva_density,
          device_id: device?.id,
        };
      });

      setFarms(farmsWithAlerts);
      setLoading(false);
    } catch (err: any) {
      console.error('Error fetching farms:', err);
      setError(err.message || 'Failed to load farm data');
      setLoading(false);
    }
  }, []);

  // Merge live MQTT data with farm data - prioritize live data over database
  const farmsWithLiveData = farms.map((farm) => {
    // Check if we have live MQTT data for this farm's device
    const liveMqttData = farm.device_id ? mqttTraps[farm.device_id] : null;
    
    if (liveMqttData && liveMqttData.moth_count !== undefined) {
      // Use live MQTT data instead of stale database data
      return {
        ...farm,
        alert_level: statusToAlertLevel(liveMqttData.status),
        last_moth_count: liveMqttData.moth_count,
        temperature: liveMqttData.temperature,
        larva_density: liveMqttData.larva_density,
        last_updated: liveMqttData.last_updated,
        hasLiveData: true,
      };
    }
    
    return { ...farm, hasLiveData: false };
  });

  useEffect(() => {
    fetchFarms();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel('farm_map_realtime')
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
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'farms'
        },
        () => {
          fetchFarms();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'devices'
        },
        () => {
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
        () => {
          fetchFarms();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchFarms]);

  const panToFarm = useCallback((farm: Farm) => {
    if (mapInstanceRef.current) {
      const view = mapInstanceRef.current.getView();
      view.animate({
        center: fromLonLat([farm.longitude, farm.latitude]),
        zoom: 14,
        duration: 500,
      });
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    
    // Allow map to initialize even without farms (to show live traps)
    if (farms.length === 0 && liveTraps.length === 0 && !loading) return;

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
          
          // Helper function to get status text
          const getStatusText = (alertLevel: string | undefined) => {
            switch (alertLevel) {
              case 'Red': return 'High Risk';
              case 'Yellow': return 'Moderate';
              case 'Green': return 'Safe';
              default: return 'Unknown';
            }
          };
          
          const isLiveTrap = properties.is_live_trap;
          const hasLiveData = properties.has_live_data;
          const title = isLiveTrap ? `🔴 Live Trap: ${properties.trap_id}` : properties.farm_name;
          
          // Update popup content
          popupRef.current.innerHTML = `
            <div class="p-4 bg-card border border-border rounded-lg shadow-lg min-w-[200px]">
              <button class="absolute top-2 right-2 text-muted-foreground hover:text-foreground" onclick="this.parentElement.style.display='none'">
                ✕
              </button>
              <h3 class="font-bold text-lg mb-2">${title}</h3>
              ${isLiveTrap || hasLiveData ? '<div class="text-xs text-green-500 mb-2 flex items-center gap-1"><span class="animate-pulse">●</span> MQTT Live Data</div>' : ''}
              <div class="space-y-1 text-sm">
                ${properties.device_id ? `
                  <div>
                    <span class="font-semibold">Device:</span> ${properties.device_id}
                  </div>
                ` : ''}
                <div class="flex items-center gap-2">
                  <span class="font-semibold">Status:</span>
                  <span class="px-2 py-1 rounded text-white font-medium" style="background-color: ${getAlertColor(properties.alert_level)}">
                    ${getStatusText(properties.alert_level)}
                  </span>
                </div>
                ${properties.last_moth_count !== undefined ? `
                  <div>
                    <span class="font-semibold">Moth Count:</span> ${properties.last_moth_count}
                  </div>
                ` : ''}
                ${properties.temperature !== undefined ? `
                  <div>
                    <span class="font-semibold">Temperature:</span> ${properties.temperature}°C
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

    // Update markers - combine farms (with live data merged) and live traps
    const vectorSource = new VectorSource();
    
    // Add farm markers (circles) - using farmsWithLiveData which has MQTT data merged
    farmsWithLiveData.forEach((farm) => {
      const feature = new Feature({
        geometry: new Point(fromLonLat([farm.longitude, farm.latitude])),
        farm_name: farm.farm_name,
        alert_level: farm.alert_level,
        last_moth_count: farm.last_moth_count,
        last_updated: farm.last_updated,
        temperature: farm.temperature,
        device_id: farm.device_id,
        is_live_trap: false,
        has_live_data: farm.hasLiveData,
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
              color: farm.hasLiveData ? '#00ff00' : '#ffffff', // Green border for live data
              width: farm.hasLiveData ? 4 : 3,
            }),
          }),
        })
      );

      vectorSource.addFeature(feature);
    });

    // Add live MQTT trap markers (diamonds/squares rotated)
    liveTraps.forEach((trap) => {
      const feature = new Feature({
        geometry: new Point(fromLonLat([trap.longitude, trap.latitude])),
        trap_id: trap.id,
        alert_level: trap.alert_level,
        last_moth_count: trap.moth_count,
        last_updated: trap.last_updated,
        temperature: trap.temperature,
        is_live_trap: true,
      });

      const markerColor = getMarkerColor(trap.alert_level);
      
      // Diamond shape for live traps
      feature.setStyle(
        new Style({
          image: new RegularShape({
            fill: new Fill({
              color: markerColor,
            }),
            stroke: new Stroke({
              color: '#ffffff',
              width: 2,
            }),
            points: 4,
            radius: 12,
            angle: Math.PI / 4, // Rotate to make diamond
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
  }, [farms, farmsWithLiveData, liveTraps, loading, mqttTraps]);

  // CRUD handlers
  const handleAddFarm = () => {
    setSelectedFarm(null);
    setFormDialogOpen(true);
  };

  const handleEditFarm = (farm: Farm) => {
    setSelectedFarm(farm);
    setFormDialogOpen(true);
  };

  const handleDeleteFarm = (farm: Farm) => {
    setSelectedFarm(farm);
    setDeleteDialogOpen(true);
  };

  const handleSelectFarm = (farm: Farm) => {
    panToFarm(farm);
  };

  const handleFormSuccess = () => {
    fetchFarms();
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
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Farm List Panel */}
        <div className="lg:col-span-1">
          <FarmListPanel
            farms={farmsWithLiveData}
            onAddFarm={handleAddFarm}
            onSelectFarm={handleSelectFarm}
            onEditFarm={handleEditFarm}
            onDeleteFarm={handleDeleteFarm}
          />
        </div>

        {/* Map */}
        <div className="lg:col-span-3">
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold">Interactive Farm Map</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Real-time overview of pest alert levels across all monitored farms
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {/* MQTT Status Badge */}
                  <Badge 
                    variant="outline" 
                    className={mqttConnected 
                      ? "bg-green-500/10 text-green-600 border-green-500/20" 
                      : "bg-red-500/10 text-red-600 border-red-500/20"
                    }
                  >
                    <span className="relative flex h-2 w-2 mr-2">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${mqttConnected ? 'bg-green-400' : 'bg-red-400'} opacity-75`}></span>
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${mqttConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    </span>
                    <Radio className="h-3 w-3 mr-1" />
                    {mqttConnected ? 'MQTT Live' : 'MQTT Offline'}
                    {liveTraps.length > 0 && ` (${liveTraps.length})`}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={fetchFarms} className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                </div>
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
              <div className="px-6 py-4 border-t bg-card flex flex-wrap justify-start gap-x-8 gap-y-2 text-sm">
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
                <div className="flex items-center gap-2 border-l pl-4 ml-2">
                  <div className="w-3 h-3 rounded-full border-2 border-white shadow-sm bg-primary"></div>
                  <span className="text-muted-foreground">Farm</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rotate-45 border-2 border-white shadow-sm bg-primary"></div>
                  <span className="text-muted-foreground">Live Trap (MQTT)</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Farm Form Dialog */}
      <FarmFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        farm={selectedFarm}
        onSuccess={handleFormSuccess}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteFarmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        farm={selectedFarm}
        onSuccess={handleFormSuccess}
      />
    </div>
  );
}
