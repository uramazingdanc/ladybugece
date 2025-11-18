import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Loader2, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
interface Device {
  id: string;
  device_name: string;
  farm_id: string;
  created_at: string;
  farms?: {
    farm_name: string;
  };
}
interface Farm {
  id: string;
  farm_name: string;
}
export default function DeviceManagement() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [formData, setFormData] = useState({
    id: '',
    device_name: '',
    farm_id: ''
  });
  useEffect(() => {
    fetchDevices();
    fetchFarms();
  }, []);
  const fetchDevices = async () => {
    try {
      setLoading(true);
      const {
        data,
        error
      } = await supabase.from('devices').select(`
          *,
          farms (
            farm_name
          )
        `).order('created_at', {
        ascending: false
      });
      if (error) throw error;
      setDevices(data || []);
    } catch (error: any) {
      console.error('Error fetching devices:', error);
      toast.error('Failed to load devices');
    } finally {
      setLoading(false);
    }
  };
  const fetchFarms = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('farms').select('id, farm_name').order('farm_name');
      if (error) throw error;
      setFarms(data || []);
    } catch (error: any) {
      console.error('Error fetching farms:', error);
    }
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id.trim() || !formData.device_name.trim() || !formData.farm_id) {
      toast.error('Please fill in all fields');
      return;
    }
    try {
      if (editingDevice) {
        // Update existing device
        const {
          error
        } = await supabase.from('devices').update({
          device_name: formData.device_name,
          farm_id: formData.farm_id
        }).eq('id', editingDevice.id);
        if (error) throw error;
        toast.success('Device updated successfully');
      } else {
        // Insert new device
        const {
          error
        } = await supabase.from('devices').insert({
          id: formData.id,
          device_name: formData.device_name,
          farm_id: formData.farm_id
        });
        if (error) throw error;
        toast.success('Device added successfully');
      }
      fetchDevices();
      handleDialogClose();
    } catch (error: any) {
      console.error('Error saving device:', error);
      toast.error(error.message || 'Failed to save device');
    }
  };
  const handleEdit = (device: Device) => {
    setEditingDevice(device);
    setFormData({
      id: device.id,
      device_name: device.device_name,
      farm_id: device.farm_id
    });
    setDialogOpen(true);
  };
  const handleDelete = async (deviceId: string) => {
    if (!confirm('Are you sure you want to delete this device?')) return;
    try {
      const {
        error
      } = await supabase.from('devices').delete().eq('id', deviceId);
      if (error) throw error;
      toast.success('Device deleted successfully');
      fetchDevices();
    } catch (error: any) {
      console.error('Error deleting device:', error);
      toast.error('Failed to delete device');
    }
  };
  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingDevice(null);
    setFormData({
      id: '',
      device_name: '',
      farm_id: ''
    });
  };
  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>;
  }
  return <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm">Device Management</CardTitle>
            <CardDescription className="text-xs">
              Register and manage ESP devices for farm monitoring
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingDevice(null)} size="lg" className="md:max-h-10 ">
                <Plus className="h-5 w-5 mr-2" />
                <span className="hidden sm:inline">Add Device</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>
                    {editingDevice ? 'Edit Device' : 'Add New Device'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingDevice ? 'Update device information' : 'Register a new ESP device for farm monitoring'}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="device_id" className="text-base">Device ID</Label>
                    <Input id="device_id" placeholder="ESP_FARM_001" value={formData.id} onChange={e => setFormData({
                    ...formData,
                    id: e.target.value
                  })} disabled={!!editingDevice} required className="h-12 text-base" />
                    <p className="text-xs text-muted-foreground">
                      Unique identifier for your ESP device
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="device_name" className="text-base">Device Name</Label>
                    <Input id="device_name" placeholder="Farm Sensor 1" value={formData.device_name} onChange={e => setFormData({
                    ...formData,
                    device_name: e.target.value
                  })} required className="h-12 text-base" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="farm" className="text-base">Farm</Label>
                    <Select value={formData.farm_id} onValueChange={value => setFormData({
                    ...formData,
                    farm_id: value
                  })} required>
                      <SelectTrigger className="h-12 text-base bg-background">
                        <SelectValue placeholder="Select a farm" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        {farms.map(farm => <SelectItem key={farm.id} value={farm.id} className="text-base">
                            {farm.farm_name}
                          </SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <Button type="button" variant="outline" onClick={handleDialogClose} className="h-12 w-full sm:w-auto text-base">
                    Cancel
                  </Button>
                  <Button type="submit" className="h-12 w-full sm:w-auto text-base">
                    {editingDevice ? 'Update Device' : 'Add Device'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {devices.length === 0 ? <div className="text-center py-16 px-4">
            <Smartphone className="h-16 w-16 md:h-12 md:w-12 mx-auto mb-6 md:mb-4 text-muted-foreground" />
            <p className="text-base md:text-sm text-muted-foreground mb-4">No devices registered yet</p>
            
          </div> : <>
            {/* Desktop Table View */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device ID</TableHead>
                    <TableHead>Device Name</TableHead>
                    <TableHead>Farm</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.map(device => <TableRow key={device.id}>
                      <TableCell className="font-mono text-sm">{device.id}</TableCell>
                      <TableCell>{device.device_name}</TableCell>
                      <TableCell>{device.farms?.farm_name}</TableCell>
                      <TableCell>
                        {new Date(device.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(device)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleDelete(device.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>)}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3 px-1">
              {devices.map(device => <Card key={device.id} className="border-2 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2.5 mb-2">
                          <Smartphone className="h-5 w-5 text-primary flex-shrink-0" />
                          <h3 className="font-semibold text-lg leading-tight">{device.device_name}</h3>
                        </div>
                        <p className="font-mono text-sm text-muted-foreground break-all leading-relaxed">
                          {device.id}
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-3 mb-5 bg-muted/30 rounded-lg p-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-muted-foreground">Farm:</span>
                        <span className="font-semibold text-base text-right">{device.farms?.farm_name}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-muted-foreground">Added:</span>
                        <span className="font-semibold text-base">
                          {new Date(device.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button variant="outline" className="flex-1 h-12 text-base font-medium" onClick={() => handleEdit(device)}>
                        <Edit className="h-5 w-5 mr-2" />
                        Edit
                      </Button>
                      <Button variant="outline" className="flex-1 h-12 text-base font-medium" onClick={() => handleDelete(device.id)}>
                        <Trash2 className="h-5 w-5 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>)}
            </div>
          </>}
      </CardContent>
    </Card>;
}