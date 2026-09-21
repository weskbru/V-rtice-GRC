/**
 * PharosGRC — one titled grid section of the redesigned `/indicators` first
 * screen (indicators-round, S1 ownership, coordinator PLAN.md §2 steps 4/5).
 *
 * One reusable component for BOTH sections ("Composição por nível e
 * severidade" and "Contagens e percentuais") — they differ only in column
 * count (wide `BY_BUCKET` cards vs. compact `SINGLE_VALUE` cards) and title,
 * never in structure, so a `variant` prop is the whole difference rather
 * than two near-duplicate files.
 *
 * `items-start` on the grid, not the default `items-stretch`, is the fix for
 * the baseline's own measured defect (`s3-baseline.md` §4/§6): CSS grid
 * row-stretch forced every card in a row to the height of its tallest
 * sibling, leaving up to 43% of a card as blank padding at 1440/1920px —
 * "the opposite of the densa em informação... apropriado brand direction
 * calls for" (CLAUDE.md §18.5). Splitting into two sections by shape already
 * removes the worst offender (a tall `BY_BUCKET` card forcing three short
 * `SINGLE_VALUE` cards to stretch); `items-start` removes the milder,
 * still-real version of the same problem within each section (cards with vs.
 * without a threshold line, a definition description, or a "Ver registros"
 * link).
 */
import { useId } from 'react';

export type IndicatorOverviewSectionVariant = 'wide' | 'compact';

export interface IndicatorOverviewSectionProps {
  readonly title: string;
  readonly variant: IndicatorOverviewSectionVariant;
  readonly children: React.ReactNode;
}

const GRID_CLASSES: Readonly<Record<IndicatorOverviewSectionVariant, string>> = {
  wide: 'grid grid-cols-1 items-start gap-4 xl:grid-cols-2',
  // 4 columns from `xl` (1280px main content width) — evaluated against the
  // rendered review at 1440: the longest compact-card name ("Engajamentos de
  // auditoria abertos") wraps to two lines rather than truncating, which the
  // review named as an acceptable outcome, so this jumps straight from 2
  // columns to 4 rather than pausing at a 3-column step.
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
