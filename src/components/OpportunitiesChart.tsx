'use client';

import {
  Bar,
  BarChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface OpportunityChartItem {
  name: string;
  roi: number;
  expectedProfit: number;
  referencePrice?: number;
  estimatedCost?: number;
  expectedValue?: number;
}

export function OpportunitiesChart({ items }: { items: OpportunityChartItem[] }) {
  const data = items.slice(0, 12).map((item) => ({
    name: item.name.length > 22 ? `${item.name.slice(0, 20)}…` : item.name,
    roi: item.roi,
    profit: item.expectedProfit,
    referencia: item.referencePrice ?? 0,
    custo: item.estimatedCost ?? 0,
    valorEsperado: item.expectedValue ?? 0,
  }));

  if (data.length === 0) {
    return <p className="text-sm text-slate-500">Sem dados para exibir.</p>;
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
          <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: '#1a2332', border: '1px solid #2d3a4f' }}
            labelStyle={{ color: '#e2e8f0' }}
            formatter={(value: number, key: string) => {
              if (key === 'roi') return [`${value.toFixed(1)}%`, 'ROI'];
              return [`R$ ${value.toFixed(2)}`, key];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
          <Bar dataKey="referencia" fill="#38bdf8" name="Referência" radius={[4, 4, 0, 0]} />
          <Bar dataKey="custo" fill="#f59e0b" name="Custo atual" radius={[4, 4, 0, 0]} />
          <Bar dataKey="valorEsperado" fill="#34d399" name="Valor esperado" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
