import { useId } from 'react';

import { cn } from '../../lib/utils';

import { RISK_LEVEL_ICON, RISK_LEVEL_VISUALS } from './risk-level-visuals';

import type { RiskLevel } from './risk-level-visuals';

export interface RiskMatrixScaleLevel {
  value: number;
  label: string;
  description?: string;
}

export interface RiskMatrixCellPosition {
  probabilityValue: number;
  impactValue: number;
}

export interface RiskMatrixCell extends RiskMatrixCellPosition {
  score: number;
  level: RiskLevel;
}

export interface RiskMatrixHighlight extends RiskMatrixCellPosition {
  basis: 'inherent' | 'residual';
}

export interface RiskMatrixLabels {
  probabilityAxisLabel: string;
  impactAxisLabel: string;
  cornerCellLabel: string;
  levelName: (level: RiskLevel) => string;
  basisName: (basis: 'inherent' | 'residual') => string;
  basisAbbreviation: (basis: 'inherent' | 'residual') => string;
  cellAccessibleLabel: (params: {
    probabilityLabel: string;
    impactLabel: string;
    score: number;
    levelLabel: string;
  }) => string;
  caption: string;
}

export interface RiskMatrixProps {
  probabilityScale: readonly RiskMatrixScaleLevel[];
  impactScale: readonly RiskMatrixScaleLevel[];
  matrix: readonly RiskMatrixCell[];
  highlighted?: readonly RiskMatrixHighlight[];
  selectedCell?: RiskMatrixCellPosition | null;
  onCellSelect?: (cell: RiskMatrixCell) => void;
  labels: RiskMatrixLabels;
  className?: string;
}

function cellKey(position: RiskMatrixCellPosition): string {
  return `${position.probabilityValue}:${position.impactValue}`;
}

export function RiskMatrix({
  probabilityScale,
  impactScale,
  matrix,
  highlighted = [],
  selectedCell = null,
  onCellSelect,
  labels,
  className,
}: RiskMatrixProps): React.JSX.Element {
  const captionId = useId();
  const cellsByKey = new Map<string, RiskMatrixCell>(matrix.map((cell) => [cellKey(cell), cell]));
  const highlightsByKey = new Map<string, RiskMatrixHighlight[]>();
  for (const highlight of highlighted) {
    const key = cellKey(highlight);
    const existing = highlightsByKey.get(key);
    if (existing) {
      existing.push(highlight);
    } else {
      highlightsByKey.set(key, [highlight]);
    }
  }

  const rows = [...probabilityScale].sort((a, b) => b.value - a.value);
  const columns = impactScale;

  const isInteractive = Boolean(onCellSelect);

  return (
    <div className={cn('rounded-lg border border-border', className)}>
      <div className="relative w-full overflow-x-auto">
        <table
          className="w-full border-collapse text-sm"
          aria-labelledby={labels.caption ? captionId : undefined}
        >
          <caption id={captionId} className="sr-only">
            {labels.caption}
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                colSpan={2}
                rowSpan={2}
                className="border border-border p-2 text-left align-bottom text-xs font-semibold text-muted-foreground"
              >
                {labels.cornerCellLabel}
              </th>
              <th
                scope="colgroup"
                colSpan={columns.length}
                className="border border-border p-1 text-center text-xs font-semibold text-muted-foreground"
              >
                {labels.impactAxisLabel}
              </th>
            </tr>
            <tr>
              {columns.map((impact) => (
                <th
                  key={impact.value}
                  scope="col"
                  className="border border-border p-2 text-center text-xs font-medium whitespace-nowrap text-foreground"
                >
                  {impact.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((probability, rowIndex) => (
              <tr key={probability.value}>
                {rowIndex === 0 ? (
                  <th
                    scope="rowgroup"
                    rowSpan={rows.length}
                    className="border border-border p-2 text-center align-middle text-xs font-semibold whitespace-nowrap text-muted-foreground"
                  >
                    <span className="[writing-mode:vertical-rl]">
                      {labels.probabilityAxisLabel}
                    </span>
                  </th>
                ) : null}
                <th
                  scope="row"
                  className="border border-border p-2 text-left text-xs font-medium whitespace-nowrap text-foreground"
                >
                  {probability.label}
                </th>
                {columns.map((impact) => {
                  const position: RiskMatrixCellPosition = {
                    probabilityValue: probability.value,
                    impactValue: impact.value,
                  };
                  const key = cellKey(position);
                  const cell = cellsByKey.get(key);
                  const cellHighlights = highlightsByKey.get(key) ?? [];
                  const isSelected =
                    selectedCell !== null &&
                    selectedCell.probabilityValue === position.probabilityValue &&
                    selectedCell.impactValue === position.impactValue;

                  return (
                    <td key={impact.value} className="border border-border p-1 text-center">
                      {cell ? (
                        <RiskMatrixCellContent
                          cell={cell}
                          probabilityLabel={probability.label}
                          impactLabel={impact.label}
                          highlights={cellHighlights}
                          selected={isSelected}
                          interactive={isInteractive}
                          onSelect={onCellSelect}
                          labels={labels}
                        />
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface RiskMatrixCellContentProps {
  cell: RiskMatrixCell;
  probabilityLabel: string;
  impactLabel: string;
  highlights: readonly RiskMatrixHighlight[];
  selected: boolean;
  interactive: boolean;
  onSelect: ((cell: RiskMatrixCell) => void) | undefined;
  labels: RiskMatrixLabels;
}

function RiskMatrixCellContent({
  cell,
  probabilityLabel,
  impactLabel,
  highlights,
  selected,
  interactive,
  onSelect,
  labels,
}: RiskMatrixCellContentProps): React.JSX.Element {
  const Icon = RISK_LEVEL_ICON[cell.level];
  const levelLabel = labels.levelName(cell.level);
  const accessibleLabel = labels.cellAccessibleLabel({
    probabilityLabel,
    impactLabel,
    score: cell.score,
    levelLabel,
  });
  const hasInherent = highlights.some((highlight) => highlight.basis === 'inherent');
  const hasResidual = highlights.some((highlight) => highlight.basis === 'residual');

  const body = (
    <span
      className={cn(
        'relative flex min-h-14 w-full flex-col items-center justify-center gap-0.5 rounded-md p-1.5',
        RISK_LEVEL_VISUALS[cell.level].subtle,
        RISK_LEVEL_VISUALS[cell.level].shape,
        selected && 'outline outline-2 outline-offset-1 outline-ring',
      )}
    >
      {hasInherent ? (
        <span
          aria-hidden="true"
          title={labels.basisName('inherent')}
          className="absolute -top-1.5 -left-1.5 flex size-4 items-center justify-center rounded-full border-2 border-current bg-background text-[9px] leading-none font-bold"
        >
          {labels.basisAbbreviation('inherent')}
        </span>
      ) : null}
      {hasResidual ? (
        <span
          aria-hidden="true"
          title={labels.basisName('residual')}
          className="absolute -right-1.5 -bottom-1.5 flex size-4 items-center justify-center rounded-sm border-2 border-dashed border-current bg-background text-[9px] leading-none font-bold"
        >
          {labels.basisAbbreviation('residual')}
        </span>
      ) : null}
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="text-xs font-bold leading-none">{cell.score}</span>
    </span>
  );

  const srSuffix = [
    hasInherent ? labels.basisName('inherent') : null,
    hasResidual ? labels.basisName('residual') : null,
  ]
    .filter((entry): entry is string => Boolean(entry))
    .join(' + ');

  const fullAccessibleLabel = srSuffix ? `${accessibleLabel} (${srSuffix})` : accessibleLabel;

  if (!interactive) {
    return (
      <span role="img" aria-label={fullAccessibleLabel} className="inline-flex w-full">
        {body}
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-label={fullAccessibleLabel}
      aria-pressed={selected}
      onClick={() => onSelect?.(cell)}
      className="inline-flex w-full rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {body}
    </button>
  );
}
