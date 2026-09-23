'use client';

import { ToolbarSelect } from './toolbar-select';

export interface SortSelectLabels {
  sortLabel: string;
  sortOptions: Readonly<Record<string, string>>;
  sortFieldLabels: Readonly<Record<string, string>>;
  sortDirectionLabels: Readonly<Record<string, string>>;
  customSortOption: (fieldLabel: string, directionLabel: string) => string;
}

export interface SortSelectProps<TField extends string, TDirection extends string> {
  labels: SortSelectLabels;
  sort: TField;
  direction: TDirection;
  onSortChange: (field: TField, direction: TDirection) => void;
  prefix?: string;
  triggerClassName?: string;
  className?: string;
}

function parseSortKey<TField extends string, TDirection extends string>(
  key: string,
): { field: TField; direction: TDirection } {
  const [field, direction] = key.split(':');
  return { field: field as TField, direction: direction as TDirection };
}

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
