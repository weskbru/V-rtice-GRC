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
