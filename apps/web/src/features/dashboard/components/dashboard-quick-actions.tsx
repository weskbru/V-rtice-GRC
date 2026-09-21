/**
 * PharosGRC — the dashboard's quick actions.
 *
 * A short row of the few things a user genuinely starts from the landing
 * screen — registering something that just happened, or opening their own
 * work — each with the same icon its area carries in the sidebar, so the
 * shortcut and the destination are recognisably the same thing.
 *
 * Only the shortcuts the caller's permissions allow, and nothing at all when
 * none is available (not an empty toolbar). The permission check is advisory
 * display logic (FR-042): the server enforces each destination on its own.
 *
 * There is deliberately no "criar ação" here. An action is created in the
 * context it arises from — a risk's treatment, an incident, a problem, a
 * finding (R-009) — because it cannot exist without that origin; a central
 * create button would have to invent a picker for all five.
 *
 * ## Not in the reference mockup, kept, integrated rather than promoted
 *
 * Dashboard V2's reference has no quick-actions row, but this is real
 * product functionality with no other home, so it stays (coordinator's
 * explicit instruction, Fase C). What changed is presentation, never
 * gating: this component's own visibility still depends on nothing but
 * `hasPermission()` above — `DashboardPage` renders it unconditionally,
 * independent of whether "Visão dos módulos" itself has anything to show,
 * so a caller who can only CREATE (e.g. front-line intake permissions
 * with no read access feeding the module cards) still sees their
 * shortcuts.
 *
 * ## Heading LEVEL stays `<h2>` — a first attempt at "quieter" got this wrong
 *
 * An earlier version of this integration dropped the heading to `<h3>`,
 * reasoning that it would read as a subsection of "Visão dos módulos"
 * (which it sits directly beneath in `page.tsx`). Rendered, the outline
 * a screen-reader heading list actually produces does not follow visual
 * proximity — it follows DOM nesting, and this `<section>` is a SIBLING
 * of the modules section, not a descendant of it. The `<h3>` therefore
 * announced this shortcut bar as the modules section's ninth entry,
 * alongside "Riscos" through "Indicadores", which it is not — it is a
 * global action bar, unrelated to any one module.
 *
 * CLAUDE.md §18.8's own principle applies directly: heading LEVEL
 * communicates document structure; visual weight communicates emphasis;
 * the two are independent and must not be conflated. This section is
 * genuinely a peer of "O que requer atenção agora", "Visão dos módulos"
 * and "Distribuições" — same nesting depth, same `<h2>` — so the coda
 * *feel* comes entirely from `page.tsx`'s tighter `gap-3` grouping and
 * from this heading's own quiet typography (`text-sm
 * text-muted-foreground`, not `SECTION_HEADING`), never from pretending
 * it is nested one level deeper than it actually is. **F3 did not touch
 * this decision** — the `<h2>` and its reasoning stand exactly as written.
 *
 * ## Compact action controls
 * Buttons use a local 36px height with 16px icons and 14px labels.
 * Wrapping, actions, destinations and permission gates are unchanged.
 */
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
