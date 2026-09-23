import type { ActiveFilterChip, MultiSelectFilterOption } from '@pharos/design-system/components';

export interface FilterChipLabels {
  valueChip: (fieldLabel: string, valueLabel: string) => string;
  removeLabel: (chipText: string) => string;
}

export interface SearchChipLabels extends FilterChipLabels {
  searchChip: (term: string) => string;
}

export interface MultiSelectChipLabels extends FilterChipLabels {
  countChip: (fieldLabel: string, count: number) => string;
}

export function searchChip(
  term: string,
  onRemove: () => void,
  labels: SearchChipLabels,
): ActiveFilterChip | null {
  if (!term) return null;
  const text = labels.searchChip(term);
  return { id: 'q', label: text, removeLabel: labels.removeLabel(text), onRemove };
}

export function multiSelectChip(
  id: string,
  fieldLabel: string,
  selected: readonly string[],
  options: readonly MultiSelectFilterOption[],
  onChange: (next: readonly string[]) => void,
  labels: MultiSelectChipLabels,
): ActiveFilterChip | null {
  if (selected.length === 0) return null;
  const [firstValue] = selected;
  const text =
    selected.length === 1 && firstValue !== undefined
      ? labels.valueChip(
          fieldLabel,
          (options.find((option) => option.value === firstValue) ?? { label: firstValue }).label,
        )
      : labels.countChip(fieldLabel, selected.length);
  return {
    id,
    label: text,
    removeLabel: labels.removeLabel(text),
    onRemove: () => onChange([]),
  };
}

export function singleValueChip(
  id: string,
  fieldLabel: string,
  valueLabel: string | undefined,
  onRemove: () => void,
  labels: FilterChipLabels,
): ActiveFilterChip | null {
  if (!valueLabel) return null;
  const text = labels.valueChip(fieldLabel, valueLabel);
  return { id, label: text, removeLabel: labels.removeLabel(text), onRemove };
}

export function booleanChip(
  id: string,
  fieldLabel: string,
  onRemove: () => void,
  labels: FilterChipLabels,
): ActiveFilterChip {
  return { id, label: fieldLabel, removeLabel: labels.removeLabel(fieldLabel), onRemove };
}
