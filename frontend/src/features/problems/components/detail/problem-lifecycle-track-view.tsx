import { ArrowRightCircle, Check, Circle, CircleDot } from 'lucide-react';

import { problems } from '@/lib/messages/problems';
import { cn } from '@/lib/utils';

import { problemStatusLabel } from '../../status';

import type {
  ProblemLifecycleTrackModel,
  ProblemLifecycleTrackNode,
} from './problem-lifecycle-track';
import type { LucideIcon } from 'lucide-react';

const ICON_BY_STATE: Record<ProblemLifecycleTrackNode['state'], LucideIcon> = {
  current: CircleDot,
  completed: Check,
  available: ArrowRightCircle,
  unavailable: Circle,
};

const DOT_TONE_BY_STATE: Record<ProblemLifecycleTrackNode['state'], string> = {
  current: 'border-status-info-solid-bg bg-status-info-bg text-status-info-fg',
  completed: 'border-status-success-solid-bg bg-status-success-bg text-status-success-fg',
  available: 'border-border bg-background text-foreground',
  unavailable: 'border-border bg-muted text-muted-foreground',
};

function TrackNodeColumn({ node }: { node: ProblemLifecycleTrackNode }): React.JSX.Element {
  const Icon = ICON_BY_STATE[node.state];
  const label = problemStatusLabel(node.status);
  const stateLabel = problems.detail.lifecycleTrack.stateLabels[node.state];

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

function TrackNodeRow({ node }: { node: ProblemLifecycleTrackNode }): React.JSX.Element {
  const Icon = ICON_BY_STATE[node.state];
  const label = problemStatusLabel(node.status);
  const stateLabel = problems.detail.lifecycleTrack.stateLabels[node.state];

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

function CancelledTerminal({ node }: { node: ProblemLifecycleTrackNode }): React.JSX.Element {
  return (
    <div
      aria-label={problems.detail.lifecycleTrack.cancelledAriaLabel}
      className="mt-3 flex flex-col items-center gap-1 border-t border-dashed border-border pt-3"
    >
      <TrackNodeColumn node={node} />
      <p className="text-center text-[11px] text-muted-foreground">
        {problems.detail.lifecycleTrack.cancelledContextLabel}
      </p>
    </div>
  );
}

export interface ProblemLifecycleTrackViewProps {
  model: ProblemLifecycleTrackModel;
}

export function ProblemLifecycleTrackView({
  model,
}: ProblemLifecycleTrackViewProps): React.JSX.Element {
  const columnCount = model.main.length;
  const gridTemplateColumns = `repeat(${columnCount}, minmax(0, 1fr))`;

  return (
    <div className="flex flex-col gap-1">
      <div className="sm:hidden">
        <ol aria-label={problems.detail.lifecycleTrack.mainAriaLabel} className="flex flex-col">
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
            aria-label={problems.detail.lifecycleTrack.mainAriaLabel}
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
