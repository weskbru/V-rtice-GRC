'use client';

/**
 * PharosGRC — control detail, relationships section (T049, US3, FR-021 to
 * FR-025, ADR-020).
 *
 * Three subsections:
 *
 *   - **Riscos** — read-only by design (FR-021): `RiskControlLink` is owned
 *     by the Risk module and is created/withdrawn only from the risk side.
 *     This section only ever calls `GET /controls/{controlId}/risks`;
 *     there is deliberately no link/unlink affordance here.
 *   - **Processos** / **Ativos** — explicit, nameable link/unlink, mirroring
 *     `RiskControlsSection`'s own `RelationshipSubsection` pattern
 *     (CLAUDE.md §18.12, §13.8) — a registry picker to add, a
 *     confirm-before-remove to withdraw. Unlike the risk-side calls, these
 *     never carry `If-Match`: they are independent, separately-keyed rows
 *     (contract's own "Optimistic locking is scoped to the control's own
 *     row" clause).
 *
 * A control that is `RETIRED` accepts no new process/asset links (FR-006) —
 * `canLinkRelationships` already reflects that from the caller (the detail
 * view passes `canEdit && control.status !== 'RETIRED'`), so the picker is
 * hidden rather than shown-then-refused.
 *
 * ## Progressive disclosure (021-control-detail-experience, Fase D)
 *
 * Measured before this change: the picker and "Vincular" sat permanently
 * open in both Processos and Ativos, even with a full list already on
 * screen — the same "query that reads as a form" defect
 * `problem-relationships-section.tsx`/`incident-relationships-section.tsx`
 * corrected in their own Fase D. `RelationshipSubsection` now shows an
 * intent button ("Vincular processo"/"Vincular ativo" — the SAME word
 * `messages.pickerLabel` already names) instead of the picker; clicking it
 * reveals the `SearchablePicker` + "Vincular" + a "Cancelar" escape hatch,
 * mirroring that same file's shape exactly (CLAUDE.md §18.12). The empty
 * state is never silent about it — the trigger renders directly under the
 * empty-state sentence, not hidden behind another click. Unlike Problem's
 * own version, there is no `includeWithdrawn` toggle here: this rodada's
 * instruction was progressive disclosure and volume-safe tables, not a new
 * "show withdrawn links" capability this screen never had — that stays
 * out of scope (CLAUDE.md §2).
 *
 * ## Volume-safe tables (Fase D)
 *
 * `table-fixed` at every width squeezes three-to-four columns into ~244px
 * at 390 — the exact defect `problem-relationships-section.tsx`'s own C1
 * (coordinator review) already measured and fixed: cell text overlapping,
 * titles breaking mid-word. `sm:table-fixed` (never unprefixed) with
 * percentage `TableHead` widths, `whitespace-normal break-words` on the
 * entity/"Vinculado por" cells (never `whitespace-nowrap` there — a long
 * name wraps within its column instead of forcing the column wide), and a
 * fixed-px action column (`Button`'s own base class hardcodes
 * `whitespace-nowrap`, so a percentage narrower than "Desvincular"'s
 * natural width would overflow regardless of its assigned share). Below
 * `sm` the table reverts to the browser's default `table-layout: auto`,
 * scrolling horizontally within the existing `overflow-x-auto` wrapper —
 * honest scroll, never overlapping text.
 */
import { ConfirmDialog, SearchablePicker } from '@pharos/design-system/components';
import { Loader2, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Link } from '@/components/navigation/link';
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
import { controls } from '@/lib/messages/controls';

import { controlsApi } from '../api';
import { formatTimestampDate } from '../date';

import type {
  ControlAssetLink,
  ControlProcessLink,
  ControlRiskLink,
  RegistrySearchResult,
} from '../types';
import type { SearchablePickerOption } from '@pharos/design-system/components';

interface RelationshipMessages {
  readonly sectionTitle: string;
  readonly sectionDescription: string;
  readonly pickerLabel: string;
  readonly pickerPlaceholder: string;
  readonly pickerNoOptions: string;
  /** Front H: placeholder text inside the picker's own search input. */
  readonly pickerSearchPlaceholder: string;
  /** Front H: accessible name for the picker's trigger button. */
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
  readonly columns: { readonly name: string; readonly linkedBy: string; readonly linkedAt: string };
}

interface RelationshipLink {
  readonly id: string;
  readonly linkedBy: { readonly fullName: string };
  readonly linkedAt: string;
}

interface RelationshipSubsectionProps<TLink extends RelationshipLink> {
  messages: RelationshipMessages;
  canLink: boolean;
  links: readonly TLink[];
  getRef: (link: TLink) => { id: string; code: string; name: string };
  /** Front H: called with the user's live search text — see
   * `risk-controls-section.tsx`'s identical prop for the full reasoning. */
  fetchRegistry: (
    query: string,
  ) => Promise<RegistrySearchResult<{ id: string; code: string; name: string }>>;
  onLink: (registryItemId: string) => Promise<void>;
  onUnlink: (linkId: string) => Promise<void>;
}

function RelationshipSubsection<TLink extends RelationshipLink>({
  messages,
  canLink,
  links,
  getRef,
  fetchRegistry,
  onLink,
  onUnlink,
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
      setShowLinker(false);
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
            {canLink && !showLinker ? (
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
                  <TableHead className="w-[40%]">{messages.columns.name}</TableHead>
                  <TableHead className="w-[24%]">{messages.columns.linkedBy}</TableHead>
                  <TableHead className="w-[18%]">{messages.columns.linkedAt}</TableHead>
                  {canLink ? (
                    // Fixed px, not a percentage: `Button`'s own base class
                    // hardcodes `whitespace-nowrap`, so "Desvincular" always
                    // renders on one line regardless of the column's
                    // assigned share — mirrors
                    // `problem-relationships-section.tsx`'s identical fix.
                    <TableHead className="sr-only w-28">{messages.unlinkAction}</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.map((link) => {
                  const ref = getRef(link);
                  return (
                    <TableRow key={link.id}>
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
          </div>
        )}

        {canLink && links.length > 0 && !showLinker ? (
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

        {canLink && showLinker ? (
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

export interface ControlLinksSectionProps {
  controlId: string;
  /** `control:edit`, AND the control must not be `RETIRED` (FR-006) — the caller passes the already-combined condition. */
  canLinkRelationships: boolean;
  /** Bump after any successful link/unlink to force this section's own lists to reload. */
  refreshToken?: number;
}

export function ControlLinksSection({
  controlId,
  canLinkRelationships,
  refreshToken = 0,
}: ControlLinksSectionProps): React.JSX.Element {
  const [riskLinks, setRiskLinks] = useState<readonly ControlRiskLink[]>([]);
  const [riskLinksError, setRiskLinksError] = useState(false);
  const [processLinks, setProcessLinks] = useState<readonly ControlProcessLink[]>([]);
  const [assetLinks, setAssetLinks] = useState<readonly ControlAssetLink[]>([]);
  const [internalToken, setInternalToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    controlsApi
      .listRiskLinks(controlId)
      .then((links) => {
        if (!cancelled) {
          setRiskLinks(links);
          setRiskLinksError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setRiskLinksError(true);
      });

    controlsApi
      .listProcessLinks(controlId)
      .then((links) => {
        if (!cancelled) setProcessLinks(links);
      })
      .catch(() => undefined);

    controlsApi
      .listAssetLinks(controlId)
      .then((links) => {
        if (!cancelled) setAssetLinks(links);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [controlId, refreshToken, internalToken]);

  function refresh(): void {
    setInternalToken((token) => token + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{controls.relationships.risks.sectionTitle}</CardTitle>
          <CardDescription>{controls.relationships.risks.sectionDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {riskLinksError ? (
            <p role="alert" className="text-sm font-medium text-status-danger-fg">
              {controls.assessment.history.loadError}
            </p>
          ) : riskLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground">{controls.relationships.risks.empty}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="sm:table-fixed">
                <TableCaption className="sr-only">
                  {controls.relationships.risks.sectionTitle}
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">
                      {controls.relationships.risks.columns.name}
                    </TableHead>
                    <TableHead className="w-[24%]">
                      {controls.relationships.risks.columns.linkedBy}
                    </TableHead>
                    <TableHead className="w-[18%]">
                      {controls.relationships.risks.columns.linkedAt}
                    </TableHead>
                    {/* Fixed px, not a percentage — see the sibling
                        subsections' own identical comment on why an action
                        column with a fixed-width button never uses a
                        percentage share. */}
                    <TableHead className="sr-only w-28">
                      {controls.relationships.risks.openRisk}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {riskLinks.map((link) => (
                    <TableRow key={link.id}>
                      <TableCell className="whitespace-normal break-words">
                        <div className="font-medium text-foreground">{link.risk.title}</div>
                        <div className="text-sm text-muted-foreground">{link.risk.code}</div>
                      </TableCell>
                      <TableCell className="whitespace-normal break-words">
                        {link.linkedBy.fullName}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatTimestampDate(link.linkedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/risks/${link.risk.id}`}>
                            {controls.relationships.risks.openRisk}
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            {controls.relationships.risks.readOnlyNotice}
          </p>
        </CardContent>
      </Card>

      <RelationshipSubsection
        messages={controls.relationships.processes}
        canLink={canLinkRelationships}
        links={processLinks}
        getRef={(link) => link.process}
        fetchRegistry={(q) => controlsApi.listProcesses(q)}
        onLink={async (processId) => {
          await controlsApi.linkProcess(controlId, { id: processId });
          refresh();
        }}
        onUnlink={async (linkId) => {
          await controlsApi.unlinkProcess(controlId, linkId);
          refresh();
        }}
      />

      <RelationshipSubsection
        messages={controls.relationships.assets}
        canLink={canLinkRelationships}
        links={assetLinks}
        getRef={(link) => link.asset}
        fetchRegistry={(q) => controlsApi.listAssets(q)}
        onLink={async (assetId) => {
          await controlsApi.linkAsset(controlId, { id: assetId });
          refresh();
        }}
        onUnlink={async (linkId) => {
          await controlsApi.unlinkAsset(controlId, linkId);
          refresh();
        }}
      />
    </div>
  );
}
