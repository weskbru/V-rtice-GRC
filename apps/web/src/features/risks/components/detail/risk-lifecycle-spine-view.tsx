import { AlertTriangle, ArrowRightCircle, Check, Circle, CircleDot } from 'lucide-react';

import { risks } from '@/lib/messages/risks';
import { cn } from '@/lib/utils';

import { riskStatusLabel } from '../../status';

import type { RiskLifecycleSpineModel, RiskLifecycleSpineNode } from './risk-lifecycle-spine';
import type { LucideIcon } from 'lucide-react';

const ICON_BY_STATE: Record<RiskLifecycleSpineNode['state'], LucideIcon> = {
  current: CircleDot,
  traversed: Check,
  available: ArrowRightCircle,
  blocked: AlertTriangle,
  unavailable: Circle,
};

const DOT_TONE_BY_STATE: Record<RiskLifecycleSpineNode['state'], string> = {
  current: 'border-status-info-solid-bg bg-status-info-bg text-status-info-fg',
  traversed: 'border-status-success-solid-bg bg-status-success-bg text-status-success-fg',
  available: 'border-border bg-background text-foreground',
  blocked: 'border-status-warning-solid-bg bg-status-warning-bg text-status-warning-fg',
  unavailable: 'border-border bg-muted text-muted-foreground',
};

function SpineNodeView({
  node,
  dotSize = 'size-7',
  iconSize = 'size-3.5',
}: {
  node: RiskLifecycleSpineNode;
  dotSize?: string;
  iconSize?: string;
}): React.JSX.Element {
  const Icon = ICON_BY_STATE[node.state];
  const label = riskStatusLabel(node.status);
  const stateLabel = risks.detail.lifecycleSpine.stateLabels[node.state];

  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full border-2',
          dotSize,
          DOT_TONE_BY_STATE[node.state],
        )}
      >
        <Icon aria-hidden="true" className={iconSize} />
      </span>
      <span className="text-center text-[11px] leading-tight font-medium text-foreground">
        {label}
      </span>
      <span className="text-center text-[10px] leading-tight text-muted-foreground">
        {stateLabel}
      </span>
    </div>
  );
}

export interface RiskLifecycleSpineViewProps {
  model: RiskLifecycleSpineModel;
}

export function RiskLifecycleSpineView({ model }: RiskLifecycleSpineViewProps): React.JSX.Element {
  const columnCount = model.main.length;
  const gridTemplateColumns = `repeat(${columnCount}, minmax(0, 1fr))`;
  const branchOriginIndex = model.main.findIndex((node) => node.status === 'UNDER_TREATMENT');

  return (
    <div className="flex flex-col gap-1">
      <div
        role="region"
        aria-label={risks.detail.lifecycleSpine.title}
        tabIndex={0}
        className="overflow-x-auto rounded-sm pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="relative min-w-[28rem] pt-3.5">
          <div
            aria-hidden="true"
            className="absolute top-3.5 h-0.5 bg-border"
            style={{
              left: `calc(100% / ${columnCount * 2})`,
              right: `calc(100% / ${columnCount * 2})`,
            }}
          />
          <ol
            aria-label={risks.detail.lifecycleSpine.mainAriaLabel}
            className="relative grid"
            style={{ gridTemplateColumns }}
          >
            {model.main.map((node) => (
              <li key={node.status} className="flex flex-col items-center px-1">
                <SpineNodeView node={node} />
              </li>
            ))}
          </ol>

          {model.branches.length > 0 && branchOriginIndex !== -1 ? (
            <div className="relative mt-2 grid" style={{ gridTemplateColumns }}>
              <ul
                aria-label={risks.detail.lifecycleSpine.branchesAriaLabel}
                className="col-span-2 flex flex-row gap-4 border-l-2 border-dashed border-border py-1 pl-3"
                style={{ gridColumnStart: branchOriginIndex + 1 }}
              >
                {model.branches.map((node) => (
                  <li key={node.status}>
                    <SpineNodeView node={node} dotSize="size-6" iconSize="size-3" />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
