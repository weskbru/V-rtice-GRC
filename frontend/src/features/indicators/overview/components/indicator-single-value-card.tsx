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
  readonly reading: Extract<IndicatorReading, { kind: 'single' } | { kind: 'no-data' }>;
  readonly threshold?: IndicatorThreshold;
  readonly definitionDescription?: string;
  readonly recordsHref?: string;
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
