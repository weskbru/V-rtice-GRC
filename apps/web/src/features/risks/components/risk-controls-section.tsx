'use client';

/**
 * PharosGRC — risk detail, Controls section (T146, US5, FR-076 to FR-078,
 * ADR-008).
 *
 * ## Decision: controls, processes AND assets all live in this one section
 *
 * `RiskDetail` carries `controls`, `processes` and `assets` as three
 * separate arrays (`risks.openapi.yaml`'s `RiskDetail`) — three explicitly
 * modelled relationships (ADR-008: "not a generic polymorphic link table"),
 * never conflated into one generic "links" list. But `GET
 * /risks/{riskId}/controls` is the ONLY one of the three that also has a
 * standalone list endpoint (`listRiskControlLinks`, with an
 * `includeWithdrawn` history mode) — `platform.openapi.yaml` defines no
 * `GET /risks/{riskId}/processes` or `.../assets` at all. The current
 * process/asset links are therefore visible ONLY through `GET
 * /risks/{riskId}` itself. Rather than sourcing controls from one endpoint
 * and processes/assets from a different one (a screen where the SAME kind
 * of data — "what is currently linked" — arrives through two different
 * mechanisms depending on which of the three it is), this component reads
 * all three uniformly from the already-loaded `risk` prop, and a
 * link/unlink of any of the three re-reads the whole risk afterward
 * (`onChanged`, mirroring `AssessmentForm.onAssessed`/
 * `RiskTreatmentSection.onTreated`) rather than each kind refreshing itself
 * through a different path. All three follow the identical link/unlink UI
 * pattern (a registry picker to add, a confirm-before-remove to withdraw),
 * so building one parameterized subsection and instantiating it three times
 * avoids writing the same interaction three subtly different ways
 * (CLAUDE.md §13.8).
 *
 * Permissions are NOT uniform across the three, per the contract's own
 * prose: controls are gated by `risk:treat` ("controls ... influence
 * residual risk", FR-078 — the same permission that governs treatment
 * decisions); processes and assets are gated by `risk:edit`. `canTreat`/
 * `canEdit` are therefore two distinct props, never one shared flag.
 *
 * ## `families` (016-risk-detail-experience §4.4, R-6)
 *
 * The risk detail screen's regrouped navigation puts Controles in "Resposta"
 * and Processos/Ativos in "Relacionamentos" — two different sections now,
 * not one "Controles" tab that quietly also rendered process/asset links
 * (R-6's own finding). Rather than fork this component in two, `families`
 * selects which of the three subsections to render, defaulting to all
 * three so every OTHER existing caller (this component's own test suite
 * included) keeps its current behaviour unchanged. The endpoints, the
 * permissions, the link/unlink flows and every loading/error/empty state
 * stay byte-for-byte the same regardless of which families are requested —
 * this is a rendering split, never a behavioural one.
 *
 * ## Unlink is destructive from the user's point of view (FR-076, FR-102)
 *
 * A link is withdrawn (`unlinkedAt`/`unlinkedByUserId` stamped), never
 * deleted — but the CURRENT list, which is all this section shows, loses
 * the row immediately and irreversibly from THIS view. `ConfirmDialog`
 * gates every unlink, and its description states plainly that the link is
 * not erased — it remains in the audited history
 * (`GET /risks/{riskId}/controls?includeWithdrawn=true`, not yet surfaced
 * in the UI in this phase) — only that it stops counting as a current
 * relationship.
 *
 * ## `gateLinkBehindAction` (016-risk-detail-experience, Área 3, 2026-09-17)
 *
 * "Controles" (now in "Resposta") gets the same "list first, link behind an
 * action" treatment as `RiskTreatmentSection`. "Processos e Ativos" (in
 * "Relacionamentos") explicitly does NOT — the coordinator's own blast-
 * radius warning for this rodada: `RelationshipSubsection` is the ONE
 * generic component behind all three families, so a change to its default
 * behaviour would silently reach an area nobody asked to change. This prop
 * defaults to `false`, keeping every existing caller (processes, assets,
 * and this component's own pre-existing tests) byte-for-byte unchanged —
 * only `RiskControlsSection`'s own `controls` instantiation below passes
 * `true`. The picker/"Vincular" block itself is not touched by this flag —
 * only whether it renders immediately or behind a trigger.
 */
import { ConfirmDialog, SearchablePicker } from '@pharos/design-system/components';
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

import { risksApi } from '../api';

import type { ReferenceDataRef, RegistrySearchResult, RiskDetail, UserRef } from '../types';
import type { SearchablePickerOption } from '@pharos/design-system/components';

/**
 * Structural shape shared by `risks.relationships.controls/processes/assets`
 * — declared explicitly (as `string`, not inferred via `typeof
 * risks.relationships.controls`) so all three catalogs satisfy it; a
 * `typeof`-derived type would infer each literal string ("Controles", ...)
 * as its own type and make the other two catalogs incompatible with it.
 */
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
  /**
   * Front H: called with the user's live search text — once with `''` when
   * the picker opens, then again on every debounced keystroke
   * (`SearchablePicker`'s own responsibility, not this component's). Never
   * called once and cached: a bigger single fetch would still run out
   * past whatever size it used, just one page further down — searching is
   * the only fix that does not run out.
   */
  fetchRegistry: (query: string) => Promise<RegistrySearchResult<ReferenceDataRef>>;
  onLink: (registryItemId: string) => Promise<void>;
  onUnlink: (linkId: string) => Promise<void>;
  /** See this file's own `gateLinkBehindAction` doc comment above. Defaults to `false` — every pre-existing caller renders the picker immediately, exactly as before this prop existed. */
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
                // Three of this exact button ("Vincular") render at once on
                // this screen — one per relationship kind (controls,
                // processes, assets) — with no surrounding row/table
                // context to disambiguate them the way per-row "Desvincular"
                // buttons have (CLAUDE.md's accessible-name-collision
                // warning). `aria-label` gives each one the SAME distinct
                // name its own picker already uses (`messages.pickerLabel`,
                // e.g. "Vincular controle") while the visible text stays the
                // short "Vincular" — a real, fixed accessibility gap, not
                // merely an under-specified test locator.
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

/** Which of the three relationship subsections to render — see this file's own `families` doc comment above. */
export type RiskRelationshipFamily = 'controls' | 'processes' | 'assets';

const ALL_FAMILIES: readonly RiskRelationshipFamily[] = ['controls', 'processes', 'assets'];

export interface RiskControlsSectionProps {
  risk: RiskDetail;
  /** The risk's current `ETag` (ADR-013) — required by every link/unlink call. */
  etag: string;
  /** Controls are gated by `risk:treat` (FR-078). */
  canTreatControls: boolean;
  /** Processes and assets are gated by `risk:edit` — a distinct permission from controls, per the contract. */
  canEditRelationships: boolean;
  /** Called after any successful link/unlink. Like `AssessmentForm.onAssessed`, none of these responses carry the risk's full updated state, so the caller re-reads the whole risk rather than this section reconciling `controls`/`processes`/`assets` locally. */
  onChanged: () => void;
  /** Which subsections to render. Defaults to all three — every caller before 016-risk-detail-experience keeps its current behaviour unchanged. */
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
