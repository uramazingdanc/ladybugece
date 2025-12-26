import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const farmSchema = z.object({
  farm_name: z.string().min(1, 'Farm name is required').max(100, 'Farm name must be less than 100 characters'),
  latitude: z.coerce.number().min(-90, 'Latitude must be between -90 and 90').max(90, 'Latitude must be between -90 and 90'),
  longitude: z.coerce.number().min(-180, 'Longitude must be between -180 and 180').max(180, 'Longitude must be between -180 and 180'),
  device_id: z.string().min(1, 'Device ID is required').max(50, 'Device ID must be less than 50 characters'),
});

type FarmFormData = z.infer<typeof farmSchema>;

interface Farm {
  id: string;
  farm_name: string;
  latitude: number;
  longitude: number;
  device_id?: string;
}

interface FarmFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farm?: Farm | null;
  onSuccess: () => void;
}

export default function FarmFormDialog({ open, onOpenChange, farm, onSuccess }: FarmFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const isEditing = !!farm;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FarmFormData>({
    resolver: zodResolver(farmSchema),
    defaultValues: {
      farm_name: '',
      latitude: 0,
      longitude: 0,
      device_id: '',
    },
  });

  useEffect(() => {
    if (farm) {
      reset({
        farm_name: farm.farm_name,
        latitude: farm.latitude,
        longitude: farm.longitude,
        device_id: farm.device_id || '',
      });
    } else {
      reset({
        farm_name: '',
        latitude: 15.5,
        longitude: 121.0,
        device_id: '',
      });
    }
  }, [farm, reset, open]);

  const onSubmit = async (data: FarmFormData) => {
    setLoading(true);
    try {
      if (isEditing && farm) {
        // Update existing farm
        const { error: farmError } = await supabase
          .from('farms')
          .update({
            farm_name: data.farm_name,
            latitude: data.latitude,
            longitude: data.longitude,
          })
          .eq('id', farm.id);

        if (farmError) throw farmError;

        // Update device if changed
        if (data.device_id !== farm.device_id) {
          // Delete old device if exists
          if (farm.device_id) {
            await supabase.from('devices').delete().eq('id', farm.device_id);
          }
          
          // Create new device
          const { error: deviceError } = await supabase
            .from('devices')
            .upsert({
              id: data.device_id,
              device_name: `${data.farm_name} Device`,
              farm_id: farm.id,
            });

          if (deviceError) throw deviceError;
        } else {
          // Update device name
          await supabase
            .from('devices')
            .update({ device_name: `${data.farm_name} Device` })
            .eq('id', data.device_id);
        }

        toast.success('Farm updated successfully');
      } else {
        // Create new farm
        const { data: newFarm, error: farmError } = await supabase
          .from('farms')
          .insert({
            farm_name: data.farm_name,
            latitude: data.latitude,
            longitude: data.longitude,
          })
          .select()
          .single();

        if (farmError) throw farmError;

        // Create device for the farm
        const { error: deviceError } = await supabase
          .from('devices')
          .insert({
            id: data.device_id,
            device_name: `${data.farm_name} Device`,
            farm_id: newFarm.id,
          });

        if (deviceError) throw deviceError;

        toast.success('Farm created successfully');
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving farm:', error);
      toast.error(error.message || 'Failed to save farm');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Farm' : 'Add New Farm'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="farm_name">Farm Name</Label>
            <Input
              id="farm_name"
              placeholder="Enter farm name"
              {...register('farm_name')}
            />
            {errors.farm_name && (
              <p className="text-sm text-destructive">{errors.farm_name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="device_id">Device ID (MQTT Topic)</Label>
            <Input
              id="device_id"
              placeholder="e.g., trap1, trap2"
              {...register('device_id')}
            />
            <p className="text-xs text-muted-foreground">
              This will be used for MQTT topics: ladybug/{'{device_id}'}/status
            </p>
            {errors.device_id && (
              <p className="text-sm text-destructive">{errors.device_id.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="latitude">Latitude</Label>
              <Input
                id="latitude"
                type="number"
                step="any"
                placeholder="e.g., 15.5"
                {...register('latitude')}
              />
              {errors.latitude && (
                <p className="text-sm text-destructive">{errors.latitude.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="longitude">Longitude</Label>
              <Input
                id="longitude"
                type="number"
                step="any"
                placeholder="e.g., 121.0"
                {...register('longitude')}
              />
              {errors.longitude && (
                <p className="text-sm text-destructive">{errors.longitude.message}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
