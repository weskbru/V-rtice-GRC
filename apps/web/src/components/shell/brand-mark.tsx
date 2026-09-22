/** Pharos symbol supplied by the user, resized from the original transparent asset. */
import { cn } from '@/lib/utils';

export interface BrandMarkProps {
  /** Tailwind size class for the outer tile (e.g. `size-8`). */
  tileClassName: string;
  /** Tailwind size class for the mark itself (e.g. `size-5`). */
  markClassName: string;
  className?: string;
}

export function BrandMark({
  tileClassName,
  markClassName,
  className,
}: BrandMarkProps): React.JSX.Element {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-md',
        'bg-white shadow-xs ring-1 ring-border/70',
        'dark:bg-transparent dark:shadow-none dark:ring-0',
        tileClassName,
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- fixed static brand asset, not an optimizable content image */}
      <img
        src="/brand/pharos/symbol-96.png"
        alt=""
        aria-hidden="true"
        className={cn('block scale-125 object-contain', markClassName)}
      />
    </span>
  );
}
