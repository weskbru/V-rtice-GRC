import { cn } from '../lib/utils';

export type VerticeLoaderVariant = 'page' | 'inline';

export interface VerticeLoaderProps {
  label: string;
  variant?: VerticeLoaderVariant;
  hideLabel?: boolean;
  className?: string;
}

const PULSE_FACETS = [
  'M50 38 L55 43 L50 48 L45 43 Z',
  'M50 23 L55 28 L50 33 L45 28 Z',
  'M50 8 L55 13 L50 18 L45 13 Z',
] as const;

const SIGNAL_CLASS = [
  'vertice-loader-signal-1',
  'vertice-loader-signal-2',
  'vertice-loader-signal-3',
] as const;

export function VerticeLoader({
  label,
  variant = 'page',
  hideLabel = false,
  className,
}: VerticeLoaderProps): React.JSX.Element {
  const isPage = variant === 'page';
  return (
    <div
      role="status"
      data-vertice-loader={variant}
      className={cn('flex items-center', isPage ? 'flex-col gap-3' : 'flex-row gap-3', className)}
    >
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 100 100"
        className={cn('shrink-0', isPage ? 'h-14 w-auto' : 'h-8 w-auto')}
      >
        <path d="M12 16 H33 L57 88 H43 Z" className="fill-(--brand-mark-ink)" />
        <path d="M67 16 H88 L57 88 H43 Z" className="fill-(--brand-mark-signal)" />
        {PULSE_FACETS.map((d, index) => (
          <path
            key={d}
            d={d}
            className={cn('vertice-loader-signal fill-(--brand-mark-signal)', SIGNAL_CLASS[index])}
          />
        ))}
      </svg>
      <span
        className={cn(
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
