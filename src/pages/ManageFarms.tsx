import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';

interface Farm {
  id: string;
  farm_name: string;
  latitude: number;
  longitude: number;
}

interface Device {
  id: string;
  device_name: string;
  farm_id: string;
}

export default function ManageFarms() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Add Farm Form
  const [farmName, setFarmName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [addFarmOpen, setAddFarmOpen] = useState(false);
  
  // Add Device Form
  const [deviceId, setDeviceId] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [selectedFarmId, setSelectedFarmId] = useState('');
  const [addDeviceOpen, setAddDeviceOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchFarms();
      fetchDevices();
    }
  }, [user]);

  const fetchFarms = async () => {
    try {
      const { data, error } = await supabase
        .from('farms')
        .select('*')
        .eq('owner_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFarms(data || []);
    } catch (error: any) {
      toast.error('Failed to fetch farms');
    } finally {
      setLoading(false);
    }
  };

  const fetchDevices = async () => {
    try {
      const { data: farmsData } = await supabase
        .from('farms')
        .select('id')
        .eq('owner_id', user?.id);

      if (!farmsData) return;

      const farmIds = farmsData.map(f => f.id);
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .in('farm_id', farmIds);

      if (error) throw error;
      setDevices(data || []);
    } catch (error: any) {
      toast.error('Failed to fetch devices');
    }
  };

  const handleAddFarm = async () => {
    if (!farmName || !latitude || !longitude) {
      toast.error('Please fill all fields');
      return;
    }

    try {
      const { error } = await supabase
        .from('farms')
        .insert({
          owner_id: user?.id,
          farm_name: farmName,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
        });

      if (error) throw error;

      toast.success('Farm added successfully');
      setFarmName('');
      setLatitude('');
      setLongitude('');
      setAddFarmOpen(false);
      fetchFarms();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add farm');
    }
  };

  const handleDeleteFarm = async (farmId: string) => {
    try {
      const { error } = await supabase
        .from('farms')
        .delete()
        .eq('id', farmId);

      if (error) throw error;

      toast.success('Farm deleted successfully');
      fetchFarms();
      fetchDevices();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete farm');
    }
  };

  const handleAddDevice = async () => {
    if (!deviceId || !deviceName || !selectedFarmId) {
      toast.error('Please fill all fields');
      return;
    }

    try {
      const { error } = await supabase
        .from('devices')
        .insert({
          id: deviceId,
          device_name: deviceName,
          farm_id: selectedFarmId,
        });

      if (error) throw error;

      toast.success('Device added successfully');
      setDeviceId('');
      setDeviceName('');
      setSelectedFarmId('');
      setAddDeviceOpen(false);
      fetchDevices();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add device');
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    try {
      const { error } = await supabase
        .from('devices')
        .delete()
        .eq('id', deviceId);

      if (error) throw error;

      toast.success('Device deleted successfully');
      fetchDevices();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete device');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="mb-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Manage Farms & Devices</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Farms Section */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">My Farms</h2>
            <Dialog open={addFarmOpen} onOpenChange={setAddFarmOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Farm
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Farm</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="farmName">Farm Name</Label>
                    <Input
                      id="farmName"
                      value={farmName}
                      onChange={(e) => setFarmName(e.target.value)}
                      placeholder="My Onion Farm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="latitude">Latitude</Label>
                    <Input
                      id="latitude"
                      type="number"
                      step="any"
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                      placeholder="14.5995"
                    />
                  </div>
                  <div>
                    <Label htmlFor="longitude">Longitude</Label>
                    <Input
                      id="longitude"
                      type="number"
                      step="any"
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                      placeholder="120.9842"
                    />
                  </div>
                  <Button onClick={handleAddFarm} className="w-full">
                    Add Farm
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {farms.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">
                    No farms added yet. Click "Add Farm" to get started.
                  </p>
                </CardContent>
              </Card>
            ) : (
              farms.map((farm) => (
                <Card key={farm.id}>
                  <CardHeader>
                    <CardTitle className="flex justify-between items-start">
                      <span>{farm.farm_name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteFarm(farm.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </CardTitle>
                    <CardDescription>
                      Lat: {farm.latitude.toFixed(4)}, Long: {farm.longitude.toFixed(4)}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Devices Section */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">My Devices</h2>
            <Dialog open={addDeviceOpen} onOpenChange={setAddDeviceOpen}>
              <DialogTrigger asChild>
                <Button disabled={farms.length === 0}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Device
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Device</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="deviceId">Device ID (Serial)</Label>
                    <Input
                      id="deviceId"
                      value={deviceId}
                      onChange={(e) => setDeviceId(e.target.value)}
                      placeholder="LADYBUG-001"
                    />
                  </div>
                  <div>
                    <Label htmlFor="deviceName">Device Name</Label>
                    <Input
                      id="deviceName"
                      value={deviceName}
                      onChange={(e) => setDeviceName(e.target.value)}
                      placeholder="Field A Collector"
                    />
                  </div>
                  <div>
                    <Label htmlFor="farmSelect">Assign to Farm</Label>
                    <select
                      id="farmSelect"
                      value={selectedFarmId}
                      onChange={(e) => setSelectedFarmId(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2"
                    >
                      <option value="">Select a farm...</option>
                      {farms.map((farm) => (
                        <option key={farm.id} value={farm.id}>
                          {farm.farm_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button onClick={handleAddDevice} className="w-full">
                    Add Device
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {devices.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">
                    No devices added yet. {farms.length === 0 ? 'Add a farm first, then ' : 'Click "Add Device" to get started.'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              devices.map((device) => {
                const farm = farms.find(f => f.id === device.farm_id);
                return (
                  <Card key={device.id}>
                    <CardHeader>
                      <CardTitle className="flex justify-between items-start">
                        <span>{device.device_name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteDevice(device.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </CardTitle>
                      <CardDescription>
                        ID: {device.id}
                        <br />
                        Farm: {farm?.farm_name || 'Unknown'}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
