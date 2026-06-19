import { DashboardStatus } from '@/components/DashboardStatus';
import { DashboardOpportunities } from '@/components/DashboardOpportunities';
import { fetchOpportunities } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const opportunities = await fetchOpportunities(12);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-400">
          Visão geral da plataforma e melhores oportunidades de trade up
        </p>
      </div>

      <DashboardStatus />
      <DashboardOpportunities initialData={opportunities} />
    </div>
  );
}
