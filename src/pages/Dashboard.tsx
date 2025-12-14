import { useState } from 'react';
import { Bug, MapPin, Activity, Wifi, Radio } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import FarmMap from '@/components/map/FarmMap';
import GovernmentDashboard from '@/components/dashboard/GovernmentDashboard';
import MqttTrapMonitor from '@/components/dashboard/MqttTrapMonitor';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('mqtt');

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-card shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bug className="h-8 w-8 text-primary" />
              <div>
                <h1 className="font-bold text-foreground text-sm">LADYBUG</h1>
                <p className="text-muted-foreground text-xs">Onion Armyworm Monitoring System - Philippines</p>
              </div>
            </div>
            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
              <span className="relative flex h-2 w-2 mr-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <Wifi className="h-3 w-3 mr-1" />
              MQTT Live
            </Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 gap-4 bg-transparent p-0">
            <TabsTrigger value="mqtt" className="flex items-center gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm border-b-2 border-transparent data-[state=active]:border-primary rounded-none py-3">
              <Radio className="h-4 w-4" />
              Live Traps
            </TabsTrigger>
            <TabsTrigger value="map" className="flex items-center gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm border-b-2 border-transparent data-[state=active]:border-primary rounded-none py-3">
              <MapPin className="h-4 w-4" />
              Farm Map
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm border-b-2 border-transparent data-[state=active]:border-primary rounded-none py-3">
              <Activity className="h-4 w-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mqtt">
            <ErrorBoundary>
              <MqttTrapMonitor />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="map">
            <ErrorBoundary>
              <FarmMap />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="analytics">
            <GovernmentDashboard />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}