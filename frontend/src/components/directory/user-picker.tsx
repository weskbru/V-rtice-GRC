'use client';

import { SearchablePicker } from '@pharos/design-system/components';

import { common } from '@/lib/messages/common';

import type { UserOption, UserSearchResult } from './user-option';
import type { SearchablePickerOption } from '@pharos/design-system/components';

export interface UserPickerLabels {
  readonly placeholder: string;
  readonly triggerAriaLabel: string;
}

export interface UserPickerProps {
  readonly value: UserOption | undefined;
  readonly onChange: (user: UserOption) => void;
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
