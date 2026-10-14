'use client';

import { Loader2, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';

import { feedback } from '@/components/shell/feedback-provider';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { incidents } from '@/lib/messages/incidents';
import { ConfirmDialog, SearchablePicker } from '@vertice/design-system/components';

import { incidentsApi } from '../api';
import { formatTimestampDate } from '../date';

import type {
  AssetRef,
  IncidentAssetLinkResponse,
  IncidentProcessLinkResponse,
  IncidentRiskLinkResponse,
  ProcessRef,
  RiskRef,
} from '../types';
import type { SearchablePickerOption } from '@vertice/design-system/components';

const { relationships } = incidents;

interface RelationshipMessages {
  readonly sectionTitle: string;
  readonly sectionDescription: string;
  readonly loading: string;
  readonly loadError: string;
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
  readonly outOfScopeError: string;
  readonly unlinkConfirm: {
    readonly title: string;
    readonly description: (name: string) => string;
  };
  readonly columns: Readonly<Record<string, string>>;
}

interface RegistryOption {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

interface RelationshipLink {
  readonly id: string;
  readonly linkedBy: { readonly fullName: string };
  readonly linkedAt: string;
  readonly unlinkedAt?: string | null;
}

interface RelationshipSubsectionProps<TLink extends RelationshipLink> {
  messages: RelationshipMessages;
  entityColumnLabel: string;
  idSuffix: string;
  canLink: boolean;
  getRef: (link: TLink) => RegistryOption;
  fetchLinks: (includeWithdrawn: boolean) => Promise<readonly TLink[]>;
  fetchRegistry: (q: string) => Promise<{ data: readonly RegistryOption[]; isPartial: boolean }>;
  onLink: (registryItemId: string) => Promise<void>;
  onUnlink: (linkId: string) => Promise<void>;
  gateLinkBehindAction?: boolean;
}

function RelationshipSubsection<TLink extends RelationshipLink>({
  messages,
  entityColumnLabel,
  idSuffix,
  canLink,
  getRef,
  fetchLinks,
  fetchRegistry,
  onLink,
  onUnlink,
  gateLinkBehindAction = false,
}: RelationshipSubsectionProps<TLink>): React.JSX.Element {
  const [includeWithdrawn, setIncludeWithdrawn] = useState(false);
  const [links, setLinks] = useState<readonly TLink[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = `${includeWithdrawn}|${reloadToken}`;
  const [resolvedRequestKey, setResolvedRequestKey] = useState<string | null>(null);
  const loading = resolvedRequestKey !== requestKey;

  const [selectedOption, setSelectedOption] = useState<SearchablePickerOption | undefined>(
    undefined,
  );
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [showLinker, setShowLinker] = useState(false);

  const [pendingUnlink, setPendingUnlink] = useState<TLink | null>(null);
  const [unlinking, setUnlinking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchLinks(includeWithdrawn)
      .then((result) => {
        if (!cancelled) {
          setLinks(result);
          setLoadError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setResolvedRequestKey(requestKey);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `requestKey` deriva das dependências listadas.
  }, [includeWithdrawn, reloadToken]);

  function refresh(): void {
    setReloadToken((token) => token + 1);
  }

  const activeLinkedIdsForSearch = new Set(
    links.filter((link) => !link.unlinkedAt).map((link) => getRef(link).id),
  );

  async function handleSearch(query: string): Promise<{
    options: readonly SearchablePickerOption[];
    isPartial: boolean;
  }> {
    try {
      const result = await fetchRegistry(query);
      const available = result.data.filter((item) => !activeLinkedIdsForSearch.has(item.id));
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
      refresh();
    } catch (error) {
      if (error instanceof ApiError && error.problem.status === 409) {
        setLinkError(messages.alreadyLinkedError);
      } else if (error instanceof ApiError && error.problem.status === 404) {
        setLinkError(messages.outOfScopeError);
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
      refresh();
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
        <CardAction className="flex items-center gap-2">
          <Checkbox
            id={`incident-links-${idSuffix}-withdrawn`}
            checked={includeWithdrawn}
            onCheckedChange={(checked) => setIncludeWithdrawn(checked === true)}
          />
          <Label
            htmlFor={`incident-links-${idSuffix}-withdrawn`}
            className="text-sm font-normal text-muted-foreground"
          >
            {relationships.includeWithdrawnLabel}
          </Label>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">{messages.loading}</p>
        ) : loadError ? (
          <p role="alert" className="text-sm font-medium text-status-danger-fg">
            {messages.loadError}
          </p>
        ) : links.length === 0 ? (
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
          <div className="overflow-x-auto">
            <Table className="sm:table-fixed">
              <TableCaption className="sr-only">{messages.sectionTitle}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[34%]">{entityColumnLabel}</TableHead>
                  <TableHead className="w-[20%]">{messages.columns.linkedBy}</TableHead>
                  <TableHead className="w-[14%]">{messages.columns.linkedAt}</TableHead>
                  {includeWithdrawn ? (
                    <TableHead className="w-[16%]">{relationships.withdrawnBadge}</TableHead>
                  ) : null}
                  {canLink ? (
                    <TableHead className="sr-only w-28">{messages.unlinkAction}</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.map((link) => {
                  const ref = getRef(link);
                  const withdrawn = Boolean(link.unlinkedAt);
                  return (
                    <TableRow key={link.id} className={withdrawn ? 'opacity-60' : undefined}>
                      <TableCell className="whitespace-normal break-words">
                        <div className="font-medium text-foreground">{ref.name}</div>
                        <div className="text-sm text-muted-foreground">{ref.code}</div>
                      </TableCell>
                      <TableCell className="whitespace-normal break-words">
                        {link.linkedBy.fullName}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatTimestampDate(link.linkedAt)}
                      </TableCell>
                      {includeWithdrawn ? (
                        <TableCell className="whitespace-normal break-words text-sm text-muted-foreground">
                          {withdrawn && link.unlinkedAt
                            ? relationships.withdrawnAt(formatTimestampDate(link.unlinkedAt))
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
                              {messages.unlinkAction}
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

export interface IncidentRelationshipsSectionProps {
  incidentId: string;
  canLink: boolean;
}

function riskLinkRef(link: IncidentRiskLinkResponse): RegistryOption {
  return { id: link.risk.id, code: link.risk.code, name: link.risk.title };
}
function riskOptionRef(item: RiskRef): RegistryOption {
  return { id: item.id, code: item.code, name: item.title };
}
function assetLinkRef(link: IncidentAssetLinkResponse): RegistryOption {
  return link.asset;
}
function assetOptionRef(item: AssetRef): RegistryOption {
  return item;
}
function processLinkRef(link: IncidentProcessLinkResponse): RegistryOption {
  return link.process;
}
function processOptionRef(item: ProcessRef): RegistryOption {
  return item;
}

export function IncidentRiskRelationshipsSection({
  incidentId,
  canLink,
}: IncidentRelationshipsSectionProps): React.JSX.Element {
  return (
    <RelationshipSubsection<IncidentRiskLinkResponse>
      messages={relationships.risks}
      entityColumnLabel={relationships.risks.columns.risk}
      idSuffix="risk"
      canLink={canLink}
      getRef={riskLinkRef}
      fetchLinks={(includeWithdrawn) => incidentsApi.listRiskLinks(incidentId, includeWithdrawn)}
      fetchRegistry={(q) =>
        incidentsApi.listRiskOptions(q).then((result) => ({
          data: result.data.map(riskOptionRef),
          isPartial: result.isPartial,
        }))
      }
      onLink={(riskId) => incidentsApi.linkRisk(incidentId, riskId).then(() => undefined)}
      onUnlink={(linkId) => incidentsApi.unlinkRisk(incidentId, linkId).then(() => undefined)}
      gateLinkBehindAction
    />
  );
}

export function IncidentAssetRelationshipsSection({
  incidentId,
  canLink,
}: IncidentRelationshipsSectionProps): React.JSX.Element {
  return (
    <RelationshipSubsection<IncidentAssetLinkResponse>
      messages={relationships.assets}
      entityColumnLabel={relationships.assets.columns.asset}
      idSuffix="asset"
      canLink={canLink}
      getRef={assetLinkRef}
      fetchLinks={(includeWithdrawn) => incidentsApi.listAssetLinks(incidentId, includeWithdrawn)}
      fetchRegistry={(q) =>
        incidentsApi.listAssetOptions(q).then((result) => ({
          data: result.data.map(assetOptionRef),
          isPartial: result.isPartial,
        }))
      }
      onLink={(assetId) => incidentsApi.linkAsset(incidentId, assetId).then(() => undefined)}
      onUnlink={(linkId) => incidentsApi.unlinkAsset(incidentId, linkId).then(() => undefined)}
      gateLinkBehindAction
    />
  );
}

export function IncidentProcessRelationshipsSection({
  incidentId,
  canLink,
}: IncidentRelationshipsSectionProps): React.JSX.Element {
  return (
    <RelationshipSubsection<IncidentProcessLinkResponse>
      messages={relationships.processes}
      entityColumnLabel={relationships.processes.columns.process}
      idSuffix="process"
      canLink={canLink}
      getRef={processLinkRef}
      fetchLinks={(includeWithdrawn) => incidentsApi.listProcessLinks(incidentId, includeWithdrawn)}
      fetchRegistry={(q) =>
        incidentsApi.listProcessOptions(q).then((result) => ({
          data: result.data.map(processOptionRef),
          isPartial: result.isPartial,
        }))
      }
      onLink={(processId) => incidentsApi.linkProcess(incidentId, processId).then(() => undefined)}
      onUnlink={(linkId) => incidentsApi.unlinkProcess(incidentId, linkId).then(() => undefined)}
      gateLinkBehindAction
    />
  );
}
