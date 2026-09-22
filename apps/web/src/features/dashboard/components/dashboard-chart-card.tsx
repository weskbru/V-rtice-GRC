/**
 * PharosGRC — the shell the "Distribuições" charts render inside.
 *
 * Replaces `DashboardMetricCard`, which carried two responsibilities this
 * screen no longer has: a per-tile "Sem visibilidade" notice (the dashboard
 * now omits a capability the caller cannot see, rather than showing a zeroed
 * tile with a badge explaining the zero), and a KPI row shared with the
 * attention tiles (those are `DashboardStatCard` now, and they look nothing
 * like a chart card any more).
 *
 * Deliberately has no `link` slot of its own: both risk charts describe the
 * same register, and the row above already carries the way into it. A third
 * "Ver riscos" link on the same screen is noise, not navigation.
 *
 * ## Area tint via the icon chip
 *
 * Dashboard V2 Fase D: before this, "Distribuições" was the one section
 * still wearing the plain pre-V2 card, unconnected to either colour rule the
 * rest of the screen had by then established. `dashboard-icon-chip.tsx`'s
 * own header has the full reasoning for why the answer here is AREA (not
 * severity — a distribution has no single severity to report) applied
 * through the exact same restrained mechanism `DashboardModuleCard` already
 * uses `DashboardIconChip` at its default `variant="chip"` beside the
 * title. The chart's `<svg>`/`<table>` already carries meaningful colour
 * (risk level or status, reused unchanged from `chart-tokens.ts`), so a
 * second coloured strip at the bottom read as a leftover rule after the
 * chart grid. The icon chip is enough to identify the area while the card
 * ends cleanly with its ordinary border.
 *
 * ## The title is a real `<h3>`, not the shared `CardTitle` primitive
 *
 * `CardTitle` (`components/ui/card.tsx`) renders a `<div>`, not a heading —
 * true of every `Card` in the product, not something this fase introduced
 * (confirmed against the pre-Fase-A baseline: the call was identical). On
 * this screen specifically that left the three chart cards with NO heading
 * at all, while every `DashboardStatCard` and `DashboardModuleCard` beside
 * them has its own real `<h3>` — a reader navigating by heading list
 * reaches all fifteen other cards and skips these three (F-82,
 * `docs/deferred-findings.md`). Fixed LOCALLY, without touching the shared
 * primitive (which serves the rest of the product and was explicitly ruled
 * out as a place to change): this file renders a plain `<h3>` with
 * `CardTitle`'s own classes (`leading-none font-semibold`) instead of the
 * component, so the visual result is byte-identical and the semantics are
 * now correct.
 */

import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { DashboardIconChip } from './dashboard-icon-chip';

import type { DashboardTone } from './dashboard-icon-chip';
import type { LucideIcon } from 'lucide-react';

export interface DashboardChartCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  tone: DashboardTone;
  children: React.ReactNode;
  /** Grid placement only (e.g. `xl:col-span-2`) — never a styling escape hatch. */
  className?: string;
}

export function DashboardChartCard({
  title,
  description,
  icon,
  tone,
  children,
  className,
}: DashboardChartCardProps): React.JSX.Element {
  return (
    <Card className={cn('h-full gap-4 overflow-hidden py-4', className)}>
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <DashboardIconChip icon={icon} tone={tone} size="sm" />
          <h3 data-slot="card-title" className="text-base leading-none font-semibold">
            {title}
          </h3>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">{children}</CardContent>
    </Card>
  );
}
