import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, MapPin, Lock, LogOut, Pencil, Trash2 } from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import AdminLoginDialog from '@/components/auth/AdminLoginDialog';

interface Farm {
  id: string;
  farm_name: string;
  latitude: number;
  longitude: number;
  alert_level?: 'Green' | 'Yellow' | 'Red';
  last_moth_count?: number;
  temperature?: number;
  larva_density?: number;
  device_id?: string;
  hasLiveData?: boolean;
}

interface FarmListPanelProps {
  farms: Farm[];
  onAddFarm: () => void;
  onSelectFarm: (farm: Farm) => void;
  onEditFarm: (farm: Farm) => void;
  onDeleteFarm: (farm: Farm) => void;
}

const getAlertBadgeVariant = (alertLevel?: string) => {
  switch (alertLevel) {
    case 'Red':
      return 'destructive';
    case 'Yellow':
      return 'warning';
    case 'Green':
      return 'success';
    default:
      return 'secondary';
  }
};

const getStatusLabel = (alertLevel?: string) => {
  switch (alertLevel) {
    case 'Red':
      return 'High Risk';
    case 'Yellow':
      return 'Moderate';
    case 'Green':
      return 'Safe';
    default:
      return 'No Data';
  }
};

export default function FarmListPanel({ 
  farms, 
  onAddFarm, 
  onSelectFarm,
  onEditFarm,
  onDeleteFarm
}: FarmListPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const { isAuthenticated, logout } = useAdminAuth();

  const filteredFarms = farms.filter(farm =>
    farm.farm_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    farm.device_id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddClick = () => {
    if (isAuthenticated) {
      onAddFarm();
    } else {
      setLoginDialogOpen(true);
    }
  };

  return (
    <>
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Farms & Traps</CardTitle>
            <div className="flex items-center gap-2">
              {isAuthenticated ? (
                <>
                  <Button size="sm" onClick={onAddFarm} className="gap-1">
                    <Plus className="h-4 w-4" />
                    Add
                  </Button>
                  <Button size="sm" variant="outline" onClick={logout} className="gap-1">
                    <LogOut className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="outline" onClick={handleAddClick} className="gap-1">
                  <Lock className="h-4 w-4" />
                  Admin
                </Button>
              )}
            </div>
          </div>
          <div className="relative mt-2">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search farms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-0">
          <ScrollArea className="h-[500px]">
            <div className="space-y-2 p-4 pt-0">
              {filteredFarms.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery ? 'No farms found' : 'No farms added yet'}
                </div>
              ) : (
                filteredFarms.map((farm) => (
                  <div
                    key={farm.id}
                    className={`p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer ${farm.hasLiveData ? 'ring-2 ring-green-500/50' : ''}`}
                    onClick={() => onSelectFarm(farm)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium truncate">{farm.farm_name}</h4>
                          <Badge variant={getAlertBadgeVariant(farm.alert_level) as any}>
                            {getStatusLabel(farm.alert_level)}
                          </Badge>
                          {farm.hasLiveData && (
                            <span className="text-xs text-green-500 flex items-center gap-1">
                              <span className="animate-pulse">●</span> Live
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <MapPin className="h-3 w-3" />
                          <span>{farm.latitude.toFixed(4)}, {farm.longitude.toFixed(4)}</span>
                        </div>
                        {farm.device_id && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Device: {farm.device_id}
                          </div>
                        )}
                        {farm.last_moth_count !== undefined && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Moths: {farm.last_moth_count}
                          </div>
                        )}
                        {farm.larva_density !== undefined && farm.larva_density > 0 && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Larva Density: {farm.larva_density}
                          </div>
                        )}
                        {farm.temperature !== undefined && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Temp: {farm.temperature}°C
                          </div>
                        )}
                      </div>
                      {isAuthenticated && (
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditFarm(farm);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteFarm(farm);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <AdminLoginDialog
        open={loginDialogOpen}
        onOpenChange={setLoginDialogOpen}
        onSuccess={onAddFarm}
      />
    </>
  );
}
