'use client';

/**
 * PharosGRC — Problem↔Risk and Problem↔Incident link management
 * (008-incidents-problems, US3, ADR-020; progressive disclosure and
 * volume-safe tables added in 019-problem-detail-experience, Fase D).
 *
 * Mirrors `features/incidents/components/incident-relationships-section.tsx`'s
 * own anatomy exactly (CLAUDE.md §18.12 — Incidents already replicated the
 * `risk-controls-section.tsx` pattern this rodada asked Problems to adopt
 * too), which itself mirrors `features/findings/components/finding-links-
 * section.tsx`'s own `RelationshipSubsection<TLink>` shape: a local,
 * unexported generic (NOT imported from `features/findings`/`features/
 * incidents` — CLAUDE.md §2, §4, business modules must not depend directly
 * on each other) rendering two independent sections — Riscos and
 * Incidentes — each its own `Card`, its own list, its own `SearchablePicker`
 * (Front H — never a plain `<Select>` for a link target, whose registry can
 * be arbitrarily large) and its own withdraw confirmation.
 *
 * **"Desvincular" is never "excluir".** Withdrawing calls `DELETE
 * /problems/{problemId}/{risks|incidents}/{linkId}` at the HTTP level, but
 * the server answers `200` with the link body, `unlinkedAt` stamped — the
 * row is preserved forever. Every string shown here says "desvincular"/
 * "vínculo desfeito", never "excluir".
 *
 * **Problem owns the WRITE side of Problem↔Incident** (research.md D-14):
 * `problemsApi.linkToIncident`/`.unlinkFromIncident` are the only write
 * path for that table — this section is the one place a user can create
 * or withdraw that link, unlike the read-only mirror an Incident detail
 * screen would show.
 *
 * ## Progressive disclosure (Fase D)
 *
 * Measured before this change: the picker and "Vincular" sat permanently
 * open in both sections — even in the empty and error states — with
 * "Incluir vínculos desfeitos" floating above the data, exactly the same
 * "query that reads as a form" defect `incident-relationships-section.tsx`
 * fixed in 018's own Fase 5. `gateLinkBehindAction` (defaults to `false`,
 * same prop and same reasoning as that file and `risk-controls-section
 * .tsx` before it) fixes this without touching who can do what: a caller
 * with `canLink` sees an intent button ("Vincular risco"/"Vincular
 * incidente", the SAME word `messages.pickerLabel` already names) instead
 * of the picker; clicking it reveals the `SearchablePicker` + "Vincular" +
 * a "Cancelar" escape hatch. Both `ProblemRiskLinksSection` and
 * `ProblemIncidentLinksSection` pass it — the measurement that triggered
 * this rodada found the same always-open form in both.
 *
 * The empty state is never silent about the intent button: the trigger
 * renders directly under the empty-state sentence, not hidden behind yet
 * another click. "Incluir vínculos desfeitos" moved into the header via
 * `CardAction` — a filter belongs beside the title/description it
 * qualifies, not stacked above the data it filters — and stays reachable
 * regardless of whether the picker is open: it is the only way to see a
 * withdrawn link, and gating it behind the same intent action as the
 * picker would make history harder to reach for no benefit.
 *
 * ## Volume-safe tables (Fase D)
 *
 * With the Fase C aside in place, the main column narrows from ~1120px to
 * ~726px at 1440 — the exact condition that pushed "Vinculado em"/
 * "Desvincular" off-screen in Incidents (127px overflow at 1440, 199px at
 * 1024, C5 of 018's own Fase 5 review). Same fix: `table-fixed` with
 * explicit percentage widths on `TableHead` (the browser's default
 * `table-layout: auto` only treats `max-w-*` on a `<td>` as a hint, still
 * growing a column to fit its longest unbroken content) and dropping
 * `whitespace-nowrap` from the entity/"Vinculado por"/"Desfeito" columns —
 * a long display name (e.g. "Platform Administrator (recovery)") wraps
 * within its column instead of reserving its own unbroken width. No column
 * removed, nothing paginated. The Incidentes subsection carries one column
 * Incidents' own three sections never had (`extraColumn`, the linked
 * incident's own status) — its own width share is carved out of the entity
 * column's share rather than added on top, keeping the same total.
 *
 * ## `table-fixed` only from `sm` up (C1, coordinator review, found in
 * BOTH modules at once)
 *
 * `Table className="table-fixed"`, applied at every width, measured 33px of
 * page overflow at 390 with 16 real rows: four columns squeezed into
 * ~244px leaves each one ~48px, which no real content fits into. The
 * visible result was worse than the pre-Fase-D defect it replaced — column
 * headers ("Vinculado por"/"Vinculado em") and cell text ("18/09/2026" run
 * into "Desvincular") read as glued-together words, and titles broke
 * mid-word ("reembols o", "informaçã o") — text crossing its own box
 * boundary despite visible space between boxes, the exact class of defect
 * `b8b1f3f` already described for Risk. The coordinator measured the
 * SAME defect already live on `main` in `IncidentRelationshipsSection`
 * (018, merged before this width discipline existed at all) — 33px
 * overflow there too, so this is a real, pre-existing bug this rodada
 * inherited and is now closing in both places, not a regression introduced
 * here. Fixed by scoping `table-fixed` to `sm:table-fixed`: below `sm` the
 * table reverts to the browser's default `table-layout: auto`, sizing
 * columns by content and scrolling horizontally within `Table`'s own
 * `overflow-x-auto`/`tabIndex={0}` wrapper (already keyboard-reachable,
 * D-15) — honest horizontal scroll, never overlapping text. The percentage
 * `w-[*]` classes on `TableHead` stay unprefixed: under `auto` layout they
 * are merely a sizing hint, exactly as they were before `table-fixed`
 * existed in this file at all, so they cost nothing extra below `sm`.
 *
 * ## No manual `<h2>` any more (a deliberate change, not an oversight)
 *
 * Before this phase, this section rendered its own `<h2>` explicitly, with
 * a header comment explaining why: `EntityHeader` renders the page's only
 * `<h1>`, and nothing else on the (then headerless) screen provided a
 * `<h2>`, so this component's own title had to be one to avoid axe's
 * `heading-order` rule (skipping straight to a lower level). Since Fase C,
 * `ProblemContextAside`'s three blocks each render a REAL `<h2>` of their
 * own — the same fix `IncidentContextAside` already proved (018, Fase 4).
 * `CardTitle` (`@/components/ui/card`) is a plain `<div>`, not a heading
 * element, so switching to it here introduces no heading of any level —
 * neither a skip nor a duplicate. This mirrors `IncidentRelationshipsSection`
 * exactly, which has used `CardTitle` this way since 018 with a
 * `0`-violation axe scan.
 */
import { ConfirmDialog, SearchablePicker, StatusBadge } from '@pharos/design-system/components';
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
import { problems } from '@/lib/messages/problems';

import { problemsApi } from '../api';
import { formatTimestampDate } from '../date';

import type {
  IncidentStatusRef,
  ProblemIncidentLinkResponse,
  ProblemRiskLinkResponse,
} from '../types';
import type { SearchablePickerOption, StatusVariant } from '@pharos/design-system/components';
import type { ReactNode } from 'react';

const { relationships } = problems;

/** A local, minimal copy of the linked incident's own status label/colour
 * — declared here rather than imported from `features/incidents/status.ts`
 * (CLAUDE.md §2, §4: business modules do not depend on each other's
 * code). Shown for information only (research.md D-15: this link never
 * gates, and never inspects, either record's lifecycle to decide
 * anything), so a plain, independent label map is enough — it never needs
 * to match `IncidentController`'s own transition table, only to name each
 * of the five possible values honestly. */
const LINKED_INCIDENT_STATUS_LABEL: Record<IncidentStatusRef, string> = {
  OPEN: 'Aberto',
  IN_PROGRESS: 'Em andamento',
  RESOLVED: 'Resolvido',
  CLOSED: 'Encerrado',
  CANCELLED: 'Cancelado',
};

const LINKED_INCIDENT_STATUS_VARIANT: Record<IncidentStatusRef, StatusVariant> = {
  OPEN: 'info',
  IN_PROGRESS: 'warning',
  RESOLVED: 'success',
  CLOSED: 'neutral',
  CANCELLED: 'neutral',
};

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
  /** `string | null | undefined` — the generated `ProblemRiskLinkResponse`/
   * `ProblemIncidentLinkResponse` mark `unlinkedAt` nullable but NOT
   * required, so a fresh (never-withdrawn) link's own generated type omits
   * it rather than guaranteeing `null`. Every read below treats "absent"
   * and "explicitly null" identically (never withdrawn). */
  readonly unlinkedAt?: string | null;
}

interface RelationshipSubsectionProps<TLink extends RelationshipLink> {
  messages: RelationshipMessages;
  regionLabel: string;
  entityColumnLabel: string;
  idSuffix: string;
  canLink: boolean;
  getRef: (link: TLink) => RegistryOption;
  /** Optional extra column rendered right after the entity column — used
   * by the Incidentes subsection to show the linked incident's OWN
   * lifecycle status (a fact this section never edits or gates on,
   * research.md D-15 — it is shown, never acted on). */
  extraColumn?: { readonly header: string; readonly render: (link: TLink) => ReactNode };
  fetchLinks: (includeWithdrawn: boolean) => Promise<readonly TLink[]>;
  fetchRegistry: (q: string) => Promise<{ data: readonly RegistryOption[]; isPartial: boolean }>;
  onLink: (registryItemId: string) => Promise<void>;
  onUnlink: (linkId: string) => Promise<void>;
  /** See this file's own "Progressive disclosure" doc comment above. Defaults to `false`. */
  gateLinkBehindAction?: boolean;
}

function RelationshipSubsection<TLink extends RelationshipLink>({
  messages,
  regionLabel,
  entityColumnLabel,
  idSuffix,
  canLink,
  getRef,
  extraColumn,
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

  // The entity column's own width share makes room for `extraColumn` (the
  // Incidentes subsection's linked-status badge) when present, rather than
  // adding a sixth column's width on top of Incident's own four-column
  // total — see this file's own header comment. `extraColumnWidthClass`
  // mirrors `incident-problem-links-section.tsx`'s own `w-[20%]` for the
  // exact same shape of column (a `StatusBadge` whose longest real label,
  // "Em andamento", overflowed a narrower 14% column into "Vinculado por"
  // — measured directly at 1440 with real linked-incident volume, not
  // assumed from the shorter labels tried first).
  const entityWidthClass = extraColumn ? 'w-[24%]' : 'w-[34%]';
  const linkedByWidthClass = extraColumn ? 'w-[18%]' : 'w-[20%]';
  const linkedAtWidthClass = extraColumn ? 'w-[12%]' : 'w-[14%]';
  const withdrawnWidthClass = extraColumn ? 'w-[14%]' : 'w-[16%]';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{messages.sectionTitle}</CardTitle>
        <CardDescription>{messages.sectionDescription}</CardDescription>
        <CardAction className="flex items-center gap-2">
          <Checkbox
            id={`problem-links-${idSuffix}-withdrawn`}
            checked={includeWithdrawn}
            onCheckedChange={(checked) => setIncludeWithdrawn(checked === true)}
          />
          <Label
            htmlFor={`problem-links-${idSuffix}-withdrawn`}
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
              <TableCaption className="sr-only">{regionLabel}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className={entityWidthClass}>{entityColumnLabel}</TableHead>
                  {extraColumn ? (
                    <TableHead className="w-[20%]">{extraColumn.header}</TableHead>
                  ) : null}
                  <TableHead className={linkedByWidthClass}>{messages.columns.linkedBy}</TableHead>
                  <TableHead className={linkedAtWidthClass}>{messages.columns.linkedAt}</TableHead>
                  {includeWithdrawn ? (
                    <TableHead className={withdrawnWidthClass}>
                      {relationships.withdrawnBadge}
                    </TableHead>
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
                      {extraColumn ? <TableCell>{extraColumn.render(link)}</TableCell> : null}
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

function riskRef(link: ProblemRiskLinkResponse): RegistryOption {
  return { id: link.risk.id, code: link.risk.code, name: link.risk.title };
}

function incidentRef(link: ProblemIncidentLinkResponse): RegistryOption {
  return { id: link.incident.id, code: link.incident.code, name: link.incident.title };
}

export interface ProblemLinkedSectionProps {
  problemId: string;
  /** `problem:link` — this component does not combine it with any status
   * gate: unlike `FindingLinksSection`'s archived-finding restriction, the
   * contract states no client-invented restriction here (a problem in any
   * status may still gain or lose a Risk/Incident link). */
  canLinkPermission: boolean;
}

/** Risco subsection — its own detail tab, mirroring `AssetLinkedRisksSection`'s own single-relationship-per-tab shape. */
export function ProblemRiskLinksSection({
  problemId,
  canLinkPermission,
}: ProblemLinkedSectionProps): React.JSX.Element {
  return (
    <RelationshipSubsection<ProblemRiskLinkResponse>
      messages={relationships.risks}
      regionLabel={relationships.risks.regionLabel}
      entityColumnLabel={relationships.risks.columns.risk}
      idSuffix="risk"
      canLink={canLinkPermission}
      getRef={riskRef}
      fetchLinks={(includeWithdrawn) => problemsApi.listRiskLinks(problemId, includeWithdrawn)}
      fetchRegistry={(q) =>
        problemsApi.listRiskOptions(q).then((result) => ({
          data: result.data.map((item) => ({ id: item.id, code: item.code, name: item.title })),
          isPartial: result.isPartial,
        }))
      }
      onLink={async (riskId) => {
        await problemsApi.linkRisk(problemId, riskId);
      }}
      onUnlink={async (linkId) => {
        await problemsApi.unlinkRisk(problemId, linkId);
      }}
      gateLinkBehindAction
    />
  );
}

/** Incidente subsection — Problem's own WRITE side of the shared many-to-many (research.md D-14). */
export function ProblemIncidentLinksSection({
  problemId,
  canLinkPermission,
}: ProblemLinkedSectionProps): React.JSX.Element {
  return (
    <RelationshipSubsection<ProblemIncidentLinkResponse>
      messages={relationships.incidents}
      regionLabel={relationships.incidents.regionLabel}
      entityColumnLabel={relationships.incidents.columns.incident}
      idSuffix="incident"
      canLink={canLinkPermission}
      getRef={incidentRef}
      extraColumn={{
        header: relationships.incidents.columns.status,
        render: (link) => (
          <StatusBadge
            variant={LINKED_INCIDENT_STATUS_VARIANT[link.incident.status]}
            label={LINKED_INCIDENT_STATUS_LABEL[link.incident.status]}
          />
        ),
      }}
      fetchLinks={(includeWithdrawn) => problemsApi.listIncidentLinks(problemId, includeWithdrawn)}
      fetchRegistry={(q) =>
        problemsApi.listIncidentOptions(q).then((result) => ({
          data: result.data.map((item) => ({ id: item.id, code: item.code, name: item.title })),
          isPartial: result.isPartial,
        }))
      }
      onLink={async (incidentId) => {
        await problemsApi.linkToIncident(problemId, incidentId);
      }}
      onUnlink={async (linkId) => {
        await problemsApi.unlinkFromIncident(problemId, linkId);
      }}
      gateLinkBehindAction
    />
  );
}
