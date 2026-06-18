import { API_BASE } from '@/lib/api';
import { OpportunitiesChart } from '@/components/OpportunitiesChart';
import { ScanOpportunitiesButton } from '@/components/ScanOpportunitiesButton';

interface Opportunity {
  rank: number;
  targetSkinName: string;
  weapon: string;
  roi: number;
  expectedProfit: number;
  totalCost: number;
  targetChance: number;
  tier: string;
}

async function fetchOpportunities(): Promise<{
  items: Opportunity[];
  scannedAt?: string;
}> {
  const res = await fetch(`${API_BASE}/opportunities?limit=100`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) return { items: [] };
  return res.json() as Promise<{ items: Opportunity[]; scannedAt?: string }>;
}

export const dynamic = 'force-dynamic';

export default async function OpportunitiesPage() {
  const data = await fetchOpportunities();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">TOP 100 Oportunidades</h1>
          <p className="text-sm text-slate-400">
            Ranking heurístico · {data.items.length} itens
            {data.scannedAt && ` · ${new Date(data.scannedAt).toLocaleString('pt-BR')}`}
          </p>
        </div>
        <ScanOpportunitiesButton />
      </div>

      <div className="rounded-xl border border-surface-border bg-surface-card p-4">
        <h2 className="mb-3 text-sm font-medium text-slate-400">ROI por skin (top 12)</h2>
        <OpportunitiesChart
          items={data.items.map((i) => ({
            name: i.targetSkinName,
            roi: i.roi,
            expectedProfit: i.expectedProfit,
          }))}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-surface-border">
        <table className="min-w-full text-sm">
          <thead className="bg-surface-card text-left text-slate-400">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Skin</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">ROI</th>
              <th className="px-4 py-3">Lucro esp.</th>
              <th className="px-4 py-3">Custo</th>
              <th className="px-4 py-3">Chance alvo</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((row) => (
              <tr key={row.rank} className="border-t border-surface-border/60">
                <td className="px-4 py-2 text-slate-500">{row.rank}</td>
                <td className="px-4 py-2">
                  <div className="font-medium">{row.targetSkinName}</div>
                  <div className="text-xs text-slate-500">{row.weapon}</div>
                </td>
                <td className="px-4 py-2">{row.tier}</td>
                <td className={`px-4 py-2 ${row.roi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {row.roi.toFixed(1)}%
                </td>
                <td className="px-4 py-2">R$ {row.expectedProfit.toFixed(2)}</td>
                <td className="px-4 py-2">R$ {row.totalCost.toFixed(2)}</td>
                <td className="px-4 py-2">{(row.targetChance * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
