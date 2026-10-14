'use client';

import { Loader2, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

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
import { auditEngagements } from '@/lib/messages/audit-engagements';
import { common } from '@/lib/messages/common';
import { ConfirmDialog, SearchablePicker } from '@vertice/design-system/components';

import { findingsApi } from '../api';
import { formatTimestampDate } from '../date';

import type {
  ControlRef,
  FindingControlLink,
  FindingRiskLink,
  FindingStatus,
  RiskRef,
} from '../types';
import type { SearchablePickerOption } from '@vertice/design-system/components';

const { findingLinks } = auditEngagements;

function useLoadWhenNearViewport(rootMargin = '200px'): {
  containerRef: React.RefObject<HTMLDivElement | null>;
  active: boolean;
} {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    if (active) return;
    const node = containerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setActive(true);
        }
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [active, rootMargin]);

  return { containerRef, active };
}

interface RelationshipMessages {
  readonly sectionTitle: string;
  readonly sectionDescription: string;
  readonly pickerLabel: string;
  readonly pickerPlaceholder: string;
  readonly pickerNoOptions: string;
  readonly pickerSearchPlaceholder: string;
  readonly pickerAriaLabel: string;
  readonly empty: string;
  readonly loading: string;
  readonly loadError: string;
  readonly linkAction: string;
  readonly unlinkAction: string;
  readonly linkSuccess: string;
  readonly unlinkSuccess: string;
  readonly linkError: string;
  readonly unlinkError: string;
  readonly alreadyLinkedError: string;
  readonly outOfScopeError: string;
  readonly archivedFindingError: string;
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
  readonly unlinkedAt: string | null;
  readonly unlinkedBy: { readonly fullName: string } | null;
}

interface RelationshipSubsectionProps<TLink extends RelationshipLink> {
  messages: RelationshipMessages;
  regionLabel: string;
  entityColumnLabel: string;
  idSuffix: string;
  active: boolean;
  canLink: boolean;
  getRef: (link: TLink) => RegistryOption;
  fetchLinks: (includeWithdrawn: boolean) => Promise<readonly TLink[]>;
  fetchRegistry: (q: string) => Promise<{ data: readonly RegistryOption[]; isPartial: boolean }>;
  onLink: (registryItemId: string) => Promise<void>;
  onUnlink: (linkId: string) => Promise<void>;
}

function RelationshipSubsection<TLink extends RelationshipLink>({
  messages,
  regionLabel,
  entityColumnLabel,
  idSuffix,
  active,
  canLink,
  getRef,
  fetchLinks,
  fetchRegistry,
  onLink,
  onUnlink,
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

  const [pendingUnlink, setPendingUnlink] = useState<TLink | null>(null);
  const [unlinking, setUnlinking] = useState(false);

  useEffect(() => {
    if (!active) return;
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
  }, [active, includeWithdrawn, reloadToken]);

  function refresh(): void {
    setReloadToken((token) => token + 1);
  }

  const activeLinkedIdsForSearch = new Set(
    links.filter((link) => link.unlinkedAt === null).map((link) => getRef(link).id),
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
      refresh();
    } catch (error) {
      if (error instanceof ApiError && error.problem.status === 409) {
        setLinkError(messages.alreadyLinkedError);
      } else if (error instanceof ApiError && error.problem.status === 422) {
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
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{messages.sectionTitle}</h2>
        <p className="text-xs text-muted-foreground">{messages.sectionDescription}</p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Checkbox
            id={`finding-links-${idSuffix}-withdrawn`}
            checked={includeWithdrawn}
            onCheckedChange={(checked) => setIncludeWithdrawn(checked === true)}
          />
          <Label
            htmlFor={`finding-links-${idSuffix}-withdrawn`}
            className="text-sm font-normal text-muted-foreground"
          >
            {findingLinks.includeWithdrawnLabel}
          </Label>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">{messages.loading}</p>
        ) : loadError ? (
          <p role="alert" className="text-sm font-medium text-status-danger-fg">
            {messages.loadError}
          </p>
        ) : links.length === 0 ? (
          <p className="text-sm text-muted-foreground">{messages.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableCaption className="sr-only">{regionLabel}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>{entityColumnLabel}</TableHead>
                  <TableHead>{messages.columns.linkedBy}</TableHead>
                  <TableHead>{messages.columns.linkedAt}</TableHead>
                  {includeWithdrawn ? <TableHead>{findingLinks.withdrawnBadge}</TableHead> : null}
                  {canLink ? (
                    <TableHead className="sr-only">{messages.unlinkAction}</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.map((link) => {
                  const ref = getRef(link);
                  const withdrawn = link.unlinkedAt !== null;
                  return (
                    <TableRow key={link.id} className={withdrawn ? 'opacity-60' : undefined}>
                      <TableCell>
                        <div className="font-medium text-foreground">{ref.name}</div>
                        <div className="text-sm text-muted-foreground">{ref.code}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{link.linkedBy.fullName}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatTimestampDate(link.linkedAt)}
                      </TableCell>
                      {includeWithdrawn ? (
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {withdrawn && link.unlinkedAt
                            ? `${findingLinks.withdrawnBadge} — ${findingLinks.withdrawnAt(formatTimestampDate(link.unlinkedAt))}`
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
            </div>
          </div>
        ) : null}
      </div>

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
    </div>
  );
}

export interface FindingLinksSectionProps {
  findingId: string;
  findingStatus: FindingStatus;
  canLinkPermission: boolean;
}

function controlRef(link: FindingControlLink): RegistryOption {
  return link.control;
}

function riskRef(link: FindingRiskLink): RegistryOption {
  return { id: link.risk.id, code: link.risk.code, name: link.risk.title };
}

function controlOptionRef(item: ControlRef): RegistryOption {
  return item;
}

function riskOptionRef(item: RiskRef): RegistryOption {
  return { id: item.id, code: item.code, name: item.title };
}

export function FindingLinksSection({
  findingId,
  findingStatus,
  canLinkPermission,
}: FindingLinksSectionProps): React.JSX.Element {
  const isArchived = findingStatus === 'ARCHIVED';
  const canLink = canLinkPermission && !isArchived;
  const { containerRef, active } = useLoadWhenNearViewport();

  return (
    <div ref={containerRef} className="flex flex-col gap-4 border-t border-border pt-3">
      {canLinkPermission && isArchived ? (
        <p className="text-sm text-muted-foreground">
          {findingLinks.controls.archivedFindingError}
        </p>
      ) : null}

      <RelationshipSubsection<FindingControlLink>
        messages={findingLinks.controls}
        regionLabel={auditEngagements.aria.findingControlsRegionLabel}
        entityColumnLabel={findingLinks.controls.columns.control}
        idSuffix="control"
        active={active}
        canLink={canLink}
        getRef={controlRef}
        fetchLinks={(includeWithdrawn) => findingsApi.listControlLinks(findingId, includeWithdrawn)}
        fetchRegistry={(q) =>
          findingsApi.listControlOptions(q).then((result) => ({
            data: result.data.map(controlOptionRef),
            isPartial: result.isPartial,
          }))
        }
        onLink={async (controlId) => {
          await findingsApi.linkControl(findingId, { controlId });
        }}
        onUnlink={async (linkId) => {
          await findingsApi.unlinkControl(findingId, linkId);
        }}
      />

      <div className="border-t border-border" />

      <RelationshipSubsection<FindingRiskLink>
        messages={findingLinks.risks}
        regionLabel={auditEngagements.aria.findingRisksRegionLabel}
        entityColumnLabel={findingLinks.risks.columns.risk}
        idSuffix="risk"
        active={active}
        canLink={canLink}
        getRef={riskRef}
        fetchLinks={(includeWithdrawn) => findingsApi.listRiskLinks(findingId, includeWithdrawn)}
        fetchRegistry={(q) =>
          findingsApi.listRiskOptions(q).then((result) => ({
            data: result.data.map(riskOptionRef),
            isPartial: result.isPartial,
          }))
        }
        onLink={async (riskId) => {
          await findingsApi.linkRisk(findingId, { riskId });
        }}
        onUnlink={async (linkId) => {
          await findingsApi.unlinkRisk(findingId, linkId);
        }}
      />
    </div>
  );
}
