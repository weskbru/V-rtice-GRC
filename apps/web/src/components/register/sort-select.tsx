'use client';

import { ToolbarSelect } from './toolbar-select';

export interface SortSelectLabels {
  /** Accessible name of the control, e.g. "Ordenar por". */
  sortLabel: string;
  /** Named presets, keyed `"<field>:<direction>"`, in the order the module wants them offered. */
  sortOptions: Readonly<Record<string, string>>;
  /** Field names for composing a label for an ordering that is not one of the presets. */
  sortFieldLabels: Readonly<Record<string, string>>;
  sortDirectionLabels: Readonly<Record<string, string>>;
  /** Composes the two above, e.g. `(f, d) => \`${f} (${d})\``. */
  customSortOption: (fieldLabel: string, directionLabel: string) => string;
}

export interface SortSelectProps<TField extends string, TDirection extends string> {
  labels: SortSelectLabels;
  sort: TField;
  direction: TDirection;
  onSortChange: (field: TField, direction: TDirection) => void;
  /** Short visible caption in front of the control. Usually the module's own `sortLabel` ("Ordenar por"), which then stays the accessible name and is not announced twice. */
  prefix?: string;
  triggerClassName?: string;
  className?: string;
}

/** `"<field>:<direction>"` → the pair the caller expects. Only ever called with a key this component itself produced, so the split is always well-formed. */
function parseSortKey<TField extends string, TDirection extends string>(
  key: string,
): { field: TField; direction: TDirection } {
  const [field, direction] = key.split(':');
  return { field: field as TField, direction: direction as TDirection };
}

/**
 * A register's ordering control.
 *
 * The rule it exists to enforce is that **the control can always name the
 * ordering in force**. A module's curated presets cover the orderings worth
 * offering by name, but a sortable column header in table view can produce
 * any field/direction pair — clicking "Título" twice yields `title:desc`,
 * which is deliberately not a preset — and a `<Select>` showing a blank
 * value while the list is demonstrably sorted is a defect, not an edge case
 * (CLAUDE.md §18.11). When the active pair is not a preset, one extra option
 * is composed from `sortFieldLabels`/`sortDirectionLabels` and selected.
 *
 * Three modules had each answered this differently — presets with a
 * composed fallback, the full field × direction cartesian product, and
 * nothing at all — for a control that carries no domain meaning of its own.
 * The options are still the module's (they must match what its own contract
 * accepts, or the screen would offer a sort the server rejects); the
 * behaviour around them is not.
 */
export function SortSelect<TField extends string, TDirection extends string>({
  labels,
  sort,
  direction,
  onSortChange,
  prefix,
  triggerClassName = 'w-[13rem]',
  className,
}: SortSelectProps<TField, TDirection>): React.JSX.Element {
  const currentKey = `${sort}:${direction}`;
  const presetEntries = Object.entries(labels.sortOptions);
  const hasCurrentPreset = presetEntries.some(([key]) => key === currentKey);

  const options = (
    hasCurrentPreset
      ? presetEntries
      : [
          ...presetEntries,
          [
            currentKey,
            labels.customSortOption(
              labels.sortFieldLabels[sort] ?? sort,
              labels.sortDirectionLabels[direction] ?? direction,
            ),
          ] as const,
        ]
  ).map(([value, label]) => ({ value, label }));

  return (
    <ToolbarSelect
      label={labels.sortLabel}
      prefix={prefix}
      options={options}
      value={currentKey}
      onValueChange={(value) => {
        const { field, direction: nextDirection } = parseSortKey<TField, TDirection>(value);
        onSortChange(field, nextDirection);
      }}
      triggerClassName={triggerClassName}
      className={className}
    />
  );
}
