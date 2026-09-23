import { useId } from 'react';

export type IndicatorOverviewSectionVariant = 'wide' | 'compact';

export interface IndicatorOverviewSectionProps {
  readonly title: string;
  readonly variant: IndicatorOverviewSectionVariant;
  readonly children: React.ReactNode;
}

const GRID_CLASSES: Readonly<Record<IndicatorOverviewSectionVariant, string>> = {
  wide: 'grid grid-cols-1 items-start gap-4 xl:grid-cols-2',
  compact: 'grid grid-cols-1 items-start gap-4 sm:grid-cols-2 xl:grid-cols-4',
};

export function IndicatorOverviewSection({
  title,
  variant,
  children,
}: IndicatorOverviewSectionProps): React.JSX.Element {
  const headingId = useId();
  return (
    <section className="flex flex-col gap-3" aria-labelledby={headingId}>
      <h2 id={headingId} className="text-sm font-semibold text-foreground">
        {title}
      </h2>
      <div className={GRID_CLASSES[variant]}>{children}</div>
    </section>
  );
}
