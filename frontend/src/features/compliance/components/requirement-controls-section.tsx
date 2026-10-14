'use client';

import { Loader2, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';

import { feedback } from '@/components/shell/feedback-provider';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ApiError } from '@/lib/api-client';
import { common } from '@/lib/messages/common';
import { compliance } from '@/lib/messages/compliance';
import { ConfirmDialog, SearchablePicker } from '@vertice/design-system/components';

import { complianceApi } from '../api';
import { formatTimestampDate } from '../date';

import type { RequirementControlLink } from '../types';
import type { SearchablePickerOption } from '@vertice/design-system/components';

export interface RequirementControlsSectionProps {
  requirementId: string;
  canLink: boolean;
  onChanged?: () => void;
}

export function RequirementControlsSection({
  requirementId,
  canLink,
  onChanged,
}: RequirementControlsSectionProps): React.JSX.Element {
  const [links, setLinks] = useState<readonly RequirementControlLink[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [showWithdrawn, setShowWithdrawn] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const [selectedOption, setSelectedOption] = useState<SearchablePickerOption | undefined>(
    undefined,
  );
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const [pendingUnlink, setPendingUnlink] = useState<RequirementControlLink | null>(null);
  const [unlinking, setUnlinking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    complianceApi
      .listRequirementControlLinks(requirementId, showWithdrawn)
      .then((result) => {
        if (!cancelled) {
          setLinks(result);
          setLoadError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [requirementId, showWithdrawn, reloadToken]);

  function refresh(): void {
    setReloadToken((token) => token + 1);
  }

  const currentLinkedIds = new Set(
    links.filter((link) => link.unlinkedAt === null).map((link) => link.control.id),
  );

  async function handleSearch(query: string): Promise<{
    options: readonly SearchablePickerOption[];
    isPartial: boolean;
  }> {
    try {
      const result = await complianceApi.listControls(query);
      const available = result.data.filter((item) => !currentLinkedIds.has(item.id));
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

  async function handleLink(): Promise<void> {
    if (!selectedOption) return;
    setLinkError(null);
    setLinking(true);
    try {
      await complianceApi.linkRequirementToControl(requirementId, { controlId: selectedOption.id });
      feedback.success(compliance.controlMapping.linkSuccess);
      setSelectedOption(undefined);
      refresh();
      onChanged?.();
    } catch (error) {
      if (error instanceof ApiError && error.problem.status === 409) {
        setLinkError(compliance.controlMapping.alreadyLinkedError);
      } else if (error instanceof ApiError && error.problem.status === 422) {
        setLinkError(compliance.controlMapping.outOfScopeError);
      } else {
        setLinkError(compliance.controlMapping.linkError);
      }
    } finally {
      setLinking(false);
    }
  }

  async function confirmUnlink(): Promise<void> {
    if (!pendingUnlink) return;
    setUnlinking(true);
    try {
      await complianceApi.unlinkRequirementFromControl(requirementId, pendingUnlink.id);
      feedback.success(compliance.controlMapping.unlinkSuccess);
      setPendingUnlink(null);
      refresh();
      onChanged?.();
    } catch {
      feedback.error(compliance.controlMapping.unlinkError);
    } finally {
      setUnlinking(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {compliance.controlMapping.sectionDescription}
      </p>

      <div className="flex items-center gap-2">
        <Checkbox
          id="requirement-controls-show-withdrawn"
          checked={showWithdrawn}
          onCheckedChange={(checked) => setShowWithdrawn(checked === true)}
        />
        <Label
          htmlFor="requirement-controls-show-withdrawn"
          className="text-sm font-normal text-muted-foreground"
        >
          {compliance.controlMapping.showWithdrawnLabel}
        </Label>
      </div>

      {loadError ? (
        <p role="alert" className="text-sm font-medium text-status-danger-fg">
          {compliance.controlMapping.linkError}
        </p>
      ) : links.length === 0 ? (
        <p className="text-sm text-muted-foreground">{compliance.controlMapping.empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableCaption className="sr-only">
              {compliance.controlMapping.sectionDescription}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>{compliance.controlMapping.columns.control}</TableHead>
                <TableHead>{compliance.controlMapping.columns.linkedBy}</TableHead>
                <TableHead>{compliance.controlMapping.columns.linkedAt}</TableHead>
                {showWithdrawn ? (
                  <TableHead>{compliance.controlMapping.columns.status}</TableHead>
                ) : null}
                {canLink ? (
                  <TableHead className="sr-only">
                    {compliance.controlMapping.unlinkAction}
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {links.map((link) => {
                const withdrawn = link.unlinkedAt !== null;
                return (
                  <TableRow key={link.id} className={withdrawn ? 'opacity-60' : undefined}>
                    <TableCell>
                      <div className="font-medium text-foreground">{link.control.name}</div>
                      <div className="text-sm text-muted-foreground">{link.control.code}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{link.linkedBy.fullName}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatTimestampDate(link.linkedAt)}
                    </TableCell>
                    {showWithdrawn ? (
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {withdrawn
                          ? `${compliance.controlMapping.withdrawnBadge} — ${compliance.controlMapping.withdrawnAt(formatTimestampDate(link.unlinkedAt))}`
                          : null}
                      </TableCell>
                    ) : null}
                    {canLink ? (
                      <TableCell className="text-right">
                        {!withdrawn ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setPendingUnlink(link)}
                          >
                            {compliance.controlMapping.unlinkAction}
                          </Button>
                        ) : null}
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {canLink ? (
        <div className="flex flex-col gap-2">
          {linkError ? (
            <p role="alert" className="text-sm font-medium text-status-danger-fg">
              {linkError}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-64">
              <SearchablePicker
                value={selectedOption}
                onChange={setSelectedOption}
                onSearch={handleSearch}
                disabled={linking}
                labels={{
                  placeholder: compliance.controlMapping.pickerPlaceholder,
                  searchPlaceholder: compliance.controlMapping.pickerSearchPlaceholder,
                  emptyText: compliance.controlMapping.pickerNoOptions,
                  loadingText: common.searchablePicker.loadingText,
                  partialResultsText: common.searchablePicker.partialResultsText,
                  triggerAriaLabel: compliance.controlMapping.pickerAriaLabel,
                }}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!selectedOption || linking}
              onClick={() => void handleLink()}
              aria-label={compliance.controlMapping.pickerLabel}
            >
              {linking ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <Plus aria-hidden="true" className="size-4" />
              )}
              {compliance.controlMapping.linkAction}
            </Button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={pendingUnlink !== null}
        onOpenChange={(open) => {
          if (!open) setPendingUnlink(null);
        }}
        title={compliance.controlMapping.unlinkConfirm.title}
        description={
          pendingUnlink
            ? compliance.controlMapping.unlinkConfirm.description(pendingUnlink.control.name)
            : ''
        }
        labels={{
          confirm: compliance.controlMapping.unlinkAction,
          cancel: common.confirmDialog.cancel,
          close: common.confirmDialog.close,
        }}
        variant="destructive"
        isConfirming={unlinking}
        onConfirm={() => void confirmUnlink()}
      />
    </div>
  );
}
