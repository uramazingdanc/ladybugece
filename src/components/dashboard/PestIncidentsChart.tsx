import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '@/integrations/supabase/client';

export default function PestIncidentsChart() {
  const [chartData, setChartData] = useState<{ date: string; count: number }[]>([]);

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
    const { data } = await supabase
      .from('pest_readings')
      .select('created_at')
      .order('created_at', { ascending: true });

    if (data) {
      // Group by date
      const grouped = data.reduce((acc: Record<string, number>, reading) => {
        const date = new Date(reading.created_at).toLocaleDateString();
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {});

      const chartData = Object.entries(grouped).map(([date, count]) => ({
        date,
        count
      }));

      setChartData(chartData);
    }
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}
