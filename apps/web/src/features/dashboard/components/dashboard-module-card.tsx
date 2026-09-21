/**
 * PharosGRC — one module summary on the dashboard's "Visão dos módulos" row.
 *
 * An icon, the area's name, two to four real figures laid out side by side,
 * and a way in. Orientation, not a register: "where does this area stand".
 *
 * ## Every figure already exists
 *
 * Nothing on this card is computed in the browser or invented to fill a slot.
 * Each value comes from the platform's own aggregations — the indicator
 * catalogue's single calculator or a scoped count the owning module exposes —
 * permission-checked on the server. A metric the platform does not publish is
 * simply not a column here.
 *
 * ## Value tone
 *
 * A metric may declare what its number MEANS when it is above zero —
 * `danger` for critical/overdue, `warning` for ineffective or pending,
 * `success` for a share achieved. The status foreground tokens used for that
 * are the reserved meaning colours, and they apply only above zero ("0
 * críticos" is not a danger). The label under every number is always there,
 * so the tone is emphasis, never the sole carrier of meaning.
 *
 * ## Markup
 *
 * A description list, one `<dt>`/`<dd>` pair per metric, with the value shown
 * ABOVE its label via `flex-col-reverse` — reading order for assistive
 * technology stays "Críticos: 44" while the eye sees the number first.
 *
 * ## The base bar is an ACCENT, not a measurement
 *
 * A thin strip of the card's own area tint runs along the card's bottom
 * edge (Dashboard V2 Fase C). It is a fixed-width identity mark, the same
 * area colour the icon already carries, reinforcing "this is Riscos"
 * the way a spine label does on a binder — never a progress or
 * completion indicator, because no such percentage exists anywhere in
 * this card's data (`DashboardModuleMetric` has no notion of a
 * denominator to be a fraction of). `aria-hidden`: it carries no
 * information a screen reader needs that the card's own title and
 * figures do not already state.
 *
 * ## Volume, corrected once already
 *
 * The first render used the tone's full-strength ink (`bg-tint-*-fg`) at
 * `h-1` (4px), full opacity — and the coordinator measured it as the
 * single most saturated element anywhere on the page: MORE saturated
 * than "O que requer atenção agora"'s own tiles, which use a washed
 * `-bg` surface with a `-fg` BORDER, never a solid `-fg` fill. A 269px
 * solid strip of the strongest ink on the screen made module-card AREA
 * identity outshout attention SEVERITY — backwards from the reading
 * order this dashboard needs, and the opposite of the brief's own
 * instruction (more chromatic AREA, never more saturation).
 *
 * This version keeps the same ink (still the area's own ONE colour — the
 * fix is volume, not vocabulary; `DashboardIconChip`'s tones are
 * untouched) at roughly a quarter of the original visual weight: half
 * the height (`h-0.5`, 2px) and the fill itself at reduced opacity
 * (`/45`) rather than solid. Compared side by side against the attention
 * tiles in the same capture (never in isolation — the two only compete
 * for the eye when seen together), the tiles now read unmistakably
 * stronger.
 *
 * `TONE_ACCENT_CLASSES` is exported from `dashboard-icon-chip.tsx`, not
 * declared here — `DashboardChartCard` (Fase D) uses the identical
 * calibrated value for its own base accent, and a second copy of the
 * `/45` figure is exactly how a future recalibration misses one of the
 * two.
 *
 * ## The way in is a corner arrow, not a text row (`025-dashboard-composition` F3)
 *
 * The reference composition cuts the card's height by dropping the
 * "Acessar X →" text line and putting an icon-only affordance in the
 * card's bottom-right corner instead — this IS the height cut (padding and
 * gap trims alone could not reach the ≤120px target with eight cards in
 * two rows of four). Three things this could NOT cost, all verified by
 * measurement, not assumed:
 *
 * 1. **Accessible name** — the anchor carries `aria-label={link.label}`,
 *    the exact same string ("Acessar riscos", "Acessar incidentes", …)
 *    that used to be its visible text. `getByRole('link', { name: … })`
 *    resolves identically; nothing here is glyph-only for assistive tech.
 * 2. **Touch target** — `size-6` (24px), the same floor this fase already
 *    established for the attention tiles' own links, not a new number.
 * 3. **Focus visibility** — the same `focus-visible:ring-2
 *    focus-visible:ring-ring` every other interactive element in this file
 *    uses, unchanged.
 *
 * `Card` gained `relative` so the arrow can anchor to the card's own box
 * rather than the page; it sits at `right-2 bottom-2`, clear of the base
 * accent strip (which is *outside* `CardContent`, 2px, and the arrow's
 * offset leaves a visible gap above it).
 */
import { ArrowRight } from 'lucide-react';

import { Link } from '@/components/navigation/link';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { DashboardIconChip, TONE_ACCENT_CLASSES } from './dashboard-icon-chip';

import type { DashboardTone } from './dashboard-icon-chip';
import type { LucideIcon } from 'lucide-react';

export type DashboardMetricTone = 'danger' | 'warning' | 'success' | 'info';

export interface DashboardModuleMetric {
  label: string;
  value: number | undefined;
  tone?: DashboardMetricTone;
  unit?: 'count' | 'percent';
}

export interface DashboardModuleCardProps {
  title: string;
  icon: LucideIcon;
  tone: DashboardTone;
  metrics: readonly DashboardModuleMetric[];
  link: { path: string; label: string };
}

const METRIC_TONE_CLASS: Readonly<Record<DashboardMetricTone, string>> = {
  danger: 'text-status-danger-fg',
  warning: 'text-status-warning-fg',
  success: 'text-status-success-fg',
  info: 'text-status-info-fg',
};

function formatMetric(metric: DashboardModuleMetric): string {
  if (metric.value === undefined) {
    return '—';
  }
  return metric.unit === 'percent'
    ? `${metric.value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
    : metric.value.toLocaleString('pt-BR');
}

export function DashboardModuleCard({
  title,
  icon,
  tone,
  metrics,
  link,
}: DashboardModuleCardProps): React.JSX.Element {
  return (
    <Card className="relative h-full gap-0 overflow-hidden py-0">
      <CardContent className="flex h-full flex-col gap-1.5 p-2">
        <div className="flex items-center gap-2.5">
          <DashboardIconChip icon={icon} tone={tone} size="sm" />
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>

        {/* Flex, not a fixed-minimum grid: each figure grows equally but never
            narrower than its longest word. The grid's 3.5rem floor fit three
            figures in a quarter-width card, but at 1280px it broke
            "Em andamento" mid-word into "andament/o"; a floor of min-content
            wraps only between words, and a fourth figure moves to a new row
            only when the words genuinely do not fit. */}
        <dl className="flex flex-wrap items-start gap-x-4 gap-y-1.5 pr-6">
          {metrics.map((metric) => {
            const toned =
              metric.tone !== undefined && metric.value !== undefined && metric.value > 0;
            return (
              <div key={metric.label} className="flex min-w-min flex-1 flex-col-reverse gap-0.5">
                {/* Wraps between words instead of truncating: an ellipsis turned
                    "Achados críticos" into "Achados crí…" in the first capture —
                    a label cut short hides exactly the meaning the number
                    depends on. */}
                <dt className="text-xs leading-tight text-muted-foreground">{metric.label}</dt>
                <dd
                  className={cn(
                    'text-xl font-semibold',
                    toned && metric.tone ? METRIC_TONE_CLASS[metric.tone] : 'text-foreground',
                  )}
                >
                  {formatMetric(metric)}
                </dd>
              </div>
            );
          })}
        </dl>
      </CardContent>

      {/* Icon-only way in — see the header comment for why this replaced the
          "Acessar X →" text row, and what the three things it could not
          cost (accessible name, touch target, focus visibility) are. */}
      <Link
        href={link.path}
        aria-label={link.label}
        className="group absolute right-2 bottom-2 inline-flex size-6 items-center justify-center rounded-sm text-primary-on-surface hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <ArrowRight
          aria-hidden="true"
          className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
        />
      </Link>

      <div aria-hidden="true" className={cn('h-0.5 w-full shrink-0', TONE_ACCENT_CLASSES[tone])} />
    </Card>
  );
}
