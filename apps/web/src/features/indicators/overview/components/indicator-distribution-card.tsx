/**
 * PharosGRC — one wide card for a `BY_BUCKET` indicator's distribution on
 * the redesigned `/indicators` first screen ("Composição por nível e
 * severidade" section, indicators-round, S1 ownership, coordinator
 * PLAN.md §2 step 4, refined twice per the coordinator's rendered reviews).
 *
 * Composes S2's `IndicatorDistributionBar` (the decorative, `aria-hidden`
 * proportional bar, `../indicator-distribution-bar.tsx`) with a real legend
 * list underneath — the bar alone is never the only carrier of the
 * distribution (CLAUDE.md §18.8): every one of the four buckets, including a
 * genuine `0`, gets its own `RiskLevelBadge` (hue + icon + text, never
 * colour alone, `packages/design-system/src/components/risk/
 * risk-level-badge.tsx`'s own doc comment) and its own number in the legend,
 * so the bar can be skipped entirely by a screen reader without losing any
 * information.
 *
 * ## Same grammar as `IndicatorSingleValueCard`, so the card always ends at
 * ## the legend
 *
 * The second review measured a real raggedness this card's OWN first
 * refinement introduced: "Ver registros" trailing at the bottom made
 * Problemas/Incidentes taller than Riscos/Achados (which have none), the
 * exact row-height inconsistency the single-value card's own header already
 * solved once by moving that link into the HEADER row. This card now uses
 * the identical structure: header (domain caption left, "Ver registros →"
 * right, present or absent, never adding a trailing row), name, the total AS
 * THE BIG NUMBER (left-aligned, small "Total" caption below it — the same
 * value-above-label convention `IndicatorSingleValueCard`'s own number and
 * `DashboardModuleCard` already use), the bar, then the legend — always the
 * LAST thing on the card, so every distribution card's own height is decided
 * by the same four elements, never by whether a link happens to exist.
 *
 * ## A bucket's count becomes a `Link` only when `bucket.href` is set
 *
 * S2's `buildReading` (`../indicator-overview-model.ts`) only ever populates
 * that field when the coordinator-approved navigation table has an EXACT,
 * permission-checked target for this bucket. A `0`-count bucket still gets
 * whatever `href` the model supplied — a filtered register legitimately
 * returning zero rows is not this card's decision to prevent.
 *
 * A linked number's REST-state cue is a subtle underline
 * (`decoration-border`, the same neutral token every hairline border in this
 * product already uses, never the link's own text colour repurposed as a
 * decoration source) that turns solid/full-strength (`decoration-current`)
 * on hover/focus — added deliberately WITHOUT touching `text-primary-on
 * -surface` itself (the second review's own instruction: the colour token is
 * correct and shared with every other link in the product; light theme's
 * dark-on-dark contrast between a linked and a plain number was too subtle
 * on its own, so the fix is an additional non-colour cue, not a new colour).
 *
 * The accessible name of a bucket link names the actual count, the domain's
 * own plural noun and the level — "213 incidentes de severidade Alta — ver
 * registros" — never the bare visible "213" a screen reader would otherwise
 * announce with no context of what it counts (see `card
 * .bucketLinkAccessibleLabelBySeverity`'s own message doc comment for why
 * `RISK_TOTAL_BY_LEVEL` uses the "nível" wording instead).
 */
import { RiskLevelBadge } from '@pharos/design-system/components';
import { ArrowRight } from 'lucide-react';

import { Link } from '@/components/navigation/link';
import { Card, CardContent } from '@/components/ui/card';
import { indicators } from '@/lib/messages/indicators';

import { toRiskLevel } from '../../metric-card-value';
import { IndicatorDistributionBar } from '../indicator-distribution-bar';

import { IndicatorDomainCaption } from './indicator-domain-caption';

import type { IndicatorBucket, IndicatorDomain } from '../indicator-overview-model';
import type { RiskLevel } from '@pharos/design-system/components';

export interface IndicatorDistributionCardProps {
  readonly domain: IndicatorDomain;
  readonly name: string;
  readonly detailHref: string;
  readonly total: number;
  /** Always the four `BUCKET_LEVEL_ORDER` levels, zero-filled — never a subset (S2's `buildReading` own guarantee). */
  readonly buckets: readonly IndicatorBucket[];
  readonly recordsHref?: string;
}

function bucketAccessibleLabel(domain: IndicatorDomain, level: RiskLevel, count: number): string {
  const card = indicators.overview.card;
  if (domain === 'RISK') {
    return card.bucketLinkAccessibleLabelByLevel(
      count,
      indicators.bucketBadgeLabels.levelName(level),
    );
  }
  // `domainLabels` is already the plural pt-BR noun ("Incidentes",
  // "Problemas", "Achados") — lowercased for a mid-sentence position.
  const domainNoun = indicators.overview.domainLabels[domain].toLowerCase();
  return card.bucketLinkAccessibleLabelBySeverity(
    count,
    domainNoun,
    indicators.severityLevelLabelsFeminine[level],
  );
}

export function IndicatorDistributionCard({
  domain,
  name,
  detailHref,
  total,
  buckets,
  recordsHref,
}: IndicatorDistributionCardProps): React.JSX.Element {
  const card = indicators.overview.card;
  const badgeLabels = indicators.bucketBadgeLabels;

  const segments = buckets.flatMap((bucket) => {
    const level = toRiskLevel(bucket.key);
    return level
      ? [{ key: bucket.key, count: bucket.count, label: badgeLabels.levelName(level), tone: level }]
      : [];
  });

  return (
    <Card className="gap-0 py-0">
      <CardContent className="flex flex-col gap-2 p-4 sm:p-5">
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

        <div className="flex flex-col">
          <span className="text-2xl leading-tight font-semibold tabular-nums text-foreground">
            {total.toLocaleString('pt-BR')}
          </span>
          <span className="text-xs text-muted-foreground">{card.totalCaption}</span>
        </div>

        <IndicatorDistributionBar segments={segments} />

        <ul
          aria-label={card.legendLabel(name)}
          className="flex flex-wrap items-center gap-x-4 gap-y-2"
        >
          {buckets.map((bucket) => {
            const level = toRiskLevel(bucket.key);
            if (!level) {
              return null;
            }
            return (
              <li key={bucket.key} className="flex items-center gap-1.5">
                <RiskLevelBadge level={level} labels={badgeLabels} />
                {bucket.href ? (
                  <Link
                    href={bucket.href}
                    aria-label={bucketAccessibleLabel(domain, level, bucket.count)}
                    className="text-sm font-medium text-primary-on-surface tabular-nums underline decoration-border underline-offset-4 hover:decoration-current focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {bucket.count.toLocaleString('pt-BR')}
                  </Link>
                ) : (
                  <span className="text-sm font-medium text-foreground tabular-nums">
                    {bucket.count.toLocaleString('pt-BR')}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
