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

export default function PestIncidentsChart() {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [farms, setFarms] = useState<{ id: string; name: string; color: string }[]>([]);
  const [period, setPeriod] = useState<PeriodType>('day');
  const { traps } = useMqttContext();

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
  }, [period, traps]);

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

    // Group by date and farm based on selected period
    const grouped: { [date: string]: { [farmId: string]: number } } = {};
    
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
          if (!grouped[dateKey][farmId]) grouped[dateKey][farmId] = 0;
          grouped[dateKey][farmId] += reading.moth_count;
        }
      });
    }

    // Add live MQTT trap data - accumulate with existing data
    Object.entries(traps).forEach(([deviceId, trapData]) => {
      const farmId = deviceToFarm[deviceId];
      if (farmId && trapData.moth_count !== undefined) {
        const readingDate = new Date();
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

        if (!grouped[dateKey]) grouped[dateKey] = {};
        if (!grouped[dateKey][farmId]) grouped[dateKey][farmId] = 0;
        // Add MQTT data to the total sum
        grouped[dateKey][farmId] += trapData.moth_count;
      }
    });

    // Convert to chart format and sort by date
    const chartDataResult = Object.entries(grouped)
      .map(([date, farms]) => {
        const dataPoint: ChartDataPoint = { date };
        Object.entries(farms).forEach(([farmId, count]) => {
          const farm = farmsWithColors.find(f => f.id === farmId);
          if (farm) {
            dataPoint[farm.name] = count;
          }
        });
        return dataPoint;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    console.log('Chart data prepared:', chartDataResult);
    setChartData(chartDataResult);
  };

  if (chartData.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
        No pest incident data available
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
          <YAxis label={{ value: 'Moth Count', angle: -90, position: 'insideLeft' }} />
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
