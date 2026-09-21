'use client';

/**
 * PharosGRC — incident detail, Risks/Assets/Processes relationship
 * sections (008-incidents-problems, US3), mirroring `FindingLinksSection`'s
 * self-fetching `RelationshipSubsection<TLink>` shape exactly (CLAUDE.md
 * §18.12) — one parameterized subsection instantiated three times, each in
 * its own `Card` (this detail view renders one section per `EntityTabs`
 * tab, unlike `FindingLinksSection`'s embedded, borderless layout inside an
 * already-bordered `<li>`).
 *
 * `IncidentDetail` does NOT embed `risks`/`assets`/`processes` the way
 * `RiskDetail` embeds `controls`/`processes`/`assets` — `incidents
 * .openapi.yaml` gives each relationship its own `GET
 * /incidents/{id}/{risks|assets|processes}` list endpoint and nothing on
 * `IncidentDetail` itself (`packages/api-types/src/generated/incidents.ts`).
 * Each subsection therefore fetches and owns its own list state, refreshing
 * itself after a link/unlink rather than depending on the parent detail
 * re-fetching (no `onChanged` prop crossing back up to the detail view).
 *
 * The picker is `SearchablePicker` (`@pharos/design-system`), never a plain
 * `Select` — per the coordinator's explicit instruction, it is now the only
 * correct way to offer a record in this codebase. Each of `RiskRef`/
 * `AssetRef`/`ProcessRef` names its display text differently in the
 * contract (`RiskRef.title` vs. `AssetRef.name`/`ProcessRef.name`) — the
 * `*OptionRef`/`*Ref` adapter functions below normalize all three into one
 * `{id, code, name}` shape, mirroring `finding-links-section.tsx`'s own
 * `riskRef`/`riskOptionRef` adapters exactly.
 *
 * Unlink withdraws (`unlinkedAt` stamped), never deletes — the current list
 * loses the row unless "mostrar vínculos desfeitos" is checked, in which
 * case it stays, visibly marked. Unlike `FindingRiskLink`, these link
 * responses carry no `unlinkedBy` (`packages/api-types/src/generated
 * /incidents.ts`'s own `IncidentRiskLinkResponse` — id/ref/linkedBy/
 * linkedAt/unlinkedAt only), so the withdrawn badge shows only the date.
 *
 * ## Progressive disclosure (018-incident-detail-experience, Fase 5)
 *
 * Measured before this change: the picker and "Vincular" sat permanently
 * open in all three sections — even in the empty and error states — with
 * "Mostrar vínculos desfeitos" floating above the data. The query read as a
 * form. `gateLinkBehindAction` (defaults to `false`, mirroring
 * `risk-controls-section.tsx`'s own identical prop and the exact reasoning
 * `b8b1f3f` recorded for Risk) fixes this without touching who can do what:
 * a caller with `canLink` sees an intent button ("Vincular risco"/"Vincular
 * ativo"/"Vincular processo", the SAME word `messages.pickerLabel` already
 * names) instead of the picker; clicking it reveals the SearchablePicker +
 * "Vincular" + a "Cancelar" escape hatch, exactly as risk-controls-
 * section's own `showLinker` does. All three families here pass
 * `gateLinkBehindAction` — unlike Risk, where only "Controles" got it and
 * "Processos e Ativos" was the coordinator's own explicit blast-radius
 * exception — because the measurement that triggered this rodada found the
 * SAME "always-open form" defect in all three of these sections at once.
 *
 * The empty state is never silent about the intent button: `b8b1f3f`'s own
 * reasoning applies unchanged — "a silent empty state is worse than an open
 * form" — so the trigger renders directly under the empty-state sentence,
 * not hidden behind yet another click.
 *
 * "Mostrar vínculos desfeitos" moved from the top of `CardContent` into the
 * header, via `CardAction` (`@/components/ui/card` — already exported,
 * unused elsewhere in this app before now) — a filter belongs beside the
 * title/description it qualifies, not stacked above the data it filters.
 * Still always reachable: it is the only way to see a withdrawn link, and
 * gating it behind the same intent action as the picker would make history
 * harder to reach for no benefit.
 *
 * ## C5 (Fase 5 review, measured with real volume) — "Desvincular" was
 * scrolling out of reach
 *
 * The coordinator provisioned 16 risks/15 assets/15 processes through the
 * real API and measured the table pushing its own "Vinculado em"/
 * "Desvincular" columns past the visible edge — 127px at 1440, 199px at
 * 1024 — with the 320px contextual aside (Fase 4) having already narrowed
 * the main column from 1120px to 726px. `Table`'s own `overflow-x-auto`
 * wrapper made the overflow scrollable rather than broken, but a control
 * that only reveals itself to someone who discovers an undocumented
 * horizontal scroll is not reachable in practice — the exact mechanism
 * `b8b1f3f` already fixed for Risk's own assessment history ("the change
 * column inherited whitespace-nowrap and forced one unbroken line, which
 * also pushed the rationale column out of sight entirely"). The entity
 * column keeps a floor (`min-w-40`, so a short name/code pair is never
 * crushed) but now also a ceiling (`max-w-56`); "Vinculado por" loses
 * `whitespace-nowrap` — a long display name (the coordinator's own example:
 * "Platform Administrator (recovery)") now wraps within `max-w-32` instead
 * of reserving its own unbroken width; the conditional "Desfeito" column
 * gets the same treatment. No column removed, nothing paginated — the same
 * constraint `b8b1f3f` and the coordinator both named explicitly.
 *
 * ## C1 (019-problem-detail-experience, Fase D review) — `table-fixed`
 * only from `sm` up
 *
 * `table-fixed`, added by a LATER commit than C5 above and applied at
 * every width, was never re-checked at 390 with real volume — C5's own
 * measurement covered only 1440/1024. The coordinator's Fase D review of
 * the sibling Problem screen provisioned 16 real rows and measured this
 * SAME component at 390: 33px of page overflow, "Desvincular" past the
 * visible edge, and — the part C5 never caught — text reading as
 * glued-together words ("Vinculado por"/"Vinculado em" running into each
 * other in the header, a date running into "Desvincular" in a cell,
 * titles breaking mid-word). At 390 four columns squeezed into ~244px
 * leaves roughly 48px each, which no real content fits into; `table-fixed`
 * forces that width regardless, where the pre-`table-fixed` `auto` layout
 * would have grown the table and let the reader scroll to it honestly.
 * This was a real, already-shipped defect on `main`, not something the
 * Problem rodada introduced — found because that rodada was about to
 * knowingly reproduce it. Fixed by scoping `table-fixed` to
 * `sm:table-fixed`: below `sm` the table reverts to `auto`, sizing columns
 * by content and scrolling horizontally within `Table`'s own
 * `overflow-x-auto`/`tabIndex={0}` wrapper (already keyboard-reachable,
 * D-15). The percentage `w-[*]` classes on `TableHead` stay unprefixed —
 * under `auto` layout they are merely a sizing hint, exactly as before
 * `table-fixed` existed here at all.
 */
import { ConfirmDialog, SearchablePicker } from '@pharos/design-system/components';
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
import type { SearchablePickerOption } from '@pharos/design-system/components';

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
  /** See this file's own `gateLinkBehindAction` doc comment above. Defaults to `false`. */
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `requestKey` is derived from `includeWithdrawn`/`reloadToken`, both already listed.
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
            {/* `table-fixed` — C5's remaining measurement after the width
                caps below still showed 6-105px of overflow at 1440/1024
                with a genuinely long entity title: `max-w-*` on a `<td>`
                is only a hint under the browser's default `table-layout:
                auto` column-width algorithm, which still grows a column
                to fit its longest unbroken content. Explicit percentage
                widths on `TableHead`, combined with `table-fixed`, make
                the table's own total width authoritative — a column
                cannot grow past its assigned share regardless of content
                length, so wrapping (not overflow) is the only outcome. */}
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
                    // Fixed px, not a percentage: `Button`'s own base class
                    // hardcodes `whitespace-nowrap` (shared component, not
                    // touched here), so "Desvincular" always renders on one
                    // line — a percentage narrower than its natural width
                    // would overflow the cell regardless of the column's
                    // assigned share. 112px comfortably fits the button at
                    // every supported width.
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

/** `RiskRef` names its display text `title`, not `name` (`RiskRef` in `packages/api-types/src/generated/incidents.ts`) — normalized here, mirroring `finding-links-section.tsx`'s own `riskRef`/`riskOptionRef`. */
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
