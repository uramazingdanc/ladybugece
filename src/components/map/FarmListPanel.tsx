import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Edit2, Trash2, MapPin } from 'lucide-react';

interface Farm {
  id: string;
  farm_name: string;
  latitude: number;
  longitude: number;
  alert_level?: 'Green' | 'Yellow' | 'Red';
  last_moth_count?: number;
  device_id?: string;
}

interface FarmListPanelProps {
  farms: Farm[];
  onAddFarm: () => void;
  onEditFarm: (farm: Farm) => void;
  onDeleteFarm: (farm: Farm) => void;
  onSelectFarm: (farm: Farm) => void;
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
      return 'Medium';
    case 'Green':
      return 'Low Risk';
    default:
      return 'No Data';
  }
};

export default function FarmListPanel({ 
  farms, 
  onAddFarm, 
  onEditFarm, 
  onDeleteFarm,
  onSelectFarm 
}: FarmListPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFarms = farms.filter(farm =>
    farm.farm_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    farm.device_id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Farms & Traps</CardTitle>
          <Button size="sm" onClick={onAddFarm} className="gap-1">
            <Plus className="h-4 w-4" />
            Add
          </Button>
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
                  className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => onSelectFarm(farm)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium truncate">{farm.farm_name}</h4>
                        <Badge variant={getAlertBadgeVariant(farm.alert_level) as any}>
                          {getStatusLabel(farm.alert_level)}
                        </Badge>
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
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditFarm(farm);
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteFarm(farm);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
