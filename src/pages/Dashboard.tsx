import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import FarmerDashboard from '@/components/dashboard/FarmerDashboard';
import GovernmentDashboard from '@/components/dashboard/GovernmentDashboard';
import { Button } from '@/components/ui/button';
import { LogOut, Bug } from 'lucide-react';

export default function Dashboard() {
  const { user, userRole, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Bug className="w-16 h-16 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-xl text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <Bug className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">LADYBUG</h1>
              <p className="text-xs text-muted-foreground">
                {userRole === 'farmer' ? 'Farmer Dashboard' : 'Government Dashboard'}
              </p>
            </div>
          </div>
          <Button onClick={signOut} variant="outline" size="sm" className="gap-2">
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {userRole === 'farmer' ? <FarmerDashboard /> : <GovernmentDashboard />}
      </main>
    </div>
  );
}
