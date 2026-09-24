import { AlertTriangle, FileBarChart, Gauge, ListChecks, ShieldAlert, Siren } from 'lucide-react';

import { Link } from '@/components/navigation/link';
import { Button } from '@/components/ui/button';
import { dashboard } from '@/lib/messages/dashboard';
import { usePermissions } from '@/lib/permissions';

import type { PermissionId } from '@/lib/permissions';
import type { LucideIcon } from 'lucide-react';

interface QuickAction {
  readonly permission: PermissionId;
  readonly path: string;
  readonly label: string;
  readonly icon: LucideIcon;
}

const CANDIDATES: readonly QuickAction[] = [
  {
    permission: 'risk:create',
    path: '/risks/new',
    label: dashboard.quickActions.newRisk,
    icon: ShieldAlert,
  },
  {
    permission: 'incident:create',
    path: '/incidents/new',
    label: dashboard.quickActions.newIncident,
    icon: Siren,
  },
  {
    permission: 'problem:create',
    path: '/problems/new',
    label: dashboard.quickActions.newProblem,
    icon: AlertTriangle,
  },
  {
    permission: 'action:view',
    path: '/actions',
    label: dashboard.quickActions.myActions,
    icon: ListChecks,
  },
  {
    permission: 'indicator:view',
    path: '/indicators',
    label: dashboard.quickActions.indicators,
    icon: Gauge,
  },
  {
    permission: 'report:view',
    path: '/reports',
    label: dashboard.quickActions.reports,
    icon: FileBarChart,
  },
];

export function DashboardQuickActions(): React.JSX.Element | null {
  const { hasPermission } = usePermissions();
  const available = CANDIDATES.filter((action) => hasPermission(action.permission));

  if (available.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="dashboard-quick-actions-heading" className="flex flex-col gap-1">
      <h2
        id="dashboard-quick-actions-heading"
        className="text-sm font-medium text-muted-foreground"
      >
        {dashboard.quickActions.heading}
      </h2>
      <div
        className="flex flex-wrap gap-1.5"
        role="group"
        aria-label={dashboard.quickActions.heading}
      >
        {available.map((action) => {
          const Icon = action.icon;
          return (
            <Button
              key={action.path}
              variant="outline"
              size="sm"
              className="h-9 gap-2 px-3 py-2 text-sm"
              asChild
            >
              <Link href={action.path}>
                <Icon aria-hidden="true" className="size-4" />
                {action.label}
              </Link>
            </Button>
          );
        })}
      </div>
    </section>
  );
}
