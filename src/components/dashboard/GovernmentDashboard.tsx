import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Download, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

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

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    // Fetch all farms and their alerts
    const { data: farms } = await supabase
      .from('farms')
      .select(`
        id,
        ipm_alerts (
          alert_level
        )
      `);

    if (farms) {
      const redAlerts = farms.filter(f => f.ipm_alerts?.[0]?.alert_level === 'Red').length;
      const yellowAlerts = farms.filter(f => f.ipm_alerts?.[0]?.alert_level === 'Yellow').length;
      const greenAlerts = farms.filter(f => f.ipm_alerts?.[0]?.alert_level === 'Green').length;

      setStats({
        totalFarms: farms.length,
        redAlerts,
        yellowAlerts,
        greenAlerts,
        totalReadings: 0 // Could fetch total readings count if needed
      });
    }

    setLoading(false);
  };

  const generateReport = async () => {
    setGeneratingReport(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-report', {
        method: 'GET'
      });

      if (error) throw error;

      // Download the report
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ladybug-report-${new Date().toISOString().split('T')[0]}.json`;
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">Regional Overview</h2>
        <p className="text-muted-foreground text-lg">Monitor onion armyworm activity across all farms</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Farms</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalFarms}</div>
          </CardContent>
        </Card>

        <Card className="border-alert-red bg-alert-red-light/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Red Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-alert-red">{stats.redAlerts}</div>
            <p className="text-xs text-muted-foreground mt-1">Critical action needed</p>
          </CardContent>
        </Card>

        <Card className="border-alert-yellow bg-alert-yellow-light/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Yellow Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-alert-yellow">{stats.yellowAlerts}</div>
            <p className="text-xs text-muted-foreground mt-1">Monitor closely</p>
          </CardContent>
        </Card>

        <Card className="border-alert-green bg-alert-green-light/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Green Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-alert-green">{stats.greenAlerts}</div>
            <p className="text-xs text-muted-foreground mt-1">No action needed</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="grid gap-4 md:grid-cols-1">
        <Card className="bg-gradient-to-br from-accent/10 to-earth/10 border-accent/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Generate Report
            </CardTitle>
            <CardDescription>Download comprehensive regional analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={generateReport} 
              size="lg" 
              variant="outline" 
              className="w-full gap-2"
              disabled={generatingReport}
            >
              <Download className="w-5 h-5" />
              {generatingReport ? 'Generating...' : 'Download Report'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Alert Distribution Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Alert Distribution</CardTitle>
          <CardDescription>Current status across all monitored farms</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Critical (Red)</span>
                <span className="text-sm font-medium">{stats.redAlerts} farms</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-alert-red rounded-full transition-all"
                  style={{ width: `${(stats.redAlerts / stats.totalFarms) * 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Warning (Yellow)</span>
                <span className="text-sm font-medium">{stats.yellowAlerts} farms</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-alert-yellow rounded-full transition-all"
                  style={{ width: `${(stats.yellowAlerts / stats.totalFarms) * 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Safe (Green)</span>
                <span className="text-sm font-medium">{stats.greenAlerts} farms</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-alert-green rounded-full transition-all"
                  style={{ width: `${(stats.greenAlerts / stats.totalFarms) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
