import { DashboardOpportunities } from '@/components/DashboardOpportunities';
import { fetchOpportunities } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const opportunities = await fetchOpportunities(12);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-400">
          Melhores oportunidades de trade up — clique em uma skin para ver detalhes e gráfico
        </p>
      </div>

      <DashboardOpportunities initialData={opportunities} />
    </div>
  );
}
