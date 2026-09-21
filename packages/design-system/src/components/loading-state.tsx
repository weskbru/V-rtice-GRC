import { cn } from '../lib/utils';

function SkeletonBar({ className }: { className?: string }): React.JSX.Element {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} />;
}

export type LoadingStateVariant = 'block' | 'table' | 'inline';

export interface LoadingStateProps {
  variant?: LoadingStateVariant;
  /** Number of skeleton rows for the 'table' variant. */
  rows?: number;
  /** Screen-reader announcement (visually hidden). */
  label?: string;
  className?: string;
}

/**
 * Platform-wide loading placeholder (FR-045). `role="status"` plus a visually
 * hidden label means assistive technology announces the loading state even
 * though nothing readable is on screen yet (SC-012).
 *
 * ## Why this keeps `role="status"` and `StatusBadge`/`RiskLevelBadge`/
 * `RiskScore` do not (T203, F-2)
 *
 * `role="status"` is a promise to assistive technology: "watch this node;
 * announce it when it changes." A busy indicator is the one shape in this
 * package that promise fits — ARIA's own Authoring Practices name exactly
 * this "busy indicator appears, then is replaced" pattern as the canonical
 * use of `status`, and this component's real call sites are a mount/unmount
 * cycle around an async fetch (a page's first load, a re-fetch, a paginated
 * table), not a value quietly updated in place. The badge-shaped components
 * (`StatusBadge`, `RiskLevelBadge`, the not-yet-assessed branch of
 * `RiskScore`) are the opposite: usually present, unchanged, for the entire
 * lifetime of their mount, or replaced by an entirely new element (a fresh
 * table row) rather than mutated in place — `role="status"` on those cannot
 * reliably keep the promise it makes, so they carry none (see their own doc
 * comments). Applying `role="status"` everywhere "status-shaped" content
 * appears made every one of them equally unreliable; reserving it for the
 * one component that actually delivers on it is the consistent rule.
 */
export function LoadingState({
  variant = 'block',
  rows = 5,
  label = 'Carregando…',
  className,
}: LoadingStateProps): React.JSX.Element {
  return (
    <div role="status" aria-busy="true" className={cn('w-full', className)}>
      <span className="sr-only">{label}</span>
      {variant === 'inline' ? <SkeletonBar className="h-4 w-24" /> : null}
      {variant === 'block' ? (
        <div className="flex flex-col gap-3">
          <SkeletonBar className="h-6 w-1/3" />
          <SkeletonBar className="h-4 w-full" />
          <SkeletonBar className="h-4 w-5/6" />
          <SkeletonBar className="h-4 w-2/3" />
        </div>
      ) : null}
      {variant === 'table' ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: rows }, (_, i) => (
            <SkeletonBar key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : null}
    </div>
  );
}
