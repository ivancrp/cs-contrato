import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface HistogramProps {
  data: { range: string; count: number; percentage?: number }[];
}

export function Histogram({ data }: HistogramProps) {
  return (
    <div className="histogram">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <XAxis dataKey="range" tick={{ fill: '#8b9cb3', fontSize: 11 }} />
          <YAxis tick={{ fill: '#8b9cb3', fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              background: '#1a2332',
              border: '1px solid #2a3a4f',
              borderRadius: 8,
            }}
            labelStyle={{ color: '#e8edf4' }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={i % 2 === 0 ? '#4f8cff' : '#3b6fd9'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
