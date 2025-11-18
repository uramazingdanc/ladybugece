import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { supabase } from '@/integrations/supabase/client';

interface ChartDataPoint {
  date: string;
  [key: string]: string | number;
}

export default function PestIncidentsChart() {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [farms, setFarms] = useState<{ id: string; name: string; color: string }[]>([]);

  useEffect(() => {
    fetchIncidentsData();

    const channel = supabase
      .channel('pest-incidents-chart')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pest_readings'
        },
        () => {
          fetchIncidentsData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchIncidentsData = async () => {
    // Fetch all farms
    const { data: farmsData } = await supabase
      .from('farms')
      .select('id, farm_name');

    if (!farmsData) return;

    // Assign colors to farms
    const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];
    const farmsWithColors = farmsData.map((farm, index) => ({
      id: farm.id,
      name: farm.farm_name,
      color: colors[index % colors.length]
    }));
    setFarms(farmsWithColors);

    // Fetch devices to map device_id to farm_id
    const { data: devicesData } = await supabase
      .from('devices')
      .select('id, farm_id');

    if (!devicesData) return;

    // Create device to farm mapping
    const deviceToFarm: { [deviceId: string]: string } = {};
    devicesData.forEach(device => {
      deviceToFarm[device.id] = device.farm_id;
    });

    // Fetch readings separately (no nested query)
    const { data: readings } = await supabase
      .from('pest_readings')
      .select('moth_count, created_at, device_id')
      .order('created_at', { ascending: true });

    console.log('Pest readings fetched:', readings);

    if (readings && readings.length > 0) {
      // Group by date and farm
      const grouped: { [date: string]: { [farmId: string]: number } } = {};
      
      readings.forEach((reading: any) => {
        const date = new Date(reading.created_at).toLocaleDateString();
        const farmId = deviceToFarm[reading.device_id];
        
        if (farmId) {
          if (!grouped[date]) grouped[date] = {};
          if (!grouped[date][farmId]) grouped[date][farmId] = 0;
          grouped[date][farmId] += reading.moth_count;
        }
      });

      // Convert to chart format
      const chartData = Object.entries(grouped).map(([date, farms]) => {
        const dataPoint: ChartDataPoint = { date };
        Object.entries(farms).forEach(([farmId, count]) => {
          const farm = farmsWithColors.find(f => f.id === farmId);
          if (farm) {
            dataPoint[farm.name] = count;
          }
        });
        return dataPoint;
      });

      console.log('Chart data prepared:', chartData);
      setChartData(chartData);
    } else {
      console.log('No readings data available');
      setChartData([]);
    }
  };

  if (chartData.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
        No pest incident data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Legend />
        {farms.map((farm) => (
          <Line
            key={farm.id}
            type="monotone"
            dataKey={farm.name}
            stroke={farm.color}
            strokeWidth={2}
            dot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
