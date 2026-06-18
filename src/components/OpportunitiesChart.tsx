'use client';

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface OpportunityChartItem {
  name: string;
  roi: number;
  expectedProfit: number;
}

export function OpportunitiesChart({ items }: { items: OpportunityChartItem[] }) {
  const data = items.slice(0, 12).map((item) => ({
    name: item.name.length > 22 ? `${item.name.slice(0, 20)}…` : item.name,
    roi: item.roi,
    profit: item.expectedProfit,
  }));

  if (data.length === 0) {
    return <p className="text-sm text-slate-500">Sem dados para exibir.</p>;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
          <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: '#1a2332', border: '1px solid #2d3a4f' }}
            labelStyle={{ color: '#e2e8f0' }}
          />
          <Bar dataKey="roi" fill="#f59e0b" name="ROI %" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
