import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface Farm {
  id: string;
  farm_name: string;
  latitude: number;
  longitude: number;
  owner_id: string | null;
}

export default function FarmManagement() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFarm, setEditingFarm] = useState<Farm | null>(null);
  const [formData, setFormData] = useState({
    farm_name: '',
    latitude: '',
    longitude: '',
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchFarms();
  }, []);

  const fetchFarms = async () => {
    try {
      const { data, error } = await supabase
        .from('farms')
        .select('*')
        .order('farm_name');

      if (error) throw error;
      setFarms(data || []);
    } catch (error) {
      console.error('Error fetching farms:', error);
      toast({
        title: 'Error',
        description: 'Failed to load farms',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const latitude = parseFloat(formData.latitude);
    const longitude = parseFloat(formData.longitude);

    if (isNaN(latitude) || isNaN(longitude)) {
      toast({
        title: 'Invalid input',
        description: 'Please enter valid coordinates',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (editingFarm) {
        const { error } = await supabase
          .from('farms')
          .update({
            farm_name: formData.farm_name,
            latitude,
            longitude,
          })
          .eq('id', editingFarm.id);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Farm updated successfully',
        });
      } else {
        const { error } = await supabase
          .from('farms')
          .insert({
            farm_name: formData.farm_name,
            latitude,
            longitude,
            owner_id: null,
          });

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Farm added successfully',
        });
      }

      setDialogOpen(false);
      setEditingFarm(null);
      setFormData({ farm_name: '', latitude: '', longitude: '' });
      fetchFarms();
    } catch (error) {
      console.error('Error saving farm:', error);
      toast({
        title: 'Error',
        description: 'Failed to save farm',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (farm: Farm) => {
    setEditingFarm(farm);
    setFormData({
      farm_name: farm.farm_name,
      latitude: farm.latitude.toString(),
      longitude: farm.longitude.toString(),
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this farm?')) return;

    try {
      const { error } = await supabase.from('farms').delete().eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Farm deleted successfully',
      });
      fetchFarms();
    } catch (error) {
      console.error('Error deleting farm:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete farm',
        variant: 'destructive',
      });
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingFarm(null);
    setFormData({ farm_name: '', latitude: '', longitude: '' });
  };

  if (loading) {
    return <div className="text-center py-8">Loading farms...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Farm Management</h2>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          if (!open) handleDialogClose();
          else setDialogOpen(true);
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Farm
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingFarm ? 'Edit Farm' : 'Add New Farm'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="farm_name">Farm Name</Label>
                <Input
                  id="farm_name"
                  value={formData.farm_name}
                  onChange={(e) =>
                    setFormData({ ...formData, farm_name: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="latitude">Latitude</Label>
                <Input
                  id="latitude"
                  type="number"
                  step="any"
                  value={formData.latitude}
                  onChange={(e) =>
                    setFormData({ ...formData, latitude: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="longitude">Longitude</Label>
                <Input
                  id="longitude"
                  type="number"
                  step="any"
                  value={formData.longitude}
                  onChange={(e) =>
                    setFormData({ ...formData, longitude: e.target.value })
                  }
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                {editingFarm ? 'Update Farm' : 'Add Farm'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {farms.map((farm) => (
          <Card key={farm.id} className="p-4">
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">{farm.farm_name}</h3>
              <p className="text-sm text-muted-foreground">
                Lat: {farm.latitude.toFixed(4)}
              </p>
              <p className="text-sm text-muted-foreground">
                Lng: {farm.longitude.toFixed(4)}
              </p>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(farm)}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(farm.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {farms.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No farms added yet. Click "Add Farm" to get started.
        </div>
      )}
    </div>
  );
}
