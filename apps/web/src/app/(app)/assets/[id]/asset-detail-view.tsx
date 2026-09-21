'use client';

/**
 * PharosGRC — asset detail screen (022-asset-detail-experience, Fase A shell
 * — supersedes the flat `EntityHeader` + loose lifecycle-action `Card` +
 * one-level `EntityTabs` strip this screen used before, itself built by
 * T047/006-assets-processes mirroring `RiskDetailView`'s pre-016 shape).
 *
 * ## What changed, and what did not (Fase A)
 *
 * The page composes `DetailLayout` (`@pharos/design-system/components`) —
 * the same shell `RiskDetailView`/`IncidentDetailView`/`ProblemDetailView`/
 * `ActionDetailView`/`ControlDetailView` already established — with a
 * breadcrumb + code/badges/title/metadata header and the record's four
 * sections in the main column. Every section's underlying component,
 * endpoint, permission and behaviour is UNCHANGED — this rodada reorganizes
 * presentation only, never business logic, authorization or lifecycle
 * semantics (CLAUDE.md §18.9). `AssetLifecycleActions` keeps its own `Card`
 * casing and full behaviour for now — Fase B decides its final shape,
 * mirroring `ControlLifecycleSection`'s own split, EXCEPT `Asset` has no
 * lifecycle trajectory to draw (see below). For Fase A it moves from "above
 * the tabs, always visible" to `DetailLayout`'s `children` slot (rendered
 * after `navigation`, still full width, still visible regardless of which
 * tab is active) — a position change only, not a behaviour change:
 * `DetailLayout` has no "before navigation" slot other than `summary`
 * (rejected below) or `asideLead` (there is no aside yet in Fase A), so
 * `children` is the only slot that preserves "always visible on every tab"
 * without inventing one.
 *
 * ## No lifecycle TRACK — `isActive` is a two-state switch, not a trajectory
 * (the coordinator's own instruction for this rodada)
 *
 * `AssetSummary.isActive` is a plain boolean. Unlike Control/Problem/
 * Incident/Action, an asset has no three- or four-state trajectory to draw a
 * track for — drawing one for two states would invent a percurso where the
 * data models a switch. `AssetLifecycleActions` therefore keeps rendering as
 * a single "Situação" card (badge + description + the one available
 * transition button), never a stepper, never a node, never a per-node state
 * word. Fase B's job is only to decide whether that card moves inside
 * "Visão geral" (mirroring Control's/Problem's "lifecycle card lives beside
 * the overview cards, only on that tab") — not to add a track that does not
 * belong here.
 *
 * ## Deliberately NOT two-level navigation (measured before this rodada
 * started, AST-2026-0001)
 *
 * `Asset` has exactly four sections — "Visão geral", "Riscos vinculados",
 * "Controles vinculados", "Incidentes vinculados" (all four unconditional,
 * unlike Control's permission-gated fourth) — and any grouping of four would
 * be arbitrary, exactly the same reasoning `ControlDetailView`'s own header
 * comment already recorded for its own four sections. The measured problem
 * two-level navigation solves — a flat strip overflowing at narrow widths —
 * is instead solved by the SAME two levers `size="compact"` already proved
 * for Control, this time BOTH applied, and measured together:
 *
 *   1. `size="compact"` alone (long labels unchanged): the strip's own
 *      `scrollWidth - clientWidth` was still **0** at 390px (compact's
 *      `flex-wrap` never lets a tab overflow — a tab that does not fit the
 *      current line wraps as a whole unit onto the next one instead of
 *      clipping), but the four long labels ("Riscos vinculados", "Controles
 *      vinculados", "Incidentes vinculados") wrapped across **2** lines at
 *      390px (measured via each tab's own `getBoundingClientRect().top`:
 *      338px, 338px, 372px, 372px) — technically zero overflow, but a
 *      visibly taller strip than the alternative below produces.
 *   2. Shortening the three linked-entity labels to "Riscos"/"Controles"/
 *      "Incidentes" — dropping the redundant "vinculados" the tab's own
 *      context (this screen already reads as "this asset's own record") — is
 *      a presentation-only change (CLAUDE.md §18 rodada, no functionality
 *      touched) that ALSO aligns Asset with the rest of the family: Risk,
 *      Incident and Problem already use bare nouns for their own linked-
 *      entity tabs ("Riscos", "Controles", not "Riscos vinculados"), so this
 *      is Asset catching up to an established convention, not inventing a
 *      new one. Measured with both changes together: all four tabs land on
 *      the SAME `top` (338px) — a single line at 390px, one better than
 *      Control's own two-line compact strip — with `stripOverflow === 0` at
 *      1440/1024/390 confirmed directly (`scrollWidth - clientWidth`).
 *
 * The two E2E assertions that named the old, longer labels
 * (`e2e/accessibility.spec.ts`, asset detail's own axe scans) were updated to
 * the new short names in this same commit.
 *
 * ## `?section=` deep link — ADOPTED (mirrors Control, unlike Action's own
 * decision not to)
 *
 * `Action` has exactly two sections, one rarely consulted, and declined the
 * mechanism as not worth its own `Suspense` boundary. `Asset` has four,
 * unconditional, and Fase C's aside will want to link directly at
 * "Riscos vinculados a este ativo" / "Controles vinculados a este ativo" /
 * "Incidentes vinculados a este ativo" from its own "Relacionamentos" block
 * — exactly the same shape that earned Control the same decision. This
 * reuses the shared `useDetailSection` hook (`@/components/detail/
 * use-detail-section`) directly against a SINGLE flat `EntityTabs`, without
 * the `DetailGroup`/`resolveActiveDetailSection` machinery Problem/Incident/
 * Risk need for their two levels — `EntityTabs` itself already resolves a
 * `value` naming an absent tab (a stale deep link) to the first visible tab
 * (`entity-tabs.tsx`'s own contract), so passing `sectionParam ?? ''`
 * straight through is enough; no local resolution function is needed. This
 * is why `AssetDetailView` below needs its own `Suspense` boundary
 * (`useDetailSection` reads `useSearchParams()`), mirroring Control's/
 * Problem's/Incident's own split into a thin wrapper plus a `*Content`
 * component.
 *
 * ## `summary` stays omitted
 *
 * No honest KPI of its own: situation already renders as a header badge, and
 * it is not a "count" the way Risk's own KPI row is. A `SummaryStatCard`
 * strip built only for visual symmetry with the other modules was already
 * rejected once for `Action`/`Control`; the same reasoning holds here.
 *
 * ## `aside` — decision deferred to Fase C, not a Fase A gap
 *
 * `Asset` has real relationships to summarize (Riscos and Controles arrive
 * embedded with a REAL count, Incidentes is read-only reverse without one —
 * the coordinator's own "assimetria honesta" instruction), so a "Ações
 * rápidas" + "Relacionamentos" contextual aside plausibly earns its place
 * here, mirroring `ControlContextAside`. Fase A does not build it — scoped to
 * Fase C, after Fase B settles what "Visão geral" actually looks like.
 * Leaving `aside`/`asideLabel` unset in Fase A costs nothing structural:
 * `DetailLayout`'s own `hasAsideColumn` guard means the two-column grid
 * simply does not apply yet.
 *
 * ## Leitura × edição — unchanged in Fase A (still the inline swap)
 *
 * `editing` still swaps "Visão geral"'s own tab content for `AssetForm`
 * inline, exactly as before this rodada. Fase C moves this to an overlay
 * `Sheet` (`AssetEditPanel`, mirroring `ControlEditPanel`) — doing it in
 * Fase A would mix a structural shell change with a genuine
 * interaction-pattern change in the same low-risk pass (CLAUDE.md §14).
 *
 * ## Fase B — "Visão geral" in cards, "Situação" moves inside it
 *
 * The read-only path of "Visão geral" now composes `AssetOverview` (two
 * cards: Descrição, Detalhes do ativo — see that component's own header
 * comment for why there is no third "classification" card the way Control's
 * "Efetividade"/Problem's "Causa raiz" earn one) and `AssetLifecycleActions`
 * (still that same component, now titled and placed as the "Situação" card
 * — see its own header comment for why it sits SECOND, right after
 * "Descrição", rather than last like a full lifecycle section) — mirroring
 * `ControlDetailView`'s/`ProblemDetailView`'s own identical two-component
 * overview composition. `AssetLifecycleActions` is no longer rendered in
 * `DetailLayout`'s `children` slot; it is therefore visible only on "Visão
 * geral" now, a narrowing from Fase A's "always visible on every tab" — the
 * SAME narrowing `ControlLifecycleSection`'s own Fase B made, for the same
 * reason (a caller browsing "Riscos"/"Controles"/"Incidentes" is reading
 * relationships, not deciding whether to (re)activate the record; the
 * header's own badge already keeps the current situação visible on every
 * tab regardless).
 *
 * `editing` still swaps the WHOLE "Visão geral" tab content for `AssetForm`
 * — `AssetOverview` AND `AssetLifecycleActions` both disappear together
 * while editing, exactly like `ControlOverview`/`ControlLifecycleSection`
 * did in Control's own Fase B (before ITS Fase C moved editing to an
 * overlay). This is a short-lived intermediate shape: Fase C removes the
 * tension entirely by moving `Asset`'s own editing to an overlay panel too,
 * at which point the situação card stays visible while editing, exactly as
 * `ControlContextAside`'s own sibling does today.
 *
 * `isActive` is still never drawn as a track — only a `StatusBadge`, a
 * sentence and one button, per this file's own Fase A "No lifecycle TRACK"
 * section above, unchanged by this phase.
 *
 * ## Fase C — aside ADOPTED, editing moves to an overlay
 *
 * `aside` now composes `AssetContextAside` (`components/detail/`) —
 * "Relacionamentos" (Riscos/Controles with a REAL count, Incidentes with
 * "Ver" — the coordinator's own "assimetria honesta" instruction, see that
 * file's own header comment) and "Última atualização". No "Ações rápidas"
 * heading: `Asset`'s three relationship tabs are read-only by design
 * (FR-008), so there is no create/link verb to shortcut to, and the two
 * things this screen DOES let a caller do ("Editar", change "Situação") are
 * already the header's own button and a card on the tab this screen lands
 * on by default — a shortcut to either would be pure duplication, not a
 * shortcut (`AssetContextAside`'s own header comment). `asideLabel` is the
 * catalog's own accessible name for the resulting `complementary` landmark,
 * present only at `xl`+ (`DetailLayout`'s own contract).
 *
 * `activeSectionId` (for the aside's own `aria-current`) is computed
 * locally with the SAME fallback `EntityTabs` itself already applies
 * internally (`entity-tabs.tsx`'s own `resolvedValue`) — mirrors
 * `ControlDetailView`'s own identical local computation; `Asset` has no
 * `DetailGroup`/`resolveActiveDetailSection` machinery (Fase A's own
 * decision), so there is nothing to keep in sync beyond the one `tabs`
 * array both `EntityTabs` and the aside already share.
 *
 * `Editar` now opens `AssetEditPanel` (`components/detail/`) — an overlay
 * `Sheet` composing `DetailPanel mode="overlay"` around the SAME `AssetForm`
 * (`mode="edit"`, unchanged apart from the new optional `onCancel` this
 * phase added) — instead of swapping "Visão geral"'s own tab content for
 * the form inline, as Fase A/B did. The page behind the panel ("Situação",
 * the aside) stays fully readable throughout; saving closes the panel and
 * updates `asset` through the same shape as before. The header's `Editar`
 * button no longer hides itself while `editing` is true (it used to, when
 * editing meant the button's own tab content disappeared) — mirrors
 * `ControlDetailView`'s/`ProblemDetailView`'s own header actions exactly;
 * the `Sheet`'s own focus trap and D-15's documented focus-return handle
 * giving focus back to `Editar` on close. `AssetEditPanel`'s own header
 * comment records the rendered measurement behind its
 * `showCloseButton={false}` decision.
 */
import {
  DetailLayout,
  EmptyState,
  EntityHeader,
  EntityTabs,
  ErrorState,
  LoadingState,
  StatusBadge,
} from '@pharos/design-system/components';
import { Pencil } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';

import { useDetailSection } from '@/components/detail/use-detail-section';
import { Link } from '@/components/navigation/link';
import { Button } from '@/components/ui/button';
import { assetsApi } from '@/features/assets/api';
import { AssetLifecycleActions } from '@/features/assets/components/asset-lifecycle-actions';
import {
  AssetLinkedControlsSection,
  AssetLinkedIncidentsSection,
  AssetLinkedRisksSection,
} from '@/features/assets/components/asset-linked-entities-section';
import { AssetOverview } from '@/features/assets/components/asset-overview';
import { AssetContextAside } from '@/features/assets/components/detail/asset-context-aside';
import { AssetEditPanel } from '@/features/assets/components/detail/asset-edit-panel';
import { formatTimestampDate } from '@/features/assets/date';
import { assetSituationLabel, assetSituationVariant } from '@/features/assets/situation';
import { ApiError } from '@/lib/api-client';
import { assets } from '@/lib/messages/assets';
import { common } from '@/lib/messages/common';
import { usePermissions } from '@/lib/permissions';

import type { AssetDetail } from '@/features/assets/types';
import type { EntityTab, ErrorStateProblem } from '@pharos/design-system/components';

export interface AssetDetailViewProps {
  assetId: string;
}

export function AssetDetailView({ assetId }: AssetDetailViewProps): React.JSX.Element {
  return (
    <Suspense fallback={<LoadingState variant="block" label={assets.detail.loading} />}>
      <AssetDetailViewContent assetId={assetId} />
    </Suspense>
  );
}

function AssetDetailViewContent({ assetId }: AssetDetailViewProps): React.JSX.Element {
  const { hasPermission } = usePermissions();
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [problem, setProblem] = useState<ErrorStateProblem | undefined>(undefined);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const result = await assetsApi.getAsset(assetId);
        if (!cancelled) {
          setAsset(result);
        }
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.problem.status === 404) {
          setNotFound(true);
        } else if (error instanceof ApiError) {
          setProblem({
            title: error.problem.title,
            detail: error.problem.detail,
            correlationId: error.problem.correlationId,
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  const { sectionParam, setSection } = useDetailSection();

  if (loading) {
    return <LoadingState variant="block" label={assets.detail.loading} />;
  }

  if (notFound) {
    return (
      <EmptyState
        variant="empty"
        title={assets.detail.notFoundTitle}
        description={assets.detail.notFoundDescription}
      />
    );
  }

  if (!asset) {
    return <ErrorState problem={problem} />;
  }

  const canEdit = hasPermission('asset:edit');
  const canAdminister = hasPermission('asset:administer');

  const tabs: EntityTab[] = [
    {
      id: 'overview',
      label: assets.detail.sections.overview,
      content: (
        <div className="flex flex-col gap-6">
          <AssetOverview asset={asset} />
          <AssetLifecycleActions
            asset={asset}
            canAdminister={canAdminister}
            onChanged={(updated) => setAsset(updated)}
          />
        </div>
      ),
    },
    {
      id: 'risks',
      label: assets.detail.sections.risks,
      content: <AssetLinkedRisksSection risks={asset.risks} />,
    },
    {
      id: 'controls',
      label: assets.detail.sections.controls,
      content: <AssetLinkedControlsSection controls={asset.controls} />,
    },
    {
      id: 'incidents',
      label: assets.detail.sections.incidents,
      content: <AssetLinkedIncidentsSection assetId={asset.id} />,
    },
  ];

  // Mirrors `EntityTabs`'s own `resolvedValue` fallback exactly
  // (`entity-tabs.tsx`) — a stale/absent `sectionParam` resolves to the
  // first tab, never to nothing. Kept local, not a second navigation model:
  // see this file's own Fase C header comment.
  const activeSectionId = tabs.some((tab) => tab.id === sectionParam) ? sectionParam! : tabs[0]!.id;

  return (
    <>
      <DetailLayout
        header={
          <EntityHeader
            breadcrumb={
              <>
                <Link href="/assets" className="hover:underline">
                  {assets.detail.breadcrumbLabel}
                </Link>
                <span aria-hidden="true"> › </span>
                <span>{asset.code}</span>
              </>
            }
            code={asset.code}
            title={asset.name}
            badges={
              <StatusBadge
                variant={assetSituationVariant(asset.isActive)}
                label={assetSituationLabel(asset.isActive)}
              />
            }
            metadata={
              <>
                <span>
                  {asset.orgUnit
                    ? assets.detail.metadata.orgUnit(asset.orgUnit.name)
                    : assets.detail.metadata.noOrgUnit}
                </span>
                <span>
                  {assets.detail.metadata.createdAt(formatTimestampDate(asset.createdAt))}
                </span>
                <span>
                  {assets.detail.metadata.updatedAt(formatTimestampDate(asset.updatedAt))}
                </span>
              </>
            }
            actions={
              canEdit ? (
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil aria-hidden="true" className="size-4" />
                  {assets.detail.editAction}
                </Button>
              ) : null
            }
          />
        }
        navigation={
          <EntityTabs
            ariaLabel={common.entityTabs.sectionsAriaLabel}
            scrollLabels={{
              scrollBack: common.entityTabs.scrollBack,
              scrollForward: common.entityTabs.scrollForward,
            }}
            value={sectionParam ?? ''}
            onValueChange={setSection}
            tabs={tabs}
            size="compact"
          />
        }
        aside={<AssetContextAside asset={asset} activeSectionId={activeSectionId} />}
        asideLabel={assets.detail.asideLabel}
      />

      {editing ? (
        <AssetEditPanel
          asset={asset}
          onOpenChange={(open) => {
            if (!open) setEditing(false);
          }}
          onSaved={(updated) => {
            setAsset(updated);
            setEditing(false);
          }}
        />
      ) : null}
    </>
  );
}
