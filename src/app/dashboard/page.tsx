import { DashboardStatus } from '@/components/DashboardStatus';
import { DashboardOpportunities } from '@/components/DashboardOpportunities';

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <DashboardStatus />
      <DashboardOpportunities />
    </div>
  );
}
