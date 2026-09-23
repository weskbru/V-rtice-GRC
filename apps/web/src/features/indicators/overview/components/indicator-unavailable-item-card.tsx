import { CircleDashed, EyeOff } from 'lucide-react';

import { Link } from '@/components/navigation/link';
import { Card, CardContent } from '@/components/ui/card';
import { indicators } from '@/lib/messages/indicators';
import { cn } from '@/lib/utils';

import { IndicatorDomainCaption } from './indicator-domain-caption';

import type { IndicatorDomain } from '../indicator-overview-model';

export interface IndicatorUnavailableItemCardProps {
  readonly domain: IndicatorDomain;
  readonly name: string;
  readonly detailHref: string;
  readonly reason: 'no-permission' | 'no-data';
  readonly variant: 'compact' | 'wide';
}

export function IndicatorUnavailableItemCard({
  domain,
  name,
  detailHref,
  reason,
  variant,
}: IndicatorUnavailableItemCardProps): React.JSX.Element {
  const states = indicators.overview.states;
  const Icon = reason === 'no-permission' ? EyeOff : CircleDashed;
  const message =
    reason === 'no-permission'
      ? states.requiresPermission(indicators.overview.domainLabels[domain])
      : states.noData;

  return (
    <Card className="gap-0 border-dashed bg-muted/30 py-0">
      <CardContent className={cn('flex flex-col gap-2 p-4', variant === 'wide' && 'sm:p-5')}>
        <IndicatorDomainCaption domain={domain} />
        <Link
          href={detailHref}
          className="w-fit text-sm font-semibold text-foreground hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {name}
        </Link>
        <div className="flex items-start gap-2 text-muted-foreground">
          <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <div className="flex flex-col">
            <span className="text-sm font-medium">{message}</span>
            {reason === 'no-permission' ? (
              <span className="text-xs">{states.requiresPermissionHint}</span>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
