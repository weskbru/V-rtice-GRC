/**
 * PharosGRC — small icon+label caption naming an `IndicatorOverviewItem`'s
 * business domain (indicators-round, S1 ownership, coordinator PLAN.md §2).
 *
 * Every card on the redesigned `/indicators` screen shows this above its
 * own name, so a manager scanning eleven cards can tell "Riscos" from
 * "Achados" from the icon alone before reading a single word — the same
 * "identidade visual reconhecível" principle `navigation-registry.ts`'s own
 * icons already serve in the sidebar (CLAUDE.md §18.11). Icons mirror that
 * registry's own choices for the nine domains that have a sidebar entry
 * (`RISK`→`ShieldAlert`, `ACTION`→`ListChecks`, `PROBLEM`→`AlertTriangle`,
 * `INCIDENT`→`Siren`, `CONTROL`→`ShieldCheck`, `ASSET`→`Warehouse`,
 * `PROCESS`→`Workflow`, `COMPLIANCE`→`ScrollText`, `AUDIT`→`Gavel`) and the
 * existing per-metric-key catalog's own choice for `FINDING` (`Search`,
 * `features/indicators/metric-visuals.ts`'s `INDICATOR_METRIC_ICON`) — never
 * a fresh, uncoordinated icon set.
 */
import {
  AlertTriangle,
  Gavel,
  ListChecks,
  ScrollText,
  Search,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Warehouse,
  Workflow,
} from 'lucide-react';

import { indicators } from '@/lib/messages/indicators';
import { cn } from '@/lib/utils';

import type { IndicatorDomain } from '../indicator-overview-model';
import type { ComponentType, SVGProps } from 'react';

export const INDICATOR_DOMAIN_ICON: Readonly<
  Record<IndicatorDomain, ComponentType<SVGProps<SVGSVGElement>>>
> = {
  RISK: ShieldAlert,
  ACTION: ListChecks,
  PROBLEM: AlertTriangle,
  INCIDENT: Siren,
  CONTROL: ShieldCheck,
  ASSET: Warehouse,
  PROCESS: Workflow,
  COMPLIANCE: ScrollText,
  AUDIT: Gavel,
  FINDING: Search,
};

export interface IndicatorDomainCaptionProps {
  readonly domain: IndicatorDomain;
  readonly className?: string;
}

/** Icon + domain name, e.g. "🛡 Riscos" — always paired (never icon-only), so the domain is never conveyed by shape/color alone (CLAUDE.md §18.8). */
export function IndicatorDomainCaption({
  domain,
  className,
}: IndicatorDomainCaptionProps): React.JSX.Element {
  const Icon = INDICATOR_DOMAIN_ICON[domain];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground',
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      {indicators.overview.domainLabels[domain]}
    </span>
  );
}
