import { cn } from '../lib/utils';

function SkeletonBar({ className }: { className?: string }): React.JSX.Element {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} />;
}

export type LoadingStateVariant = 'block' | 'table' | 'inline';

export interface LoadingStateProps {
  variant?: LoadingStateVariant;
  rows?: number;
  label?: string;
  className?: string;
}

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
