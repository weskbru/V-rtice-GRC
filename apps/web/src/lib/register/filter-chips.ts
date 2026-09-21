import type { ActiveFilterChip, MultiSelectFilterOption } from '@pharos/design-system/components';

/**
 * PharosGRC — active-filter chip builders shared by every register toolbar.
 *
 * A chip stands for one filter FIELD, never for one selected value: a
 * five-status filter shown as five chips is a row a user has to read
 * instead of a state they can see. One value reads as "Status: Em
 * tratamento"; two or more collapse to "Status (2)".
 *
 * These four functions were copied, character for character, into four
 * different register toolbars and written by hand in a fifth. They are pure,
 * carry no markup and no text of their own — every word comes from the
 * calling module's own pt-BR catalog through `labels` (§11.1) — so there is
 * nothing module-specific left in them to justify a fifth copy.
 *
 * Each builder returns `null` when its filter is not active, so a caller
 * composes its chip row as one `filter(Boolean)` over the fields it has,
 * in the order it wants them shown.
 */

/**
 * Every chip needs these two phrases, whatever kind of filter it stands for.
 *
 * The three shapes here are deliberately narrow rather than one catch-all:
 * a register's catalog carries only the phrases its own filters can produce
 * — Audit engagements has no text search and therefore no `searchChip`,
 * Assets has no multi-value filter and therefore no `countChip` — and each
 * builder should ask for exactly what it uses, so a module is never pushed
 * into inventing a sentence it has no filter for.
 */
export interface FilterChipLabels {
  /** e.g. `(field, value) => \`${field}: ${value}\`` */
  valueChip: (fieldLabel: string, valueLabel: string) => string;
  /** Accessible name for the chip's remove button, e.g. `(text) => \`Remover filtro: ${text}\`` */
  removeLabel: (chipText: string) => string;
}

export interface SearchChipLabels extends FilterChipLabels {
  /** e.g. `(term) => \`Busca: "${term}"\`` */
  searchChip: (term: string) => string;
}

export interface MultiSelectChipLabels extends FilterChipLabels {
  /** The collapsed form for two or more selected values, e.g. `(field, count) => \`${field} (${count})\`` */
  countChip: (fieldLabel: string, count: number) => string;
}

/** The search term, as a chip that clears it. */
export function searchChip(
  term: string,
  onRemove: () => void,
  labels: SearchChipLabels,
): ActiveFilterChip | null {
  if (!term) return null;
  const text = labels.searchChip(term);
  return { id: 'q', label: text, removeLabel: labels.removeLabel(text), onRemove };
}

/** One multi-select field: "Status: Em tratamento" for a single value, "Status (3)" beyond that. */
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

/**
 * One single-value field (a `<Select>`-backed filter, as in the Assets,
 * Processes and Audit registers): "Unidade: PharosGRC".
 */
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

/** One boolean toggle: its own short label ("Revisão vencida") already reads as a complete chip, so no value suffix is added. */
export function booleanChip(
  id: string,
  fieldLabel: string,
  onRemove: () => void,
  labels: FilterChipLabels,
): ActiveFilterChip {
  return { id, label: fieldLabel, removeLabel: labels.removeLabel(fieldLabel), onRemove };
}
