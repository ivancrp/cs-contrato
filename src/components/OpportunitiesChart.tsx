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
import type { TooltipProps } from 'recharts';

export interface OpportunityChartItem {
  name: string;
  roi: number;
  expectedProfit: number;
  referencePrice?: number;
  estimatedCost?: number;
  expectedValue?: number;
}

const SERIES_LABELS: Record<string, string> = {
  referencia: 'Referência',
  custo: 'Custo atual',
  valorEsperado: 'Valor esperado',
};

const SERIES_COLORS: Record<string, string> = {
  referencia: '#38bdf8',
  custo: '#f59e0b',
  valorEsperado: '#34d399',
};

function chartLabel(name: string): string {
  const skin = name.includes('|') ? (name.split('|').pop()?.trim() ?? name) : name;
  return skin.length > 18 ? `${skin.slice(0, 16)}…` : skin;
}

function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;

  const fullName = payload[0]?.payload?.fullName ?? label;

  return (
    <div className="chart-tooltip">
      <p className="mb-2 max-w-[240px] text-xs font-medium leading-snug text-slate-200">{fullName}</p>
      <ul className="space-y-1">
        {payload.map((entry) => {
          const key = String(entry.dataKey);
          return (
            <li key={key} className="flex items-center justify-between gap-4 text-xs">
              <span style={{ color: SERIES_COLORS[key] ?? entry.color }}>{SERIES_LABELS[key] ?? key}</span>
              <span className="font-medium tabular-nums text-slate-100">
                R$ {Number(entry.value).toFixed(2)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const ACTIVE_BAR = {
  stroke: 'rgba(148, 163, 184, 0.45)',
  strokeWidth: 1,
  fillOpacity: 0.92,
};

export function OpportunitiesChart({
  items,
  maxItems = 12,
  className = 'h-80',
}: {
  items: OpportunityChartItem[];
  maxItems?: number;
  className?: string;
}) {
  const data = items.slice(0, maxItems).map((item) => ({
    fullName: item.name,
    name: chartLabel(item.name),
    roi: item.roi,
    profit: item.expectedProfit,
    referencia: item.referencePrice ?? 0,
    custo: item.estimatedCost ?? 0,
    valorEsperado: item.expectedValue ?? 0,
  }));

  if (data.length === 0) {
    return <p className="text-sm text-slate-500">Sem dados para exibir.</p>;
  }

  const bottomMargin = data.length > 8 ? 64 : 52;

  return (
    <div className={`chart-opportunities w-full ${className}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 12, left: 4, bottom: bottomMargin }}
          barCategoryGap="18%"
          barGap={4}
        >
          <XAxis
            dataKey="name"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            angle={data.length > 6 ? -40 : -28}
            textAnchor="end"
            interval={0}
            height={bottomMargin - 8}
          />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} width={48} />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ fill: 'rgba(148, 163, 184, 0.07)', radius: 6 }}
            animationDuration={280}
            animationEasing="ease-out"
            offset={12}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8', paddingTop: 8 }} />
          <Bar
            dataKey="referencia"
            fill="#38bdf8"
            name="Referência"
            radius={[4, 4, 0, 0]}
            activeBar={ACTIVE_BAR}
            isAnimationActive
            animationDuration={500}
            animationEasing="ease-out"
          />
          <Bar
            dataKey="custo"
            fill="#f59e0b"
            name="Custo atual"
            radius={[4, 4, 0, 0]}
            activeBar={ACTIVE_BAR}
            isAnimationActive
            animationDuration={500}
            animationEasing="ease-out"
          />
          <Bar
            dataKey="valorEsperado"
            fill="#34d399"
            name="Valor esperado"
            radius={[4, 4, 0, 0]}
            activeBar={ACTIVE_BAR}
            isAnimationActive
            animationDuration={500}
            animationEasing="ease-out"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
