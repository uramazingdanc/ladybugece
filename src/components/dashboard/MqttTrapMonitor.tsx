import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { statusToAlertLevel, getStatusLabel } from '@/hooks/useMqttWebSocket';
import { useMqttContext } from '@/contexts/MqttContext';
import { Activity, Wifi, WifiOff, Thermometer, MapPin, Bug, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function MqttTrapMonitor() {
  const { traps, isConnected, error, reconnect, sendTestMessage } = useMqttContext();

  const trapEntries = Object.entries(traps);

  const getStatusColor = (status?: number) => {
    switch (status) {
      case 1: return 'bg-green-500';
      case 2: return 'bg-yellow-500';
      case 3: return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusBadgeVariant = (status?: number) => {
    const alertLevel = statusToAlertLevel(status);
    switch (alertLevel) {
      case 'Green': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'Yellow': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'Red': return 'bg-red-500/10 text-red-600 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
  };

  // Test function to simulate MQTT messages
  const handleTestMessage = () => {
    const testTraps = ['trap011', 'trap012', 'trap013'];
    const statuses = ['5,28,1', '12,32,2', '25,35,3'];
    const locations = ['15.51848755,121.2739912', '15.526633,121.276333', '15.526976,121.278758'];
    
    testTraps.forEach((trapId, index) => {
      setTimeout(() => {
        sendTestMessage(trapId, statuses[index], locations[index]);
      }, index * 500);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="h-5 w-5 text-primary" />
        <h2 className="text-2xl font-bold">Live MQTT Traps</h2>
        
        <div className="ml-auto flex items-center gap-2">
          {isConnected ? (
            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
              <Wifi className="w-3 h-3 mr-1" />
              Connected
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
              <WifiOff className="w-3 h-3 mr-1" />
              Disconnected
            </Badge>
          )}
          
          <Button variant="outline" size="sm" onClick={reconnect}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Reconnect
          </Button>

          <Button variant="secondary" size="sm" onClick={handleTestMessage}>
            Send Test Data
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="text-sm text-muted-foreground mb-4">
        <p>Subscribed topics: <code className="bg-muted px-1 rounded">ladybug/trap{'{n}'}/status</code> and <code className="bg-muted px-1 rounded">ladybug/trap{'{n}'}/location</code></p>
        <p className="mt-1">Status format: <code className="bg-muted px-1 rounded">moth_count,temperature,status</code> (1=Safe, 2=Moderate, 3=High Risk)</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {trapEntries.map(([trapId, data]) => (
          <Card key={trapId} className="relative overflow-hidden">
            {/* Status indicator bar */}
            <div className={cn(
              "absolute top-0 left-0 right-0 h-1",
              getStatusColor(data.status)
            )} />
            
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg capitalize">{trapId.replace('trap', 'Trap ')}</CardTitle>
                  {data.latitude && data.longitude && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {data.latitude.toFixed(4)}, {data.longitude.toFixed(4)}
                    </p>
                  )}
                </div>
                <Badge variant="outline" className={getStatusBadgeVariant(data.status)}>
                  {getStatusLabel(data.status)}
                </Badge>
              </div>
            </CardHeader>

            <CardContent>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-primary/5 rounded-lg p-3">
                    <div className="flex items-center gap-1">
                      <Bug className="w-3 h-3" />
                      <p className="text-xs text-muted-foreground">Moths</p>
                    </div>
                    <p className="text-2xl font-bold text-primary">
                      {data.moth_count ?? '-'}
                    </p>
                  </div>
                  <div className="bg-secondary/5 rounded-lg p-3">
                    <div className="flex items-center gap-1">
                      <Thermometer className="w-3 h-3" />
                      <p className="text-xs text-muted-foreground">Temp</p>
                    </div>
                    <p className="text-2xl font-bold">
                      {data.temperature ? `${data.temperature}°C` : '-'}
                    </p>
                  </div>
                </div>

                {data.last_updated && (
                  <div className="text-xs text-muted-foreground pt-2 border-t">
                    Updated: {new Date(data.last_updated).toLocaleTimeString()}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {trapEntries.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Waiting for MQTT data...</p>
            <p className="text-sm mt-2">
              Traps will appear here when they start sending data via MQTT.
            </p>
            <Button variant="outline" className="mt-4" onClick={handleTestMessage}>
              Send Test Data
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
