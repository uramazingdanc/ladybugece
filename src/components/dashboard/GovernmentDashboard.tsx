import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import AlertDistributionChart from './AlertDistributionChart';
import PestIncidentsChart from './PestIncidentsChart';
import LarvaDensityChart from './LarvaDensityChart';
import { useMqttContext } from '@/contexts/MqttContext';

interface Stats {
  totalFarms: number;
  redAlerts: number;
  yellowAlerts: number;
  greenAlerts: number;
  totalReadings: number;
}

export default function GovernmentDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalFarms: 0,
    redAlerts: 0,
    yellowAlerts: 0,
    greenAlerts: 0,
    totalReadings: 0
  });
  const [loading, setLoading] = useState(true);
  const [generatingReport, setGeneratingReport] = useState(false);
  const { traps } = useMqttContext();

  useEffect(() => {
    fetchStats();

    // Subscribe to real-time updates
    const channel = supabase.channel('dashboard-realtime').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'ipm_alerts'
    }, payload => {
      console.log('Dashboard: Real-time alert update:', payload);
      fetchStats();
    }).on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'pest_readings'
    }, payload => {
      console.log('Dashboard: New reading received:', payload);
      fetchStats();
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Also update stats when MQTT traps change
  useEffect(() => {
    if (Object.keys(traps).length > 0) {
      console.log('Dashboard: MQTT traps updated, refreshing stats');
      fetchStats();
    }
  }, [traps]);

  const fetchStats = async () => {
    try {
      // Fetch all farms and their alerts
      const {
        data: farms
      } = await supabase.from('farms').select(`
          id,
          ipm_alerts (
            alert_level
          )
        `);

      // Fetch total readings count
      const {
        count: readingsCount
      } = await supabase.from('pest_readings').select('*', {
        count: 'exact',
        head: true
      });
      if (farms) {
        const redAlerts = farms.filter(f => f.ipm_alerts?.alert_level === 'Red').length;
        const yellowAlerts = farms.filter(f => f.ipm_alerts?.alert_level === 'Yellow').length;
        const greenAlerts = farms.filter(f => f.ipm_alerts?.alert_level === 'Green').length;
        setStats({
          totalFarms: farms.length,
          redAlerts,
          yellowAlerts,
          greenAlerts,
          totalReadings: readingsCount || 0
        });
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    setGeneratingReport(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-report`,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to generate report');

      // Download the CSV file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ladybug-report-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Report generated successfully!');
    } catch (error: any) {
      toast.error('Failed to generate report: ' + error.message);
    } finally {
      setGeneratingReport(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading statistics...</div>;
  }

  return <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-sm">Analytics Dashboard</h2>
          <p className="text-muted-foreground text-sm">Overview of pest monitoring across all farms</p>
        </div>
        <Button onClick={generateReport} disabled={generatingReport} className="bg-primary hover:bg-primary/90">
          {generatingReport ? <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </> : <>
              <FileText className="mr-2 h-4 w-4" />
              Generate Report
            </>}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Farms Monitored</p>
                <div className="text-3xl font-bold mt-2">{stats.totalFarms.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">Active monitoring sites</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-alert-green/10 to-alert-green/5">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-alert-green"></div>
                  Green Alert (Low Risk)
                </p>
                <div className="text-3xl font-bold text-alert-green mt-2">{stats.greenAlerts.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">Safe zones</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-alert-yellow/10 to-alert-yellow/5">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-alert-yellow"></div>
                  Yellow Alert (Medium Risk)
                </p>
                <div className="text-3xl font-bold text-alert-yellow mt-2">{stats.yellowAlerts.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">Monitor closely</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-alert-red/10 to-alert-red/5">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-alert-red"></div>
                  Red Alert (High Risk)
                </p>
                <div className="text-3xl font-bold text-alert-red mt-2">{stats.redAlerts.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">Immediate action needed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alert Level Distribution Chart */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Farms by Alert Level</CardTitle>
            <CardDescription>Current alert distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDistributionChart greenCount={stats.greenAlerts} yellowCount={stats.yellowAlerts} redCount={stats.redAlerts} />
          </CardContent>
        </Card>

        {/* Pest Incidents Over Time */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Pest Incidents Over Time</CardTitle>
            <CardDescription>Historical trend analysis (Moth Count)</CardDescription>
          </CardHeader>
          <CardContent>
            <PestIncidentsChart />
          </CardContent>
        </Card>
      </div>

      {/* Larva Density Chart - Full Width */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">Predicted Larva Density Over Time</CardTitle>
          <CardDescription>Estimated larva population for better analysis and decision-making</CardDescription>
        </CardHeader>
        <CardContent>
          <LarvaDensityChart />
        </CardContent>
      </Card>
    </div>;
}