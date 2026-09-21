'use client';

/**
 * PharosGRC — control detail screen (021-control-detail-experience, Fase A
 * shell — supersedes the flat `EntityHeader` + loose lifecycle-action `Card`
 * + one-level `EntityTabs` strip this screen used before, itself built by
 * 003-controls-management mirroring `RiskDetailView`'s pre-016 shape).
 *
 * ## What changed, and what did not (Fase A)
 *
 * The page composes `DetailLayout` (`@pharos/design-system/components`) —
 * the same shell `RiskDetailView`/`IncidentDetailView`/`ProblemDetailView`/
 * `ActionDetailView` already established — with a breadcrumb + code/badges/
 * title/metadata header and the record's four sections in the main column.
 * Every section's underlying component, endpoint, permission and behaviour
 * is UNCHANGED — this rodada reorganizes presentation only, never business
 * logic, authorization or lifecycle semantics (CLAUDE.md §18.9).
 * `ControlLifecycleActions` keeps its own `Card` casing and full behaviour
 * for now — Fase B strips that casing and gives it a proper "Ciclo de vida"
 * card with a lifecycle track, mirroring Problem's/Action's own split
 * (`ControlLifecycleSection`, not built yet). For Fase A it moves from
 * "above the tabs, always visible" to `DetailLayout`'s `children` slot
 * (rendered after `navigation`, still full width, still visible regardless
 * of which tab is active) — a position change only, not a behaviour change:
 * `DetailLayout` has no "before navigation" slot other than `summary`
 * (rejected below) or `asideLead` (there is no aside yet in Fase A), so
 * `children` is the only slot that preserves "always visible on every tab"
 * without inventing one.
 *
 * ## Deliberately NOT two-level navigation (the coordinator's own
 * instruction for this rodada, measured before it started)
 *
 * Risk/Incident/Problem each nest two `EntityTabs` because each has 7-14
 * sections and a flat strip overflowed. `Control` has exactly four —
 * "Visão geral", "Verificações", "Vínculos", "Evidências" (the last gated
 * by `evidence:view`) — and any grouping of four would be arbitrary (a
 * group of one, or two groups of two with no shared theme). The measured
 * problem two-level navigation solves — a flat strip overflowing at narrow
 * widths — is instead solved the same way `size="compact"` already solves
 * it for Problem's own leaf strips: `navigation` below is a SINGLE flat
 * `EntityTabs` with `size="compact"`, which wraps each tab as a whole unit
 * onto a second line below `sm` instead of clipping. Measured after this
 * change: the tab strip's own `scrollWidth - clientWidth` is `0` at 390px
 * (was 85px before `compact`), with no page-level horizontal scroll
 * introduced.
 *
 * ## `?section=` deep link — ADOPTED (unlike `Action`'s own decision not to)
 *
 * `Action` has exactly two sections, one rarely consulted, and declined the
 * mechanism as not worth its own `Suspense` boundary. `Control` has four,
 * one of them permission-gated (`Evidências`) and none of them clearly the
 * "only one anybody deep-links to" — a caller sharing a link to a specific
 * control's "Verificações" or "Vínculos" is a realistic scenario this
 * screen's own domain (a control's test history, or what it protects) makes
 * more likely than Action's. The cost this time is small: `Control` has no
 * two-level group model to build, so this reuses the shared `useDetailSection`
 * hook (`@/components/detail/use-detail-section`) directly against a SINGLE
 * flat `EntityTabs`, without the `DetailGroup`/`resolveActiveDetailSection`
 * machinery Problem/Incident/Risk need for their two levels — `EntityTabs`
 * itself already resolves a `value` naming an absent/invisible tab (a stale
 * deep link, or `evidence:view` coming off) to the first visible tab
 * (`entity-tabs.tsx`'s own contract), so passing `sectionParam ?? ''`
 * straight through is enough; no local resolution function is needed. This
 * is why `ControlDetailView` below still needs its own `Suspense` boundary
 * (`useDetailSection` reads `useSearchParams()`), mirroring Problem's/
 * Incident's own split into a thin wrapper plus a `*Content` component.
 *
 * ## `summary` stays omitted
 *
 * No honest KPI of its own: status and effectiveness both already render as
 * header badges, and neither is a "count" the way Risk's own KPI row is. A
 * `SummaryStatCard` strip built only for visual symmetry with the other
 * modules was already rejected once for `Action`; the same reasoning holds
 * here.
 *
 * ## `aside` — decision deferred to Fase C, not a Fase A gap
 *
 * Unlike `Action` (which has no relationships at all and settled on no
 * aside, permanently), `Control` DOES have real relationships — three
 * link types under "Vínculos" (Riscos/Processos/Ativos) plus an
 * `evidence:view`-gated "Evidências" section — so an "Ações rápidas" +
 * "Relacionamentos" contextual aside, mirroring `ProblemContextAside`,
 * plausibly earns its place here. Fase A does not build it: the coordinator
 * scoped aside content to Fase C, after Fase B has settled what "Visão
 * geral" actually looks like (so the aside is built against the final
 * overview shape, not a shape about to change again). Leaving `aside`/
 * `asideLabel` unset in Fase A is intentional and costs nothing structural
 * — `DetailLayout`'s own `hasAsideColumn` guard means the two-column grid
 * simply does not apply yet, exactly as it does not for `Action` today.
 *
 * ## Leitura × edição — unchanged in Fase A (still the inline swap)
 *
 * `editing` still swaps "Visão geral"'s own tab content for `ControlForm`
 * inline, exactly as before this rodada. Fase C is where this moves to an
 * overlay `Sheet` (`ControlEditPanel`, mirroring `ProblemEditPanel`/
 * `ActionEditPanel`) — doing it in Fase A would mix a structural shell
 * change with a genuine interaction-pattern change in the same low-risk
 * pass, which is exactly the kind of unrelated-changes-at-once CLAUDE.md
 * §14 asks this project not to do.
 *
 * ## Fase B — "Visão geral" in cards, "Ciclo de vida" with a track
 *
 * The read-only path of "Visão geral" now composes `ControlOverview` (three
 * cards: Descrição, Efetividade, Detalhes do controle — see that
 * component's own header comment for why Efetividade earns its own card)
 * and `ControlLifecycleSection` (`components/detail/`, a fourth "Ciclo de
 * vida" card: the lifecycle track visual, the transition button row, and
 * the conditional outcome facts moved out of the old flat `<dl>`) —
 * mirroring `ProblemDetailView`'s/`ActionDetailView`'s own identical
 * two-component composition. `ControlLifecycleActions` (the transition
 * buttons) is no longer rendered directly by this file, nor does it sit in
 * `DetailLayout`'s `children` slot as it did in Fase A; `ControlLifecycle
 * Section` owns it now, and it is therefore visible only on "Visão geral",
 * exactly like every sibling module's own lifecycle card — never on
 * "Verificações"/"Vínculos"/"Evidências", which is a narrowing from Fase A's
 * "always visible on every tab", but the one every other module in this
 * queue already made at this same phase.
 *
 * `GET /controls/{controlId}/lifecycle` moved from `ControlLifecycleActions`
 * (which fetched it internally before this phase) to `useControlLifecycle`
 * (`components/detail/`), called here UNCONDITIONALLY before the loading/
 * not-found/error early returns — mirrors `useRiskLifecycle`'s own identical
 * placement in `RiskDetailView`. Still exactly two requests on mount: `GET
 * /controls/{controlId}` and `GET .../lifecycle`, neither gated behind which
 * tab happens to be open.
 *
 * `retiredAt` no longer appears in the HEADER's own metadata row either
 * (Fase A carried it over unchanged from before this rodada). It now lives
 * exclusively in `ControlLifecycleSection`'s own outcome facts, alongside
 * `retiredBy`/`retirementReason` — mirroring `ProblemDetailView`'s/
 * `ActionDetailView`'s own header metadata, neither of which repeats an
 * outcome date next to the record's identity. A single source for the same
 * fact, not two.
 *
 * ## Fase C — aside ADOPTED, editing moves to an overlay
 *
 * `aside` now composes `ControlContextAside` (`components/detail/`) —
 * "Ações rápidas", "Relacionamentos" (one row: "Vínculos" — Riscos/
 * Processos/Ativos are three subsections of that SAME section, not three
 * independently deep-linkable ones, unlike Problem's own Riscos/
 * Incidentes) and "Última atualização". Adopted, unlike `Action`'s
 * permanent no-aside: `Control` has real relationships and a permission-
 * gated Evidência section to summarize, the exact class of content
 * `ProblemContextAside`/`IncidentContextAside` already justify an aside
 * for. `asideLabel` is the catalog's own accessible name for the resulting
 * `complementary` landmark, present only at `xl`+ (`DetailLayout`'s own
 * contract) — confirmed by rendered measurement: exactly 1 at 1440, 0 at
 * 1024/390.
 *
 * `activeSectionId` (for the aside's own `aria-current`) is computed
 * locally with the SAME fallback `EntityTabs` itself already applies
 * internally (`entity-tabs.tsx`'s own `resolvedValue`) — a stale/absent
 * `sectionParam` resolves to the first VISIBLE tab, never to nothing. This
 * is a plain read of the same `tabs` array below, not a second navigation
 * model: `Control` has no `DetailGroup`/`resolveActiveDetailSection`
 * machinery (Fase A's own decision), so there is nothing to keep in sync
 * beyond this one array both `EntityTabs` and the aside already share.
 *
 * `Editar` now opens `ControlEditPanel` (`components/detail/`) — an
 * overlay `Sheet` composing `DetailPanel mode="overlay"` around the SAME
 * `ControlForm` (`mode="edit"`, unchanged) — instead of swapping "Visão
 * geral"'s own tab content for the form inline, as Fase A/B did. The page
 * behind the panel (Ciclo de vida, the aside) stays fully readable
 * throughout; saving closes the panel and updates `control`/`etag` through
 * the same shape as before. The header's `Editar` button no longer hides
 * itself while `editing` is true (it used to, when editing meant the
 * button's own tab content disappeared) — mirrors `ProblemDetailView`'s/
 * `ActionDetailView`'s own header actions exactly; the `Sheet`'s own focus
 * trap and D-15's documented focus-return handle giving focus back to
 * `Editar` on close.
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
import { controlsApi } from '@/features/controls/api';
import { ControlAssessmentForm } from '@/features/controls/components/control-assessment-form';
import { ControlAssessmentHistory } from '@/features/controls/components/control-assessment-history';
import { ControlLinksSection } from '@/features/controls/components/control-links-section';
import { ControlOverview } from '@/features/controls/components/control-overview';
import { ControlContextAside } from '@/features/controls/components/detail/control-context-aside';
import { ControlEditPanel } from '@/features/controls/components/detail/control-edit-panel';
import { ControlLifecycleSection } from '@/features/controls/components/detail/control-lifecycle-section';
import { useControlLifecycle } from '@/features/controls/components/detail/use-control-lifecycle';
import {
  controlEffectivenessBadgeVariant,
  controlEffectivenessIcon,
  controlEffectivenessLabel,
  controlStatusBadgeVariant,
  controlStatusIcon,
  controlStatusLabel,
} from '@/features/controls/status';
import { EvidencePanel } from '@/features/evidence/components/evidence-panel';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { common } from '@/lib/messages/common';
import { controls } from '@/lib/messages/controls';
import { usePermissions } from '@/lib/permissions';

import type { ControlDetail } from '@/features/controls/types';
import type { EntityTab, ErrorStateProblem } from '@pharos/design-system/components';

export interface ControlDetailViewProps {
  controlId: string;
}

export function ControlDetailView({ controlId }: ControlDetailViewProps): React.JSX.Element {
  return (
    <Suspense fallback={<LoadingState variant="block" label={controls.detail.loading} />}>
      <ControlDetailViewContent controlId={controlId} />
    </Suspense>
  );
}

function ControlDetailViewContent({ controlId }: ControlDetailViewProps): React.JSX.Element {
  const { hasPermission } = usePermissions();
  const { user } = useAuth();
  const [control, setControl] = useState<ControlDetail | null>(null);
  const [etag, setEtag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [problem, setProblem] = useState<ErrorStateProblem | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [assessmentRefreshToken, setAssessmentRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const result = await controlsApi.getControl(controlId);
        if (!cancelled) {
          setControl(result.control);
          setEtag(result.etag);
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
  }, [controlId]);

  // The second (and last) request this page fires on mount, called
  // unconditionally before any early return below (rules of hooks): `etag`
  // is `null` until `GET /controls/{controlId}` above resolves, and the
  // hook itself does not fetch until it is a real string — see this file's
  // own Fase B header comment and `useControlLifecycle`'s own doc comment.
  const {
    lifecycle,
    loading: lifecycleLoading,
    loadError: lifecycleLoadError,
    reload: reloadLifecycle,
  } = useControlLifecycle(controlId, etag);

  const { sectionParam, setSection } = useDetailSection();

  if (loading) {
    return <LoadingState variant="block" label={controls.detail.loading} />;
  }

  if (notFound) {
    return (
      <EmptyState
        variant="empty"
        title={controls.detail.notFoundTitle}
        description={controls.detail.notFoundDescription}
      />
    );
  }

  if (!control || !etag) {
    return <ErrorState problem={problem} />;
  }

  const canEdit = hasPermission('control:edit');
  const canTest = hasPermission('control:test');
  const canApprove = hasPermission('control:approve');
  const canViewEvidence = hasPermission('evidence:view');
  const canCreateEvidence = hasPermission('evidence:create');
  const canLinkEvidence = hasPermission('evidence:link');
  const canAdministerEvidence = hasPermission('evidence:administer');
  const canUploadAttachment = hasPermission('attachment:create');
  const canWithdrawAttachment = hasPermission('attachment:delete');
  // A control minted before this phase may carry no organizational unit at
  // all (FR-003, US1 AS5); a `RETIRED` control accepts no new process/asset
  // links (FR-006) — shared by `ControlLinksSection` and the aside's own
  // "Vincular processo ou ativo" quick action, so the two can never disagree
  // about whether linking is currently offered.
  const canLinkRelationships = canEdit && control.status !== 'RETIRED';

  async function reloadControl(): Promise<void> {
    try {
      const result = await controlsApi.getControl(controlId);
      setControl(result.control);
      setEtag(result.etag);
    } catch {
      // Best-effort, mirroring `RiskDetailView.reloadRisk` — deliberately silent.
    }
  }

  /**
   * The lifecycle card's own `onChanged` — a transition can change BOTH the
   * control (its `status`, `effectiveness`, `retiredAt`/`retiredBy`/
   * `retirementReason`) and the lifecycle preview (`availableTransitions`),
   * so both are re-read immediately — mirrors `RiskDetailView.handle
   * LifecycleChanged`'s own identical reasoning.
   */
  function handleLifecycleChanged(): void {
    void reloadControl();
    void reloadLifecycle();
  }

  const tabs: EntityTab[] = [
    {
      id: 'overview',
      label: controls.detail.sections.overview,
      content: (
        <div className="flex flex-col gap-6">
          <ControlOverview control={control} />
          <ControlLifecycleSection
            control={control}
            etag={etag}
            lifecycle={lifecycle}
            loading={lifecycleLoading}
            loadError={lifecycleLoadError}
            onChanged={handleLifecycleChanged}
          />
        </div>
      ),
    },
    {
      id: 'assessments',
      label: controls.detail.sections.assessments,
      content: (
        <div className="flex flex-col gap-6">
          {canTest ? (
            <ControlAssessmentForm
              controlId={control.id}
              controlIsActive={control.status === 'ACTIVE'}
              onAssessed={() => {
                void reloadControl();
                setAssessmentRefreshToken((token) => token + 1);
              }}
            />
          ) : null}
          <ControlAssessmentHistory
            controlId={control.id}
            controlOwnerId={control.owner?.id ?? null}
            currentUserId={user.id}
            canTest={canTest}
            canApprove={canApprove}
            refreshToken={assessmentRefreshToken}
          />
        </div>
      ),
    },
    {
      id: 'relationships',
      label: controls.detail.sections.relationships,
      content: (
        <ControlLinksSection controlId={control.id} canLinkRelationships={canLinkRelationships} />
      ),
    },
    {
      id: 'evidence',
      label: controls.detail.sections.evidence,
      content: (
        <EvidencePanel
          subjectType="CONTROL"
          subjectId={control.id}
          // A control minted before this phase may carry no
          // organizational unit at all (FR-003, US1 AS5) — falls back
          // to an empty id rather than crashing; the rare attempt to
          // attach evidence in that state fails with an ordinary
          // server validation error instead.
          orgUnitId={control.orgUnit?.id ?? ''}
          defaultOwnerUserId={user.id}
          canCreate={canCreateEvidence}
          canLink={canLinkEvidence}
          canAdminister={canAdministerEvidence}
          canUploadAttachment={canUploadAttachment}
          canWithdrawAttachment={canWithdrawAttachment}
        />
      ),
      visible: canViewEvidence,
    },
  ];

  // Mirrors `EntityTabs`'s own `resolvedValue` fallback exactly
  // (`entity-tabs.tsx`) — a stale/absent `sectionParam` (or one naming a
  // tab currently hidden by permission) resolves to the first VISIBLE tab,
  // never to nothing. Kept local, not a second navigation model: see this
  // file's own Fase C header comment.
  const visibleTabs = tabs.filter((tab) => tab.visible !== false);
  const activeSectionId = visibleTabs.some((tab) => tab.id === sectionParam)
    ? sectionParam!
    : visibleTabs[0]!.id;

  return (
    <>
      <DetailLayout
        header={
          <EntityHeader
            breadcrumb={
              <>
                <Link href="/controls" className="hover:underline">
                  {controls.detail.breadcrumbLabel}
                </Link>
                <span aria-hidden="true"> › </span>
                <span>{control.code}</span>
              </>
            }
            code={control.code}
            title={control.name}
            badges={
              <>
                <StatusBadge
                  variant={controlStatusBadgeVariant(control.status)}
                  label={controlStatusLabel(control.status)}
                  icon={controlStatusIcon(control.status)}
                />
                <StatusBadge
                  variant={controlEffectivenessBadgeVariant(control.effectiveness)}
                  label={controlEffectivenessLabel(control.effectiveness)}
                  icon={controlEffectivenessIcon(control.effectiveness)}
                />
              </>
            }
            metadata={
              <>
                <span>
                  {control.owner
                    ? controls.detail.metadata.owner(control.owner.fullName)
                    : controls.detail.metadata.noOwner}
                </span>
                <span>
                  {control.orgUnit
                    ? controls.detail.metadata.orgUnit(control.orgUnit.name)
                    : controls.detail.metadata.noOrgUnit}
                </span>
                <span>
                  {controls.detail.metadata.createdAt(
                    new Date(control.createdAt).toLocaleDateString('pt-BR'),
                  )}
                </span>
              </>
            }
            actions={
              canEdit ? (
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil aria-hidden="true" className="size-4" />
                  {controls.detail.editAction}
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
        aside={
          <ControlContextAside
            control={control}
            activeSectionId={activeSectionId}
            canTest={canTest}
            canLinkRelationships={canLinkRelationships}
            canCreateEvidence={canCreateEvidence}
            canViewEvidence={canViewEvidence}
          />
        }
        asideLabel={controls.detail.asideLabel}
      />

      {editing ? (
        <ControlEditPanel
          control={control}
          etag={etag}
          onOpenChange={(open) => {
            if (!open) setEditing(false);
          }}
          onSaved={(result) => {
            setControl(result.control);
            setEtag(result.etag);
            setEditing(false);
          }}
        />
      ) : null}
    </>
  );
}
