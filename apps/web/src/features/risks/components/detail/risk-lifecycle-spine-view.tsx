/**
 * PharosGRC — risk detail, the lifecycle spine's rendered view
 * (016-risk-detail-experience §4.6, redesigned per P2 2026-09-15). Pure
 * presentation over `RiskLifecycleSpineModel` (`risk-lifecycle-spine.ts`) —
 * no fetching, no derivation of its own.
 *
 * ## A real trajectory, not a wrapping row of pills
 *
 * The first cut rendered variable-width pills that wrapped across three
 * lines at ordinary widths, with the blocked transition's FULL precondition
 * sentence stuffed inside the "Identificado" pill — stretching it to the
 * full row width and duplicating text `RiskLifecycleActions` already shows
 * under its own disabled button (P1). Neither survives here:
 *
 *   - Precondition TEXT is gone from this component entirely. A node only
 *     ever shows its status name and a short state word — never a
 *     sentence. `RiskLifecycleActions` (via its `trajectory` slot, see
 *     `risk-lifecycle-section.tsx`) is the ONE place the full sentence
 *     renders, directly under the transition it blocks.
 *   - Nodes sit in a fixed-column CSS grid (one column per main-spine
 *     position) with a single continuous connecting line drawn through
 *     every node's centre — a real stepper, not pills that reflow.
 *   - The two branches hang directly under the `UNDER_TREATMENT` column via
 *     a dashed connector, instead of a separately-labelled "RAMOS" list
 *     disconnected from the node they leave.
 *
 * Every state is still carried by an ICON and a TEXT word together, never
 * colour alone (CLAUDE.md §18.8, mirroring `RiskLevelBadge`) — only the
 * layout changed, not that guarantee.
 */
import { AlertTriangle, ArrowRightCircle, Check, Circle, CircleDot } from 'lucide-react';

import { riskStatusLabel } from '../../status';

import type { RiskLifecycleSpineModel, RiskLifecycleSpineNode } from './risk-lifecycle-spine';
import type { LucideIcon } from 'lucide-react';

import { risks } from '@/lib/messages/risks';
import { cn } from '@/lib/utils';

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

/** One node's dot + short label + short state word — the ONLY three things a node ever shows (no precondition text, see this file's own header comment). */
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
      {/* `overflow-x-auto` mirrors `EntityTabs`'s own established pattern for
          a strip that can genuinely outgrow a narrow viewport — this widget
          scrolls on its own rather than the page ever scrolling sideways
          (CLAUDE.md §18.11). `min-w-[28rem]` keeps six short pt-BR labels
          from being crushed into unreadable wrapping before that kicks in. */}
      <div
        role="region"
        aria-label={risks.detail.lifecycleSpine.title}
        tabIndex={0}
        className="overflow-x-auto rounded-sm pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="relative min-w-[28rem] pt-3.5">
          {/* The single continuous line, drawn from the centre of the first
              column to the centre of the last — correct for ANY column
              count because CSS Grid columns are equal width, so a straight
              line between the two outer centres passes through every
              column's centre in between. */}
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
