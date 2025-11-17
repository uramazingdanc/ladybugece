import { useState } from 'react';
import { Bug, MapPin, Activity, Settings } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import FarmMap from '@/components/map/FarmMap';
import GovernmentDashboard from '@/components/dashboard/GovernmentDashboard';
import FarmManagement from '@/components/farm/FarmManagement';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('map');

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-card shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <Bug className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">LADYBUG</h1>
              <p className="text-sm text-muted-foreground">Onion Armyworm Monitoring System</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 gap-4 bg-transparent p-0">
            <TabsTrigger 
              value="map" 
              className="flex items-center gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm border-b-2 border-transparent data-[state=active]:border-primary rounded-none py-3"
            >
              <MapPin className="h-4 w-4" />
              Farm Map
            </TabsTrigger>
            <TabsTrigger 
              value="analytics" 
              className="flex items-center gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm border-b-2 border-transparent data-[state=active]:border-primary rounded-none py-3"
            >
              <Activity className="h-4 w-4" />
              Analytics Dashboard
            </TabsTrigger>
            <TabsTrigger 
              value="manage" 
              className="flex items-center gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm border-b-2 border-transparent data-[state=active]:border-primary rounded-none py-3"
            >
              <Settings className="h-4 w-4" />
              Farm Management
            </TabsTrigger>
          </TabsList>

          <TabsContent value="map">
            <ErrorBoundary>
              <FarmMap />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="analytics">
            <GovernmentDashboard />
          </TabsContent>

          <TabsContent value="manage">
            <FarmManagement />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
