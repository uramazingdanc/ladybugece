import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { startOfWeek, startOfMonth, format } from 'date-fns';
import { useMqttContext } from '@/contexts/MqttContext';

interface ChartDataPoint {
  date: string;
  [key: string]: string | number;
}

type PeriodType = 'day' | 'week' | 'month';

export default function LarvaDensityChart() {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [farms, setFarms] = useState<{ id: string; name: string; color: string }[]>([]);
  const [period, setPeriod] = useState<PeriodType>('day');
  const { traps } = useMqttContext();

  useEffect(() => {
    fetchDensityData();

    const channel = supabase
      .channel('larva-density-chart')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pest_readings'
        },
        () => {
          fetchDensityData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [period, traps]);

  const fetchDensityData = async () => {
    // Fetch all farms
    const { data: farmsData } = await supabase
      .from('farms')
      .select('id, farm_name');

    if (!farmsData) return;

    // Assign colors to farms
    const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#8b5cf6', '#ec4899'];
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

    // Fetch readings with larva_density
    const { data: readings } = await supabase
      .from('pest_readings')
      .select('larva_density, created_at, device_id')
      .not('larva_density', 'is', null)
      .order('created_at', { ascending: true });

    console.log('Larva density readings fetched:', readings);

    // Group by date and farm based on selected period
    const grouped: { [date: string]: { [farmId: string]: { total: number; count: number } } } = {};
    
    // Add database readings
    if (readings) {
      readings.forEach((reading: any) => {
        const readingDate = new Date(reading.created_at);
        let dateKey: string;

        if (period === 'day') {
          dateKey = format(readingDate, 'MMM dd, yyyy');
        } else if (period === 'week') {
          const weekStart = startOfWeek(readingDate, { weekStartsOn: 0 });
          dateKey = format(weekStart, 'MMM dd, yyyy');
        } else {
          const monthStart = startOfMonth(readingDate);
          dateKey = format(monthStart, 'MMM yyyy');
        }

        const farmId = deviceToFarm[reading.device_id];
        
        if (farmId) {
          if (!grouped[dateKey]) grouped[dateKey] = {};
          if (!grouped[dateKey][farmId]) grouped[dateKey][farmId] = { total: 0, count: 0 };
          grouped[dateKey][farmId].total += reading.larva_density || 0;
          grouped[dateKey][farmId].count += 1;
        }
      });
    }

    // Add live MQTT trap data for today
    const today = format(new Date(), 'MMM dd, yyyy');
    Object.entries(traps).forEach(([deviceId, trapData]) => {
      const farmId = deviceToFarm[deviceId];
      if (farmId && trapData.larva_density !== undefined) {
        if (!grouped[today]) grouped[today] = {};
        if (!grouped[today][farmId]) grouped[today][farmId] = { total: 0, count: 0 };
        grouped[today][farmId].total += trapData.larva_density;
        grouped[today][farmId].count += 1;
      }
    });

    // Convert to chart format with averages and sort by date
    const chartDataResult = Object.entries(grouped)
      .map(([date, farms]) => {
        const dataPoint: ChartDataPoint = { date };
        Object.entries(farms).forEach(([farmId, { total, count }]) => {
          const farm = farmsWithColors.find(f => f.id === farmId);
          if (farm) {
            dataPoint[farm.name] = Math.round(total / count);
          }
        });
        return dataPoint;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    console.log('Larva density chart data prepared:', chartDataResult);
    setChartData(chartDataResult);
  };

  if (chartData.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
        No predicted larva density data available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={period} onValueChange={(value) => setPeriod(value as PeriodType)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="day">Daily</TabsTrigger>
          <TabsTrigger value="week">Weekly</TabsTrigger>
          <TabsTrigger value="month">Monthly</TabsTrigger>
        </TabsList>
      </Tabs>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis label={{ value: 'Larva Density', angle: -90, position: 'insideLeft' }} />
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
    </div>
  );
}
