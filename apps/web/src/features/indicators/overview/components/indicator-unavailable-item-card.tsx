/**
 * PharosGRC — the shared "nothing to show" card for the redesigned
 * `/indicators` first screen (indicators-round, S1 ownership, coordinator
 * PLAN.md §2 step 6).
 *
 * Two distinct reasons, two distinct messages — never conflated, and never a
 * bare `0` for either (CLAUDE.md §18.11):
 *
 *   - `'no-permission'` — `GET /dashboard/summary` OMITTED this key entirely
 *     because the caller lacks the source domain's own read permission
 *     (`s1-backend-domain.md` Q15's own "different shape" finding — this
 *     screen renders the omission as an honest, compact card rather than
 *     pretending the key does not exist). Used in BOTH sections.
 *   - `'no-data'` — the key is READABLE but its `BY_BUCKET` source returned
 *     no `valueByBucket` at all. Kept distinct from `SINGLE_VALUE`'s own
 *     inline "Sem dados calculados" treatment (`IndicatorSingleValueCard`'s
 *     own header) because a `SINGLE_VALUE` no-data reading is common enough
 *     (`COMPLIANCE_PERCENTAGE` before any framework is published) to deserve
 *     prime placement inside its normal card, while a `BY_BUCKET` no-data
 *     reading is, per the backend investigation, not something the platform
 *     is expected to ever actually produce (every `BY_BUCKET` provider
 *     zero-fills, `s1-backend-domain.md` Q9) — this shared card is the
 *     defensive fallback for that theoretical case, never exercised by
 *     today's catalog in practice.
 *
 * `variant` only changes internal padding/min-height so a card sits
 * comfortably beside its section's own normal cards — never a second visual
 * language (CLAUDE.md §18.12).
 */
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
