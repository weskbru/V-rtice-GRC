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
