import { useState } from 'react';
import { Bug, Map, BarChart3 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import FarmMap from '@/components/map/FarmMap';
import GovernmentDashboard from '@/components/dashboard/GovernmentDashboard';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('map');

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <Bug className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">LADYBUG</h1>
              <p className="text-xs text-muted-foreground">
                Pest Monitoring Dashboard
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
            <TabsTrigger value="map" className="flex items-center gap-2">
              <Map className="w-4 h-4" />
              GIS Map
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="map" className="space-y-4">
            <div className="bg-card rounded-lg border border-border p-4">
              <h2 className="text-2xl font-bold mb-4">Farm Status Map</h2>
              <div className="h-[600px] rounded-lg overflow-hidden border border-border">
                <ErrorBoundary>
                  <FarmMap />
                </ErrorBoundary>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <GovernmentDashboard />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
