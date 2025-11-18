import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface AlertDistributionChartProps {
  greenCount: number;
  yellowCount: number;
  redCount: number;
}

export default function AlertDistributionChart({ greenCount, yellowCount, redCount }: AlertDistributionChartProps) {
  const data = [
    { name: 'Green', value: greenCount, color: 'hsl(var(--success))' },
    { name: 'Yellow', value: yellowCount, color: 'hsl(var(--warning))' },
    { name: 'Red', value: redCount, color: 'hsl(var(--destructive))' }
  ];

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
