import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';

interface Farm {
  id: string;
  farm_name: string;
}

interface DeleteFarmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farm: Farm | null;
  onSuccess: () => void;
}

export default function DeleteFarmDialog({ open, onOpenChange, farm, onSuccess }: DeleteFarmDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!farm) return;
    
    setLoading(true);
    try {
      // Delete associated devices first
      const { error: devicesError } = await supabase
        .from('devices')
        .delete()
        .eq('farm_id', farm.id);

      if (devicesError) throw devicesError;

      // Delete farm
      const { error: farmError } = await supabase
        .from('farms')
        .delete()
        .eq('id', farm.id);

      if (farmError) throw farmError;

      toast.success(`${farm.farm_name} deleted successfully`);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error deleting farm:', error);
      toast.error(error.message || 'Failed to delete farm');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Farm</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>{farm?.farm_name}</strong>? 
            This will also delete all associated devices and cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleDelete} 
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
