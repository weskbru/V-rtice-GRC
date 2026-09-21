import { useId } from 'react';

import { cn } from '../../lib/utils';

import { RISK_LEVEL_ICON, RISK_LEVEL_VISUALS } from './risk-level-visuals';

import type { RiskLevel } from './risk-level-visuals';

/** One entry of `RiskMethodologyVersion.probabilityScale` / `.impactScale` (data-model.md §7) — an ordered axis level, e.g. `{ value: 3, label: 'Possível', description: '...' }`. */
export interface RiskMatrixScaleLevel {
  value: number;
  label: string;
  description?: string;
}

/** Identifies one matrix cell by its axis values — the coordinate the caller round-trips through `onCellSelect`/`selectedCell`/`highlighted`. */
export interface RiskMatrixCellPosition {
  probabilityValue: number;
  impactValue: number;
}

/**
 * One entry of `RiskMethodologyVersion.matrix` (data-model.md §7): the
 * already-derived `score`/`level` for a (probability, impact) pair. `score`
 * and `level` NEVER originate in this component — per ADR-006, scoring is
 * owned exclusively by the backend `RiskScoringService`; `RiskMatrix` only
 * looks the pair up and renders it.
 */
export interface RiskMatrixCell extends RiskMatrixCellPosition {
  score: number;
  level: RiskLevel;
}

/** Marks a cell as the risk's current inherent or residual assessment, so both can be shown in context on the same matrix and never confused with one another. */
export interface RiskMatrixHighlight extends RiskMatrixCellPosition {
  basis: 'inherent' | 'residual';
}

/**
 * `RiskMatrix`'s own chrome text. Required, never defaulted inside the
 * component — like `DataTableLabels`, `packages/design-system` must not
 * depend on `apps/web`'s pt-BR message catalog, so every caller supplies
 * this from its own source.
 */
export interface RiskMatrixLabels {
  /** Row-axis title, e.g. "Probabilidade". */
  probabilityAxisLabel: string;
  /** Column-axis title, e.g. "Impacto". */
  impactAxisLabel: string;
  /** Text for the empty top-left corner header cell, e.g. "Probabilidade \ Impacto". */
  cornerCellLabel: string;
  /** Full level name, e.g. `LOW` -> "Baixo". Reuse the same source `RiskLevelBadge`'s caller uses, so the vocabulary matches across the app. */
  levelName: (level: RiskLevel) => string;
  /** Full basis name for assistive technology and the legend, e.g. "Inerente" / "Residual". */
  basisName: (basis: 'inherent' | 'residual') => string;
  /** Short marker text painted on a highlighted cell (kept to a letter or two so it fits), e.g. "I" / "R". */
  basisAbbreviation: (basis: 'inherent' | 'residual') => string;
  /** Full accessible name read for a cell, e.g. "Probabilidade Possível, Impacto Grave: pontuação 12, nível Alto". */
  cellAccessibleLabel: (params: {
    probabilityLabel: string;
    impactLabel: string;
    score: number;
    levelLabel: string;
  }) => string;
  /** Visually hidden `<caption>` naming the table for assistive technology, e.g. "Matriz de risco". */
  caption: string;
}

export interface RiskMatrixProps {
  /** Ordered row axis (data-model.md `probabilityScale`) — rendered highest-value row first, the conventional risk-matrix orientation. */
  probabilityScale: readonly RiskMatrixScaleLevel[];
  /** Ordered column axis (data-model.md `impactScale`) — rendered in the given (ascending) order, left to right. */
  impactScale: readonly RiskMatrixScaleLevel[];
  /** Every (probability, impact) cell's pre-derived score/level. Must cover the full `probabilityScale` × `impactScale` cross product; a missing pair renders blank. */
  matrix: readonly RiskMatrixCell[];
  /** The risk's current inherent and/or residual assessment, drawn on top of the base grid. Omit entirely for a bare methodology preview with no risk in context. */
  highlighted?: readonly RiskMatrixHighlight[];
  /** Controlled selection (for input use, e.g. the assessment form) — a cell the caller wants shown as chosen, independent of `highlighted`. */
  selectedCell?: RiskMatrixCellPosition | null;
  /**
   * Cell-selection callback. When supplied, every cell becomes a real
   * `<button>` — focusable, clickable, announced as pressed when it matches
   * `selectedCell`. When omitted (the default), `RiskMatrix` is purely
   * presentational: cells render as plain, non-focusable content, matching
   * a read-only assessment display. This is the only switch between the two
   * use cases — no other prop changes behavior.
   */
  onCellSelect?: (cell: RiskMatrixCell) => void;
  labels: RiskMatrixLabels;
  className?: string;
}

function cellKey(position: RiskMatrixCellPosition): string {
  return `${position.probabilityValue}:${position.impactValue}`;
}

/**
 * Renders the organization's configured probability × impact matrix
 * (`RiskMethodologyVersion`, data-model.md §7). Deliberately dumb: it never
 * computes a score or a level (ADR-006 — that is `RiskScoringService`'s job
 * alone) and never assumes 5×5 — every dimension comes from
 * `probabilityScale`/`impactScale`, so an organization's differently-sized
 * methodology renders exactly as configured (FR-061).
 *
 * A real `<table>` gives row/column headers naming each axis level, so a
 * screen-reader user can locate "Probabilidade Possível × Impacto Grave" the
 * same way a sighted user reads the grid. Horizontal scroll is contained to
 * the table's own wrapper (`overflow-x-auto`), matching `DataTable`, so a
 * wide matrix never makes the page scroll sideways.
 *
 * Severity per cell is never color-only: the cell's icon (shared with
 * `RiskLevelBadge`), its border weight (also shared — grows with severity)
 * and the numeric score together carry the same information as the color.
 * `highlighted` inherent/residual cells add a second, independent pair of
 * signals — corner position (top-left vs bottom-right) and marker shape
 * (solid ring vs dashed ring) plus the abbreviation text — so the two are
 * never confused even for a user who cannot distinguish hue.
 */
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

  // Highest probability row rendered first — the conventional risk-matrix
  // reading order — while the axis data itself stays in the caller's order.
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
