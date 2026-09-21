'use client';

/**
 * PharosGRC — S-10 (`docs` audit, CONSOLIDATED.md; A7-F10, A5-F02, A1's
 * "74 entradas quase idênticas" note). Every "responsável"/"gestor"/"dono"
 * single-select field in the product used to fetch `GET /users?pageSize=100`
 * once and render a plain `<Select>` over that fixed page — a user beyond
 * the first 100 (this project's own development database already has more
 * than that) could never be chosen, silently. This component is the ONE
 * user-picker every business module's form now reuses, built on the design
 * system's existing `SearchablePicker` (server-side search, already proven
 * by `finding-links-section.tsx`/`audit-scope-control-picker.tsx`) instead
 * of inventing a second combobox — CLAUDE.md §18.3/§18.12: extend, don't
 * diverge.
 *
 * A thin adapter, nothing more: it maps this module's own `UserOption`
 * (`{id, fullName, email?}`) onto `SearchablePickerOption` (`{id, label,
 * description}`), showing the e-mail as the secondary line so visually
 * similar names (many seeded fixtures share a name prefix — A1-report.md)
 * stay distinguishable, and reconstructs a full `UserOption` from the
 * picker's own `onChange` (safe: `label`/`description` ARE `fullName`/
 * `email`, round-tripped, never a second fetch by id).
 */
import { SearchablePicker } from '@pharos/design-system/components';

import { common } from '@/lib/messages/common';

import type { UserOption, UserSearchResult } from './user-option';
import type { SearchablePickerOption } from '@pharos/design-system/components';

export interface UserPickerLabels {
  /** Shown on the closed trigger when nothing is selected (e.g. "Selecionar responsável"). */
  readonly placeholder: string;
  /** Accessible name for the trigger button (e.g. "Selecionar responsável"). */
  readonly triggerAriaLabel: string;
}

export interface UserPickerProps {
  readonly value: UserOption | undefined;
  readonly onChange: (user: UserOption) => void;
  /** Server-side search — called once with `''` on open, then debounced on
   * every keystroke. The caller's own API function decides what "browse"
   * vs. "assignment" (`assignableForOrgUnitId`) means for its endpoint;
   * this component only ever forwards the typed text. */
  readonly onSearch: (query: string) => Promise<UserSearchResult>;
  readonly labels: UserPickerLabels;
  readonly disabled?: boolean;
}

function toOption(user: UserOption): SearchablePickerOption {
  return { id: user.id, label: user.fullName, description: user.email };
}

function toUser(option: SearchablePickerOption): UserOption {
  return { id: option.id, fullName: option.label, email: option.description };
}

export function UserPicker({
  value,
  onChange,
  onSearch,
  labels,
  disabled = false,
}: UserPickerProps): React.JSX.Element {
  return (
    <SearchablePicker
      value={value ? toOption(value) : undefined}
      onChange={(option) => onChange(toUser(option))}
      onSearch={async (query) => {
        const result = await onSearch(query);
        return { options: result.data.map(toOption), isPartial: result.isPartial };
      }}
      disabled={disabled}
      labels={{
        placeholder: labels.placeholder,
        searchPlaceholder: common.userPicker.searchPlaceholder,
        emptyText: common.userPicker.emptyText,
        loadingText: common.searchablePicker.loadingText,
        partialResultsText: common.searchablePicker.partialResultsText,
        triggerAriaLabel: labels.triggerAriaLabel,
      }}
    />
  );
}
