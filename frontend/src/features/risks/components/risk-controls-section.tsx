'use client';

import { Loader2, Plus } from 'lucide-react';
import { useState } from 'react';

import { feedback } from '@/components/shell/feedback-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { risks } from '@/lib/messages/risks';
import { ConfirmDialog, SearchablePicker } from '@vertice/design-system/components';

import { risksApi } from '../api';

import type { ReferenceDataRef, RegistrySearchResult, RiskDetail, UserRef } from '../types';
import type { SearchablePickerOption } from '@vertice/design-system/components';

interface RelationshipMessages {
  readonly sectionTitle: string;
  readonly sectionDescription: string;
  readonly pickerLabel: string;
  readonly pickerPlaceholder: string;
  readonly pickerNoOptions: string;
  readonly pickerSearchPlaceholder: string;
  readonly pickerAriaLabel: string;
  readonly empty: string;
  readonly linkAction: string;
  readonly unlinkAction: string;
  readonly linkSuccess: string;
  readonly unlinkSuccess: string;
  readonly linkError: string;
  readonly unlinkError: string;
  readonly alreadyLinkedError: string;
  readonly unlinkConfirm: {
    readonly title: string;
    readonly description: (name: string) => string;
  };
  readonly columns: {
    readonly name: string;
    readonly linkedBy: string;
    readonly linkedAt: string;
  };
}

interface RelationshipLink {
  readonly id: string;
  readonly linkedBy: UserRef;
  readonly linkedAt: string;
}

interface RelationshipSubsectionProps<TLink extends RelationshipLink> {
  messages: RelationshipMessages;
  canLink: boolean;
  links: readonly TLink[];
  getRef: (link: TLink) => ReferenceDataRef;
  fetchRegistry: (query: string) => Promise<RegistrySearchResult<ReferenceDataRef>>;
  onLink: (registryItemId: string) => Promise<void>;
  onUnlink: (linkId: string) => Promise<void>;
  gateLinkBehindAction?: boolean;
}

function RelationshipSubsection<TLink extends RelationshipLink>({
  messages,
  canLink,
  links,
  getRef,
  fetchRegistry,
  onLink,
  onUnlink,
  gateLinkBehindAction = false,
}: RelationshipSubsectionProps<TLink>): React.JSX.Element {
  const [selectedOption, setSelectedOption] = useState<SearchablePickerOption | undefined>(
    undefined,
  );
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [showLinker, setShowLinker] = useState(false);

  const [pendingUnlink, setPendingUnlink] = useState<TLink | null>(null);
  const [unlinking, setUnlinking] = useState(false);

  const linkedIds = new Set(links.map((link) => getRef(link).id));

  async function handleSearch(query: string): Promise<{
    options: readonly SearchablePickerOption[];
    isPartial: boolean;
  }> {
    try {
      const result = await fetchRegistry(query);
      const available = result.data.filter((item) => !linkedIds.has(item.id));
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
      await onLink(selectedOption.id);
      feedback.success(messages.linkSuccess);
      setSelectedOption(undefined);
      if (gateLinkBehindAction) setShowLinker(false);
    } catch (error) {
      if (error instanceof ApiError && error.problem.status === 409) {
        setLinkError(messages.alreadyLinkedError);
      } else {
        setLinkError(messages.linkError);
      }
    } finally {
      setLinking(false);
    }
  }

  async function confirmUnlink(): Promise<void> {
    if (!pendingUnlink) return;
    setUnlinking(true);
    try {
      await onUnlink(pendingUnlink.id);
      feedback.success(messages.unlinkSuccess);
      setPendingUnlink(null);
    } catch {
      feedback.error(messages.unlinkError);
    } finally {
      setUnlinking(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{messages.sectionTitle}</CardTitle>
        <CardDescription>{messages.sectionDescription}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {links.length === 0 ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm text-muted-foreground">{messages.empty}</p>
            {canLink && gateLinkBehindAction && !showLinker ? (
              <Button type="button" size="sm" onClick={() => setShowLinker(true)}>
                <Plus aria-hidden="true" className="size-4" />
                {messages.pickerLabel}
              </Button>
            ) : null}
          </div>
        ) : (
          <Table>
            <TableCaption className="sr-only">{messages.sectionTitle}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>{messages.columns.name}</TableHead>
                <TableHead>{messages.columns.linkedBy}</TableHead>
                <TableHead>{messages.columns.linkedAt}</TableHead>
                {canLink ? (
                  <TableHead className="sr-only">{messages.unlinkAction}</TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {links.map((link) => {
                const ref = getRef(link);
                return (
                  <TableRow key={link.id}>
                    <TableCell>
                      <div className="font-medium text-foreground">{ref.name}</div>
                      <div className="text-sm text-muted-foreground">{ref.code}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{link.linkedBy.fullName}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {new Date(link.linkedAt).toLocaleDateString('pt-BR')}
                    </TableCell>
                    {canLink ? (
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setPendingUnlink(link)}
                        >
                          {messages.unlinkAction}
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {canLink && links.length > 0 && gateLinkBehindAction && !showLinker ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => setShowLinker(true)}
          >
            <Plus aria-hidden="true" className="size-4" />
            {messages.pickerLabel}
          </Button>
        ) : null}

        {canLink && (!gateLinkBehindAction || showLinker) ? (
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
                    placeholder: messages.pickerPlaceholder,
                    searchPlaceholder: messages.pickerSearchPlaceholder,
                    emptyText: messages.pickerNoOptions,
                    loadingText: common.searchablePicker.loadingText,
                    partialResultsText: common.searchablePicker.partialResultsText,
                    triggerAriaLabel: messages.pickerAriaLabel,
                  }}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!selectedOption || linking}
                onClick={() => void handleLink()}
                aria-label={messages.pickerLabel}
              >
                {linking ? (
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <Plus aria-hidden="true" className="size-4" />
                )}
                {messages.linkAction}
              </Button>
              {gateLinkBehindAction ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={linking}
                  onClick={() => {
                    setShowLinker(false);
                    setSelectedOption(undefined);
                    setLinkError(null);
                  }}
                >
                  {common.actions.cancel}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </CardContent>

      <ConfirmDialog
        open={pendingUnlink !== null}
        onOpenChange={(open) => {
          if (!open) setPendingUnlink(null);
        }}
        title={messages.unlinkConfirm.title}
        description={
          pendingUnlink ? messages.unlinkConfirm.description(getRef(pendingUnlink).name) : ''
        }
        labels={{
          confirm: messages.unlinkAction,
          cancel: common.confirmDialog.cancel,
          close: common.confirmDialog.close,
        }}
        variant="destructive"
        isConfirming={unlinking}
        onConfirm={() => void confirmUnlink()}
      />
    </Card>
  );
}

export type RiskRelationshipFamily = 'controls' | 'processes' | 'assets';

const ALL_FAMILIES: readonly RiskRelationshipFamily[] = ['controls', 'processes', 'assets'];

export interface RiskControlsSectionProps {
  risk: RiskDetail;
  etag: string;
  canTreatControls: boolean;
  canEditRelationships: boolean;
  onChanged: () => void;
  families?: readonly RiskRelationshipFamily[];
}

export function RiskControlsSection({
  risk,
  etag,
  canTreatControls,
  canEditRelationships,
  onChanged,
  families = ALL_FAMILIES,
}: RiskControlsSectionProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      {families.includes('controls') ? (
        <RelationshipSubsection
          messages={risks.relationships.controls}
          canLink={canTreatControls}
          links={risk.controls}
          getRef={(link) => link.control}
          fetchRegistry={(q) => risksApi.listControls(q)}
          onLink={async (controlId) => {
            await risksApi.linkControl(risk.id, { id: controlId }, etag);
            onChanged();
          }}
          onUnlink={async (linkId) => {
            await risksApi.unlinkControl(risk.id, linkId, etag);
            onChanged();
          }}
          gateLinkBehindAction
        />
      ) : null}

      {families.includes('processes') ? (
        <RelationshipSubsection
          messages={risks.relationships.processes}
          canLink={canEditRelationships}
          links={risk.processes}
          getRef={(link) => link.entity}
          fetchRegistry={(q) => risksApi.listProcesses(q)}
          onLink={async (processId) => {
            await risksApi.linkProcess(risk.id, { id: processId }, etag);
            onChanged();
          }}
          onUnlink={async (linkId) => {
            await risksApi.unlinkProcess(risk.id, linkId, etag);
            onChanged();
          }}
        />
      ) : null}

      {families.includes('assets') ? (
        <RelationshipSubsection
          messages={risks.relationships.assets}
          canLink={canEditRelationships}
          links={risk.assets}
          getRef={(link) => link.entity}
          fetchRegistry={(q) => risksApi.listAssets(q)}
          onLink={async (assetId) => {
            await risksApi.linkAsset(risk.id, { id: assetId }, etag);
            onChanged();
          }}
          onUnlink={async (linkId) => {
            await risksApi.unlinkAsset(risk.id, linkId, etag);
            onChanged();
          }}
        />
      ) : null}
    </div>
  );
}
