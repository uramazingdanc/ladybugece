import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface AlertDistributionChartProps {
  greenCount: number;
  yellowCount: number;
  redCount: number;
}

export default function AlertDistributionChart({ greenCount, yellowCount, redCount }: AlertDistributionChartProps) {
  const data = [
    { name: 'Green', value: greenCount, color: '#22c55e' },
    { name: 'Yellow', value: yellowCount, color: '#eab308' },
    { name: 'Red', value: redCount, color: '#ef4444' }
  ].filter(item => item.value > 0);

  if (data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
        No alert data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, value }) => `${name}: ${value}`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
