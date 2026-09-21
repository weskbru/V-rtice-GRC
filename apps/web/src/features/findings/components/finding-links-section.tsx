'use client';

/**
 * PharosGRC — Finding↔Control and Finding↔Risk link management (T078,
 * 005-audit-findings, US3, FR-013 to FR-016, ADR-020).
 *
 * Mirrors `features/controls/components/control-links-section.tsx`'s own
 * anatomy: a local, unexported generic `RelationshipSubsection<TLink>` (NOT
 * imported from `features/controls` — CLAUDE.md §2, §4, business modules
 * must not depend directly on each other) rendering two independent
 * sections — Controles and Riscos — each with its own list, its own
 * registry picker and its own withdraw confirmation.
 *
 * Two things this section deliberately does NOT do, both load-bearing:
 *
 *   - **"Desvincular" is never "excluir".** Withdrawing calls `DELETE
 *     /findings/{findingId}/{controls|risks}/{linkId}` at the HTTP level,
 *     but the server answers `200` with the link body, `unlinkedAt`
 *     stamped — the row is preserved forever (FR-012/SC-005). Every string
 *     shown here says "desvincular"/"vínculo desfeito", never "excluir" or
 *     "remover permanentemente" — `findingLinks.controls.unlinkAction`
 *     already reads that way in the catalog, and the confirm dialog's own
 *     description makes the preservation explicit.
 *   - **No client-invented restriction.** A retired/suspended/draft
 *     control and an archived risk both remain linkable — that is
 *     deliberate (history is preserved); the picker never filters by
 *     status. The one restriction this section DOES apply client-side is
 *     the finding not being `ARCHIVED` (`findingLinks.controls
 *     .archivedFindingError`'s own precondition) — combined here, not by
 *     the caller, from the raw `finding:link` permission plus
 *     `findingStatus`, so the proactive archived notice (§18.11 — shown
 *     BEFORE any attempt) and the picker's own gating can never drift
 *     apart from each other.
 *
 * Unlike `ControlLinksSection` (one control's whole detail page, so full
 * `Card` chrome per relationship makes sense), `FindingLinksSection` is
 * embedded inside `FindingsPanel`'s own already-bordered per-finding `<li>`
 * — a `Card` in here would be exactly the "cartão dentro de cartão"
 * CLAUDE.md §18.5 rules out. Each subsection below is a plain block with a
 * small heading instead, the same choice `evidence-attachments-section
 * .tsx`'s own header comment already makes and explains for the identical
 * "many rows, each needing its own nested collaboration section" shape.
 *
 * ## Fetched only near the viewport (S-08, `F-61`/`A4-F05`)
 *
 * `FindingsPanel` mounts one `FindingLinksSection` per finding, unconditionally,
 * and each one used to fetch its controls AND its risks the moment it mounted —
 * two requests per finding, with no limit. Measured against a populous org
 * unit (`RSK-2026-0871`, root unit) this produced 150-350 requests on a single
 * page load. `useLoadWhenNearViewport` below defers both fetches until the
 * section is at or near the viewport (`IntersectionObserver`, generous
 * `rootMargin` so it loads slightly BEFORE scrolling it fully into view) —
 * once triggered it stays active permanently (scrolling away and back never
 * re-fetches), so the vínculos still appear automatically, without requiring
 * a click, exactly as before this fix (S-08's own constraint: "sem mudar o
 * que o usuário vê"). An environment without `IntersectionObserver` (older
 * browsers; this project's own Vitest/jsdom setup, which polyfills only
 * `ResizeObserver`) falls back to immediately active — the original
 * eager-fetch behavior — never to "never loads".
 */
import { ConfirmDialog, SearchablePicker } from '@pharos/design-system/components';
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

import { findingsApi } from '../api';
import { formatTimestampDate } from '../date';

import type {
  ControlRef,
  FindingControlLink,
  FindingRiskLink,
  FindingStatus,
  RiskRef,
} from '../types';
import type { SearchablePickerOption } from '@pharos/design-system/components';

const { findingLinks } = auditEngagements;

/**
 * Gates a section's data fetch behind viewport visibility (S-08, see this
 * file's own header). `active` starts `false` and flips to `true` exactly
 * once, the first time the returned `containerRef` element intersects the
 * viewport (or comes within `rootMargin` of it) — it never flips back, so a
 * section that has already loaded is never re-fetched by scrolling away and
 * back. Falls back to immediately `active` when `IntersectionObserver` does
 * not exist, rather than never loading at all.
 */
function useLoadWhenNearViewport(rootMargin = '200px'): {
  containerRef: React.RefObject<HTMLDivElement | null>;
  active: boolean;
} {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // The "no IntersectionObserver" fallback is decided ONCE, as the initial
  // state itself (lazy initializer), never as a `setActive` call inside the
  // effect body below — `react-hooks/set-state-in-effect` flags a direct
  // synchronous `setState` in an effect, and this fallback has no external
  // event to react to in the first place (unlike the real observer callback
  // below, which fires on an actual intersection event).
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
  /** Front H: placeholder text inside the picker's own search input. */
  readonly pickerSearchPlaceholder: string;
  /** Front H: accessible name for the picker's trigger button. */
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
  /** A stable, ASCII id fragment (e.g. `"control"`/`"risk"`) — kept separate from `entityColumnLabel` (pt-BR display text) so the checkbox's DOM `id` never embeds accented characters or spaces. */
  idSuffix: string;
  /** S-08 — `false` until this section is at or near the viewport; `fetchLinks` does not run before then (this file's own header). */
  active: boolean;
  canLink: boolean;
  getRef: (link: TLink) => RegistryOption;
  fetchLinks: (includeWithdrawn: boolean) => Promise<readonly TLink[]>;
  /** Front H: called with the user's live search text — see
   * `risk-controls-section.tsx`'s identical prop for the full reasoning. */
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
    // S-08 — do not fetch until this section is at or near the viewport;
    // `loading` (derived below from `resolvedRequestKey`) stays `true` in the
    // meantime, so the UI shows exactly what it already showed pre-fetch.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `requestKey` is derived from `includeWithdrawn`/`reloadToken`, both already listed.
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
        {/* `<h2>`, not `<h4>` (axe `heading-order` — a real defect, found by a
            rendered-page scan of `problem-relationships-section.tsx`, the
            section modelled on this one, 2026-09-11, and confirmed to already
            exist here too): the audit engagement detail page's `EntityHeader`
            renders the page's only `<h1>`, and neither it nor `EntityTabs`
            nor `FindingsPanel` renders any heading of its own, so this is
            always the first heading inside its tab panel — `<h4>` skipped
            two levels. */}
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
  /** Used only to gate `canLink` below and to show the proactive archived notice (CLAUDE.md §18.11 — communicated before an attempt, not only as a refusal). */
  findingStatus: FindingStatus;
  /** `finding:link` alone — this component combines it with `findingStatus !== 'ARCHIVED'` itself, unlike `ControlLinksSectionProps.canLinkRelationships` (which the caller pre-combines) — kept local here so the archived notice below and the picker's own gating can never drift apart. */
  canLinkPermission: boolean;
}

/** `getRef` adapters — `FindingControlLink`/`FindingRiskLink` each name their target under a different key (`control`/`risk`). */
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
