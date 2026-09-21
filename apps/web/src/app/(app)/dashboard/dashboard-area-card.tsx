import { Construction } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { dashboard } from '@/lib/messages/dashboard';

export interface DashboardAreaCardProps {
  /** Already resolved to pt-BR by the backend (`USER_MESSAGES.dashboard.plannedAreaLabels`) — rendered verbatim. */
  label: string;
}

/**
 * A planned-module card — one entry of `plannedAreas` from `GET /dashboard`.
 * The registry behind it has been empty since Incidents and Problems
 * shipped, and the dashboard renders its section only when an entry exists;
 * this card is the extension point's renderer, kept for the next domain that
 * registers one.
 *
 * Deliberately unmistakable at a glance, not just badge text: a dashed
 * border, a muted surface, a construction icon and no number anywhere on the
 * card — colour alone never carries "this is not real data" (FR-091), and
 * there is nothing here that could be misread as a zero (FR-050, SC-013). A
 * genuine zero always renders as the plain digit `0` on a solid
 * `DashboardStatCard`/`DashboardModuleCard`, so the two states cannot look
 * alike even to a user skimming quickly.
 */
export function DashboardAreaCard({ label }: DashboardAreaCardProps): React.JSX.Element {
  return (
    <Card className="border-dashed bg-muted/40 shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-muted-foreground">
          <Construction aria-hidden="true" className="size-4 shrink-0" />
          {label}
        </CardTitle>
        <CardDescription>{dashboard.plannedArea.message}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm font-medium text-muted-foreground">{dashboard.plannedArea.badge}</p>
      </CardContent>
    </Card>
  );
}
