import { cn } from '../lib/utils';

/**
 * PharosGRC's institutional loading indicator (`specs/014-institutional-loader`).
 *
 * The lighthouse symbol drawn inline — not through `<img>` like `BrandMark` —
 * so each signal arc is its own node the stylesheet can animate. Every path is
 * copied verbatim from `apps/web/public/brand/pharos-mark.svg` (same
 * coordinate space); only the `viewBox` is tightened to the symbol's own
 * bounds (x 30–70.4, y 23.1–92) so the component sizes by the mark, not by the
 * asset's empty margin. Colors come from `--brand-mark-ink`/`--brand-mark-signal`:
 * the two-ink positive symbol in light mode, the single-ink white inverse
 * symbol in dark mode, exactly like the two asset files.
 *
 * Motion lives in `styles/globals.css` (`pharos-signal-*`): the tower stays
 * lit while the arcs light up outward, hold, fade and rest; under
 * `prefers-reduced-motion` the arcs are simply shown, static.
 *
 * Semantics: one `role="status"` container whose text is the label — read
 * once when the indicator appears, never re-announced by the animation (the
 * SVG itself is `aria-hidden`). Timing (when to show it at all) is the
 * caller's job: pair it with `useDelayedVisibility`.
 *
 * Not for small buttons: at 16 px the mark is unreadable, and a submit
 * button's own spinner is the right affordance there.
 */
export type PharosLoaderVariant = 'page' | 'inline';

export interface PharosLoaderProps {
  /** What is being waited for, in the caller's own pt-BR copy (this package holds no user-facing strings). */
  label: string;
  /** `page`: a centered mark with the label beneath, for route transitions and screen-level waits. `inline`: a compact mark beside the label, for a panel, dialog or section. */
  variant?: PharosLoaderVariant;
  /** Hide the label visually (it stays available to assistive technology). */
  hideLabel?: boolean;
  className?: string;
}

/** Signal arcs, inner to outer — the order they light up. */
const SIGNAL_ARCS = [
  'M54.18 68.76 A20.00 20.00 0 0 0 48.60 40.04 L44.89 45.98 A13.00 13.00 0 0 1 48.52 64.64 Z',
  'M62.27 74.63 A30.00 30.00 0 0 0 53.90 31.56 L50.19 37.49 A23.00 23.00 0 0 1 56.61 70.52 Z',
  'M70.36 80.51 A40.00 40.00 0 0 0 59.20 23.08 L55.49 29.01 A33.00 33.00 0 0 1 64.70 76.40 Z',
] as const;

/** Tower: roof, lamp room and shaft, each split into its ink half and its signal-colored half. */
const TOWER_INK = [
  'M38 46 L30 50 L36.5 50 Z',
  'M32 51 H36.5 V63 H32 Z',
  'M32 64.5 H36.5 V92 H30 Z',
] as const;
const TOWER_SIGNAL = [
  'M38 46 L36.5 50 L46 50 Z',
  'M36.5 51 H44 V63 H36.5 Z',
  'M36.5 64.5 H44 L46 92 H36.5 Z',
] as const;

const SIGNAL_CLASS = [
  'pharos-loader-signal-1',
  'pharos-loader-signal-2',
  'pharos-loader-signal-3',
] as const;

export function PharosLoader({
  label,
  variant = 'page',
  hideLabel = false,
  className,
}: PharosLoaderProps): React.JSX.Element {
  const isPage = variant === 'page';
  return (
    <div
      role="status"
      data-pharos-loader={variant}
      className={cn('flex items-center', isPage ? 'flex-col gap-3' : 'flex-row gap-3', className)}
    >
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="28 21 45 73"
        className={cn('shrink-0', isPage ? 'h-14 w-auto' : 'h-8 w-auto')}
      >
        {TOWER_INK.map((d) => (
          <path key={d} d={d} className="fill-(--brand-mark-ink)" />
        ))}
        {TOWER_SIGNAL.map((d) => (
          <path key={d} d={d} className="fill-(--brand-mark-signal)" />
        ))}
        {SIGNAL_ARCS.map((d, index) => (
          <path
            key={d}
            d={d}
            className={cn('pharos-loader-signal fill-(--brand-mark-signal)', SIGNAL_CLASS[index])}
          />
        ))}
      </svg>
      <span
        className={cn(
          // Page variant sits on a translucent overlay above live content: full-contrast
          // foreground there, the quieter muted tone only inline, on a plain surface.
          hideLabel
            ? 'sr-only'
            : isPage
              ? 'text-sm font-medium text-foreground'
              : 'text-sm text-muted-foreground',
        )}
      >
        {label}
      </span>
    </div>
  );
}
