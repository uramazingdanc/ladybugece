import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Edit, Trash, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
interface Farm {
  id: string;
  farm_name: string;
  latitude: number;
  longitude: number;
  owner_id: string | null;
  created_at: string;
}
export default function FarmManagement() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFarm, setEditingFarm] = useState<Farm | null>(null);
  const [formData, setFormData] = useState({
    farm_name: '',
    latitude: '',
    longitude: ''
  });
  const {
    toast
  } = useToast();
  useEffect(() => {
    fetchFarms();
  }, []);
  const fetchFarms = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('farms').select('*').order('created_at', {
        ascending: false
      });
      if (error) throw error;
      setFarms(data || []);
    } catch (error) {
      console.error('Error fetching farms:', error);
      toast({
        title: 'Error',
        description: 'Failed to load farms',
        variant: 'destructive'
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
        variant: 'destructive'
      });
      return;
    }
    try {
      if (editingFarm) {
        const {
          error
        } = await supabase.from('farms').update({
          farm_name: formData.farm_name,
          latitude,
          longitude
        }).eq('id', editingFarm.id);
        if (error) throw error;
        toast({
          title: 'Success',
          description: 'Farm updated successfully'
        });
      } else {
        const {
          error
        } = await supabase.from('farms').insert({
          farm_name: formData.farm_name,
          latitude,
          longitude,
          owner_id: null
        });
        if (error) throw error;
        toast({
          title: 'Success',
          description: 'Farm added successfully'
        });
      }
      handleDialogClose();
      fetchFarms();
    } catch (error) {
      console.error('Error saving farm:', error);
      toast({
        title: 'Error',
        description: 'Failed to save farm',
        variant: 'destructive'
      });
    }
  };
  const handleEdit = (farm: Farm) => {
    setEditingFarm(farm);
    setFormData({
      farm_name: farm.farm_name,
      latitude: farm.latitude.toString(),
      longitude: farm.longitude.toString()
    });
    setDialogOpen(true);
  };
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this farm?')) return;
    try {
      const {
        error
      } = await supabase.from('farms').delete().eq('id', id);
      if (error) throw error;
      toast({
        title: 'Success',
        description: 'Farm deleted successfully'
      });
      fetchFarms();
    } catch (error) {
      console.error('Error deleting farm:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete farm',
        variant: 'destructive'
      });
    }
  };
  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingFarm(null);
    setFormData({
      farm_name: '',
      latitude: '',
      longitude: ''
    });
  };
  if (loading) {
    return <div className="text-center py-8">Loading farms...</div>;
  }
  return <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-bold text-sm">Farm Management</h2>
          <p className="text-muted-foreground text-sm">Add, edit, and manage your farm locations</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={open => {
        if (!open) handleDialogClose();else setDialogOpen(true);
      }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" />
              Add New Farm
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
                <Input id="farm_name" value={formData.farm_name} onChange={e => setFormData({
                ...formData,
                farm_name: e.target.value
              })} placeholder="e.g., Green Valley Farm" required />
              </div>
              <div>
                <Label htmlFor="latitude">Latitude</Label>
                <Input id="latitude" type="number" step="any" value={formData.latitude} onChange={e => setFormData({
                ...formData,
                latitude: e.target.value
              })} placeholder="e.g., 14.5995" required />
              </div>
              <div>
                <Label htmlFor="longitude">Longitude</Label>
                <Input id="longitude" type="number" step="any" value={formData.longitude} onChange={e => setFormData({
                ...formData,
                longitude: e.target.value
              })} placeholder="e.g., 120.9842" required />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={handleDialogClose} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90">
                  {editingFarm ? 'Update' : 'Save'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Farms Table */}
      {farms.length === 0 ? <Card className="border-0 shadow-md">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <MapPin className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground text-center text-lg">
              No farms added yet. Click "Add New Farm" to get started.
            </p>
          </CardContent>
        </Card> : <Card className="border-0 shadow-md">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Farm Name</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Latitude</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Longitude</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Date Added</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {farms.map(farm => <tr key={farm.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-primary" />
                          <span className="font-medium">{farm.farm_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-sm text-muted-foreground">
                        {farm.latitude.toFixed(6)}
                      </td>
                      <td className="px-6 py-4 font-mono text-sm text-muted-foreground">
                        {farm.longitude.toFixed(6)}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {new Date(farm.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2 justify-end">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(farm)} className="hover:bg-primary/10">
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDelete(farm.id)}>
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>)}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>}
    </div>;
}