import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Reading {
  moth_count: number;
  created_at: string;
}

interface MothCountChartProps {
  readings: Reading[];
}

export default function MothCountChart({ readings }: MothCountChartProps) {
  const chartData = readings
    .map(r => ({
      date: new Date(r.created_at).toLocaleDateString(),
      count: r.moth_count
    }))
    .reverse();

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
