/**
 * PharosGRC — incident detail, the "Ciclo de vida" track's rendered view
 * (018-incident-detail-experience, Fase 2+3, corrected in the Fase 4
 * review round — C1/C2/C3 below). Pure presentation over
 * `IncidentLifecycleTrackModel` (`incident-lifecycle-track.ts`) — no
 * fetching, no derivation of its own.
 *
 * Visual vocabulary reused from `RiskLifecycleSpineView`, NOT its code (see
 * `incident-lifecycle-track.ts`'s own header comment for why the two stay
 * separate mechanisms): every node state carried by an ICON plus a TEXT
 * word together, never colour alone (CLAUDE.md §18.8).
 *
 * ## C1 — stacks vertically below `sm` (640px)
 *
 * The horizontal, four-column layout measured `clientWidth: 244` against
 * `scrollWidth: 352` at 390px — the fourth node ("Fechado") sat past the
 * visible edge with `overflow-x-auto` and NO chevron, NO fade, nothing
 * telling the reader more existed to scroll to. That silently drops one of
 * the four lifecycle states on a phone. Below `sm` this component renders a
 * VERTICAL list instead — nodes stacked top to bottom, each one's own
 * connector segment running from the bottom of its dot to the top of the
 * next — never a second, competing scroll affordance next to `EntityTabs`'s
 * own (the coordinator's explicit instruction: one scrolling language per
 * screen). At `sm` and wider, every node already fit with `scrollWidth ==
 * clientWidth`, so the horizontal layout is unchanged there.
 *
 * ## C2 — `CANCELLED` is a terminal of the WHOLE trajectory, never of a node
 *
 * The previous cut hung the `CANCELLED` node off the LEFT edge of the row
 * via a dashed left border — which, measured, sat directly under "Aberto"'s
 * own column, visually asserting "cancelled FROM Aberto". `IncidentDetail`
 * does not record which of the two possible origins (`OPEN`/`IN_PROGRESS`)
 * a cancellation came from (`incident-lifecycle-track.ts`'s own header
 * comment already says so) — so the UI must not assert one. `CANCELLED`,
 * when present, now renders centered BELOW a full-width dashed top divider,
 * decoupled from every column, with a short honest context line
 * (`lifecycleTrack.cancelledContextLabel`, "Encerrado por cancelamento")
 * instead of a connector implying provenance the payload does not have.
 *
 * ## C3 — a continuous line, and room to breathe before the button row
 *
 * The connecting line through every main-track node's centre is
 * unchanged in mechanism (a single absolutely-positioned bar spanning
 * column-1's centre to column-N's centre — the same technique
 * `RiskLifecycleSpineView` already proved), but is now paired with the
 * vertical layout's own per-node connector for narrow viewports, so a
 * continuous path exists at every supported width, not just `sm`+. The
 * caller (`incident-lifecycle-section.tsx`) adds the spacing below the
 * track — see that file's own header comment.
 */
import { ArrowRightCircle, Check, Circle, CircleDot } from 'lucide-react';

import { incidents } from '@/lib/messages/incidents';
import { cn } from '@/lib/utils';

import { incidentStatusLabel } from '../../status';

import type {
  IncidentLifecycleTrackModel,
  IncidentLifecycleTrackNode,
} from './incident-lifecycle-track';
import type { LucideIcon } from 'lucide-react';

const ICON_BY_STATE: Record<IncidentLifecycleTrackNode['state'], LucideIcon> = {
  current: CircleDot,
  completed: Check,
  available: ArrowRightCircle,
  unavailable: Circle,
};

const DOT_TONE_BY_STATE: Record<IncidentLifecycleTrackNode['state'], string> = {
  current: 'border-status-info-solid-bg bg-status-info-bg text-status-info-fg',
  completed: 'border-status-success-solid-bg bg-status-success-bg text-status-success-fg',
  available: 'border-border bg-background text-foreground',
  unavailable: 'border-border bg-muted text-muted-foreground',
};

/** One node's dot + status word + short state word, stacked (dot above text) — used by the horizontal (`sm`+) layout, one column per node. */
function TrackNodeColumn({ node }: { node: IncidentLifecycleTrackNode }): React.JSX.Element {
  const Icon = ICON_BY_STATE[node.state];
  const label = incidentStatusLabel(node.status);
  const stateLabel = incidents.detail.lifecycleTrack.stateLabels[node.state];

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
function TrackNodeRow({ node }: { node: IncidentLifecycleTrackNode }): React.JSX.Element {
  const Icon = ICON_BY_STATE[node.state];
  const label = incidentStatusLabel(node.status);
  const stateLabel = incidents.detail.lifecycleTrack.stateLabels[node.state];

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

/** `CANCELLED`, when present — a terminal of the WHOLE trajectory, never of a specific node. See this file's own header comment, C2. */
function CancelledTerminal({ node }: { node: IncidentLifecycleTrackNode }): React.JSX.Element {
  return (
    <div
      aria-label={incidents.detail.lifecycleTrack.cancelledAriaLabel}
      className="mt-3 flex flex-col items-center gap-1 border-t border-dashed border-border pt-3"
    >
      <TrackNodeColumn node={node} />
      <p className="text-center text-[11px] text-muted-foreground">
        {incidents.detail.lifecycleTrack.cancelledContextLabel}
      </p>
    </div>
  );
}

export interface IncidentLifecycleTrackViewProps {
  model: IncidentLifecycleTrackModel;
}

export function IncidentLifecycleTrackView({
  model,
}: IncidentLifecycleTrackViewProps): React.JSX.Element {
  const columnCount = model.main.length;
  const gridTemplateColumns = `repeat(${columnCount}, minmax(0, 1fr))`;

  return (
    <div className="flex flex-col gap-1">
      {/* Below `sm` (C1) — vertical stack, each node's own connector segment
          running from the bottom of its dot to the top of the next, so
          alignment never depends on guessing a shared total height. */}
      <div className="sm:hidden">
        <ol aria-label={incidents.detail.lifecycleTrack.mainAriaLabel} className="flex flex-col">
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
        {model.cancelled ? <CancelledTerminal node={model.cancelled} /> : null}
      </div>

      {/* `sm` and wider (unchanged mechanism) — one column per node with a
          single continuous line through every centre. */}
      <div className="hidden sm:block">
        <div className="relative pt-3.5">
          <div
            aria-hidden="true"
            className="absolute top-3.5 h-0.5 bg-border"
            style={{
              left: `calc(100% / ${columnCount * 2})`,
              right: `calc(100% / ${columnCount * 2})`,
            }}
          />
          <ol
            aria-label={incidents.detail.lifecycleTrack.mainAriaLabel}
            className="relative grid"
            style={{ gridTemplateColumns }}
          >
            {model.main.map((node) => (
              <li key={node.status} className="flex flex-col items-center px-1">
                <TrackNodeColumn node={node} />
              </li>
            ))}
          </ol>
          {model.cancelled ? <CancelledTerminal node={model.cancelled} /> : null}
        </div>
      </div>
    </div>
  );
}
