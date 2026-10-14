import { VerticeSymbol } from '@/components/branding/vertice-symbol';
import { cn } from '@/lib/utils';

export interface BrandMarkProps {
  tileClassName: string;
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
      <VerticeSymbol className={cn('block', markClassName)} />
    </span>
  );
}
