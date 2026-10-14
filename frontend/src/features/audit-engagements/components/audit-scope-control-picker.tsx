'use client';

import { Loader2, Plus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { auditEngagements } from '@/lib/messages/audit-engagements';
import { common } from '@/lib/messages/common';
import { SearchablePicker } from '@vertice/design-system/components';

import { auditEngagementsApi } from '../api';

import type { AuditScopeEntry } from '../types';
import type { SearchablePickerOption } from '@vertice/design-system/components';

export interface AuditScopeControlPickerProps {
  auditId: string;
  currentScope: readonly AuditScopeEntry[];
  onAdded: (entry: AuditScopeEntry) => void;
}

export function AuditScopeControlPicker({
  auditId,
  currentScope,
  onAdded,
}: AuditScopeControlPickerProps): React.JSX.Element {
  const scope = auditEngagements.scope;

  const [selectedOption, setSelectedOption] = useState<SearchablePickerOption | undefined>(
    undefined,
  );
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const currentControlIds = new Set(
    currentScope.filter((entry) => entry.targetType === 'CONTROL').map((entry) => entry.target.id),
  );

  async function handleSearch(query: string): Promise<{
    options: readonly SearchablePickerOption[];
    isPartial: boolean;
  }> {
    try {
      const result = await auditEngagementsApi.listControls(query);
      const available = result.data.filter((item) => !currentControlIds.has(item.id));
      return {
        options: available.map((item) => ({
          id: item.id,
          label: item.name,
          description: item.code,
        })),
        isPartial: result.isPartial,
      };
    } catch {
      return { options: [], isPartial: false };
    }
  }

  async function handleAdd(): Promise<void> {
    if (!selectedOption) return;
    setAddError(null);
    setAdding(true);
    try {
      const entry = await auditEngagementsApi.addControlToScope(auditId, {
        controlId: selectedOption.id,
      });
      onAdded(entry);
      setSelectedOption(undefined);
    } catch (error) {
      if (error instanceof ApiError && error.problem.status === 409) {
        setAddError(scope.control.alreadyInScopeError);
      } else if (error instanceof ApiError && error.problem.status === 422) {
        setAddError(scope.control.outOfScopeError);
      } else {
        setAddError(scope.control.addError);
      }
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {addError ? (
        <p role="alert" className="text-sm font-medium text-status-danger-fg">
          {addError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="w-64">
          <SearchablePicker
            value={selectedOption}
            onChange={setSelectedOption}
            onSearch={handleSearch}
            disabled={adding}
            labels={{
              placeholder: scope.control.pickerPlaceholder,
              searchPlaceholder: scope.control.pickerSearchPlaceholder,
              emptyText: scope.control.pickerNoOptions,
              loadingText: common.searchablePicker.loadingText,
              partialResultsText: common.searchablePicker.partialResultsText,
              triggerAriaLabel: scope.control.pickerAriaLabel,
            }}
          />
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!selectedOption || adding}
          onClick={() => void handleAdd()}
        >
          {adding ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Plus aria-hidden="true" className="size-4" />
          )}
          {common.actions.add}
        </Button>
      </div>
    </div>
  );
}
