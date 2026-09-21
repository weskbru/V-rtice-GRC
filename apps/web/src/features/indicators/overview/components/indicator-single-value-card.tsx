/**
 * PharosGRC — one compact card for a `SINGLE_VALUE` indicator on the
 * redesigned `/indicators` first screen (indicators-round, S1 ownership,
 * coordinator PLAN.md §2 step 5).
 *
 * Purpose-built, not an extension of `@pharos/design-system`'s `MetricCard`
 * — the same reasoning `MetricCard`'s own doc comment gives for not
 * extending `SummaryStatCard`: this card adds a domain caption, an optional
 * threshold line with its definition's description, and an optional
 * "Ver registros" link that `MetricCard` has no slot for, and none of
 * `MetricCard`'s per-card scope/timestamp footer (the context band states
 * that once for the whole screen — `indicator-overview-context-band.tsx`'s
 * own header).
 *
 * `reading.kind === 'no-data'` renders `overview.states.noData` in place of
 * the number — never a bare `0` (CLAUDE.md §18.11) and never the same
 * dashed "unavailable" treatment `IndicatorUnavailableItemCard` uses for a
 * missing PERMISSION, which is a different fact (the value is computable but
 * currently empty at the source, vs. the caller cannot read the source at
 * all).
 *
 * Height is intentionally NOT `h-full`: the parent grid
 * (`IndicatorOverviewSection`) uses `items-start`, so a card with no
 * threshold/description/records-link stays its own natural height instead of
 * stretching to match a taller sibling (the row-stretch defect
 * `s3-baseline.md` §4 measured).
 *
 * `scopeNote` is the one per-card scope exception the redesign keeps
 * (coordinator PLAN.md §2 step 2/step 5): the context band states the
 * CALLER's own scope once for the whole screen, but `COMPLIANCE_PERCENTAGE`
 * is the one key that is ALWAYS organization-wide regardless of who asks
 * (`scopeApplicability: 'ORGANIZATION_WIDE'`, `s1-backend-domain.md` Q15) —
 * a unit-scoped caller would otherwise read the band's "Sua unidade
 * organizacional" and reasonably assume every number on the page is scoped
 * to their unit, which is false for this one card. The composition passes
 * this only when `item.scopeApplicability === 'ORGANIZATION_WIDE'` AND the
 * caller's own scope is NOT global — never for the nine
 * `ORGANIZATIONAL_UNIT` keys, and never repeated when the caller's scope
 * already IS global (the band's own statement already covers that case).
 *
 * ## "Ver registros" lives in the header row, not trailing the card
 *
 * The first pass appended it as the LAST element — since only 4 of the 7
 * `SINGLE_VALUE` keys have a navigation-table entry, that made some cards
 * (Compliance, Auditoria) visibly shorter than others for a reason that had
 * nothing to do with their own content (threshold/description), a ragged
 * grid the rendered review measured directly. It is now right-aligned
 * opposite the domain caption, in the header row every card already has —
 * present or absent, it never changes which OTHER rows a card has below it.
 */
import { ArrowRight } from 'lucide-react';

import { Link } from '@/components/navigation/link';
import { Card, CardContent } from '@/components/ui/card';
import { indicators } from '@/lib/messages/indicators';

import { IndicatorDomainCaption } from './indicator-domain-caption';

import type {
  IndicatorDomain,
  IndicatorReading,
  IndicatorThreshold,
} from '../indicator-overview-model';

const COMPARATOR_SYMBOL: Readonly<Record<IndicatorThreshold['comparator'], string>> = {
  GTE: '≥',
  GT: '>',
  LTE: '≤',
  LT: '<',
};

function formatValue(reading: Extract<IndicatorReading, { kind: 'single' }>): string {
  return reading.unit === 'percent'
    ? `${reading.value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
    : reading.value.toLocaleString('pt-BR');
}

export interface IndicatorSingleValueCardProps {
  readonly domain: IndicatorDomain;
  readonly name: string;
  readonly detailHref: string;
  /** Never `'buckets'`/`'no-permission'` here — the composition routes those readings to `IndicatorDistributionCard`/`IndicatorUnavailableItemCard` instead. */
  readonly reading: Extract<IndicatorReading, { kind: 'single' } | { kind: 'no-data' }>;
  readonly threshold?: IndicatorThreshold;
  readonly definitionDescription?: string;
  readonly recordsHref?: string;
  /** See this file's own header — set ONLY for an `ORGANIZATION_WIDE` key under a non-global caller scope. */
  readonly scopeNote?: string;
}

export function IndicatorSingleValueCard({
  domain,
  name,
  detailHref,
  reading,
  threshold,
  definitionDescription,
  recordsHref,
  scopeNote,
}: IndicatorSingleValueCardProps): React.JSX.Element {
  const card = indicators.overview.card;

  return (
    <Card className="gap-0 py-0">
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <IndicatorDomainCaption domain={domain} />
          {recordsHref ? (
            <Link
              href={recordsHref}
              aria-label={card.viewRecordsAccessibleLabel(name)}
              className="group inline-flex shrink-0 items-center gap-1 rounded-sm text-xs font-medium text-primary-on-surface hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {card.viewRecordsAction}
              <ArrowRight
                aria-hidden="true"
                className="size-3 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
              />
            </Link>
          ) : null}
        </div>

        <Link
          href={detailHref}
          className="w-fit text-sm font-semibold text-foreground hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {name}
        </Link>

        {reading.kind === 'no-data' ? (
          <p className="text-sm text-muted-foreground">{indicators.overview.states.noData}</p>
        ) : (
          <p className="text-2xl leading-tight font-semibold tabular-nums text-foreground">
            {formatValue(reading)}
          </p>
        )}

        {threshold ? (
          <p className="text-xs text-muted-foreground">
            {card.thresholdLabel(COMPARATOR_SYMBOL[threshold.comparator], threshold.value)}
          </p>
        ) : null}

        {definitionDescription ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">{definitionDescription}</p>
        ) : null}

        {scopeNote ? <p className="text-xs text-muted-foreground">{scopeNote}</p> : null}
      </CardContent>
    </Card>
  );
}
