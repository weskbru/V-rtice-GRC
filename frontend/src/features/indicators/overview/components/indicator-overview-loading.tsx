import { indicators } from '@/lib/messages/indicators';
import { cn } from '@/lib/utils';

function SkeletonBlock({ className }: { className?: string }): React.JSX.Element {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-md bg-muted', className)} />;
}

export function IndicatorOverviewLoading(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <span role="status" className="sr-only">
        {indicators.overview.states.loadingLabel}
      </span>

      <SkeletonBlock className="h-16 w-full" />
      <SkeletonBlock className="h-16 w-full" />

      <div className="flex flex-col gap-3">
        <SkeletonBlock className="h-4 w-56" />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <SkeletonBlock className="h-32 w-full" />
          <SkeletonBlock className="h-32 w-full" />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <SkeletonBlock className="h-4 w-48" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 7 }, (_, index) => (
            <SkeletonBlock key={index} className="h-28 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
