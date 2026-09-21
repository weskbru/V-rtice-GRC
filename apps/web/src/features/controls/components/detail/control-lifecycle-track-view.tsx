'use client';

/**
 * PharosGRC — control detail, the "Ciclo de vida" track's rendered view
 * (021-control-detail-experience, Fase B). Pure presentation over
 * `ControlLifecycleTrackModel` (`control-lifecycle-track.ts`) — no fetching,
 * no derivation of its own.
 *
 * Visual vocabulary reused from `ProblemLifecycleTrackView`/
 * `ActionLifecycleTrackView`, NOT their code (see `control-lifecycle-
 * track.ts`'s own header comment for why this stays a separate mechanism):
 * every node state carried by an ICON plus a TEXT word together, never
 * colour alone (CLAUDE.md §18.8).
 *
 * Below `sm` (640px) this renders a VERTICAL list instead of the `sm`+
 * horizontal one-column-per-node layout — the same defect Incident's/
 * Problem's/Action's own tracks paid for at 390px before being corrected.
 *
 * `RETIRED` is a terminal of the WHOLE trajectory, never of a node: this
 * payload does not record which of the three possible origins
 * (`DRAFT`/`ACTIVE`/`SUSPENDED`) a retirement came from, so it renders
 * centered below a full-width dashed divider, decoupled from every column,
 * with a short honest context line — never a connector implying a
 * provenance the payload does not have (mirrors `ActionLifecycleTrackView`'s
 * own `CancelledTerminal`).
 *
 * `max-w-xl mx-auto` on the `sm`+ layout: `Control`'s three-node main track,
 * like `Action`'s own three-node track, would otherwise spread across the
 * FULL card width — measured directly on `Action`'s own screen
 * (`action-lifecycle-track-view.tsx`'s own doc comment: ~360px between
 * nodes in a ~1072px-wide card with no aside). `Control`'s "Visão geral"
 * currently renders in the exact same no-aside width (Fase C has not added
 * an aside yet), so the same fix applies for the same reason: cap at
 * `max-w-xl` (36rem/576px, the same density Incident's/Problem's own four-
 * node tracks already read as, inside their narrower aside-bearing card),
 * centered. Below `xl`, or once Fase C's aside narrows the main column, the
 * cap is a no-op — `max-width` only ever shrinks, never stretches.
 */
import { ArrowRightCircle, Check, Circle, CircleDot } from 'lucide-react';

import { controls } from '@/lib/messages/controls';
import { cn } from '@/lib/utils';

import { controlStatusLabel } from '../../status';

import type {
  ControlLifecycleTrackModel,
  ControlLifecycleTrackNode,
} from './control-lifecycle-track';
import type { LucideIcon } from 'lucide-react';

const ICON_BY_STATE: Record<ControlLifecycleTrackNode['state'], LucideIcon> = {
  current: CircleDot,
  completed: Check,
  available: ArrowRightCircle,
  unavailable: Circle,
};

const DOT_TONE_BY_STATE: Record<ControlLifecycleTrackNode['state'], string> = {
  current: 'border-status-info-solid-bg bg-status-info-bg text-status-info-fg',
  completed: 'border-status-success-solid-bg bg-status-success-bg text-status-success-fg',
  available: 'border-border bg-background text-foreground',
  unavailable: 'border-border bg-muted text-muted-foreground',
};

/** One node's dot + status word + short state word, stacked (dot above text) — used by the horizontal (`sm`+) layout, one column per node. */
function TrackNodeColumn({ node }: { node: ControlLifecycleTrackNode }): React.JSX.Element {
  const Icon = ICON_BY_STATE[node.state];
  const label = controlStatusLabel(node.status);
  const stateLabel = controls.detail.lifecycleTrack.stateLabels[node.state];

  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-full border-2',
          DOT_TONE_BY_STATE[node.state],
        )}
      >
        <Icon aria-hidden="true" className="size-3.5" />
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

/** One node's dot + status word + short state word, side by side (dot left of text) — used by the vertical (below-`sm`) layout, one row per node. */
function TrackNodeRow({ node }: { node: ControlLifecycleTrackNode }): React.JSX.Element {
  const Icon = ICON_BY_STATE[node.state];
  const label = controlStatusLabel(node.status);
  const stateLabel = controls.detail.lifecycleTrack.stateLabels[node.state];

  return (
    <div className="relative z-10 flex items-center gap-3">
      <span
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-full border-2',
          DOT_TONE_BY_STATE[node.state],
        )}
      >
        <Icon aria-hidden="true" className="size-3.5" />
      </span>
      <div className="flex flex-col">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">{stateLabel}</span>
      </div>
    </div>
  );
}

/** `RETIRED`, when present — a terminal of the WHOLE trajectory, never of a specific node. See this file's own header comment. */
function RetiredTerminal({ node }: { node: ControlLifecycleTrackNode }): React.JSX.Element {
  return (
    <div
      aria-label={controls.detail.lifecycleTrack.retiredAriaLabel}
      className="mt-3 flex flex-col items-center gap-1 border-t border-dashed border-border pt-3"
    >
      <TrackNodeColumn node={node} />
      <p className="text-center text-[11px] text-muted-foreground">
        {controls.detail.lifecycleTrack.retiredContextLabel}
      </p>
    </div>
  );
}

export interface ControlLifecycleTrackViewProps {
  model: ControlLifecycleTrackModel;
}

export function ControlLifecycleTrackView({
  model,
}: ControlLifecycleTrackViewProps): React.JSX.Element {
  const columnCount = model.main.length;
  const gridTemplateColumns = `repeat(${columnCount}, minmax(0, 1fr))`;

  return (
    <div className="flex flex-col gap-1">
      {/* Below `sm` — vertical stack, each node's own connector segment
          running from the bottom of its dot to the top of the next, so
          alignment never depends on guessing a shared total height. */}
      <div className="sm:hidden">
        <ol aria-label={controls.detail.lifecycleTrack.mainAriaLabel} className="flex flex-col">
          {model.main.map((node, index) => (
            <li key={node.status} className="relative flex gap-3 pb-5 last:pb-0">
              {index < model.main.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="absolute top-7 bottom-0 left-3.5 w-0.5 bg-border"
                />
              ) : null}
              <TrackNodeRow node={node} />
            </li>
          ))}
        </ol>
        {model.retired ? <RetiredTerminal node={model.retired} /> : null}
      </div>

      {/* `sm` and wider — one column per node with a single continuous line through every centre. See this file's own header comment for `max-w-xl mx-auto`. */}
      <div className="hidden sm:block">
        <div className="relative mx-auto max-w-xl pt-3.5">
          <div
            aria-hidden="true"
            className="absolute top-3.5 h-0.5 bg-border"
            style={{
              left: `calc(100% / ${columnCount * 2})`,
              right: `calc(100% / ${columnCount * 2})`,
            }}
          />
          <ol
            aria-label={controls.detail.lifecycleTrack.mainAriaLabel}
            className="relative grid"
            style={{ gridTemplateColumns }}
          >
            {model.main.map((node) => (
              <li key={node.status} className="flex flex-col items-center px-1">
                <TrackNodeColumn node={node} />
              </li>
            ))}
          </ol>
          {model.retired ? <RetiredTerminal node={model.retired} /> : null}
        </div>
      </div>
    </div>
  );
}
