'use client';

/**
 * PharosGRC — risk detail screen (016-risk-detail-experience; supersedes the
 * flat 14-tab layout T096 originally built, FR-093, FR-094, FR-030).
 *
 * ## What changed, and what did not
 *
 * The page used to be `EntityHeader` + a loose `RiskLifecycleActions` card +
 * one flat `EntityTabs` strip of fourteen tabs (already cut off at 1440px,
 * mostly off-screen at 390px). It is now `DetailLayout`'s two-column shell:
 * a breadcrumb + code/badges/title/metadata header, a five-card executive
 * summary row, a two-level navigation (five groups, fifteen leaf sections)
 * in the main column, and a contextual aside (Atenção / Ações rápidas /
 * Relacionamentos / Última atualização) that stays sticky beside it.
 *
 * Every section's underlying component, endpoint, permission and behaviour
 * is UNCHANGED — this phase reorganizes presentation, never business logic,
 * authorization, the lifecycle state machine or approval semantics
 * (CLAUDE.md §18.9). Section visibility still follows the exact table
 * `data-model.md` §3 documents ("Risk detail section visibility"): every
 * section but Audit/Evidence/Findings is visible to anyone who can see the
 * risk at all; Audit needs `audit:view`, Evidence needs `evidence:view`,
 * Findings needs `finding:view`. `EntityTabs` omits an unauthorized section
 * entirely at BOTH navigation levels rather than rendering it disabled, so
 * its existence is never disclosed (FR-030) — the advisory client-side
 * mirror of the server's own independent enforcement (ADR-003).
 *
 * ## Exactly two requests on mount (§4.9)
 *
 * `GET /risks/{riskId}` (below) and `GET /risks/{riskId}/lifecycle`
 * (`useRiskLifecycle`, `components/detail/`) — the same two requests this
 * page has always fired, in the same place: at the PAGE level, never inside
 * a section's own mount. The contextual aside's "Atenção" block and the
 * "Ciclo de vida" section both need the lifecycle state, and the aside is
 * visible before any section is ever opened — moving the fetch into, say,
 * the "Visão geral" section would make pendencies vanish from the aside
 * until that section happened to be opened, a silent behavioural
 * regression a coordinator correction on 2026-09-15 caught before this
 * became one. No other section adds a request of its own on mount; every
 * count in the summary row and the aside comes from data already on
 * `RiskDetail`, and every "no number" relationship link only counts once
 * its own section is opened (R-8/R-9, F-59/F-61).
 *
 * ## Deep link (`?section=<id>`, §4.4)
 *
 * The fifteen leaf ids are the technical identifiers this screen has always
 * used (`overview`, `assessment`, `controls`, …) plus one new one,
 * `processes-assets`, for the relationship family that used to render
 * silently inside "Controles" (R-6) and now has its own leaf under
 * "Relacionamentos". An unknown or no-longer-visible id (a stale link, or a
 * permission that came off) resolves silently to the first visible section
 * — `resolveActiveDetailSection` (`@/components/detail/detail-navigation`,
 * promoted from this screen's own `risk-navigation.ts` in
 * 018-incident-detail-experience) — never an error.
 *
 * ## Leitura × edição (§4.8)
 *
 * `Editar` no longer swaps a tab's content into `RiskForm` — it opens
 * `RiskEditPanel`, an overlay `Sheet` composing `DetailPanel mode="overlay"`
 * around the SAME `RiskForm` (`mode="edit"`, untouched). The page behind it
 * stays in read-only mode the whole time; saving closes the panel and
 * updates `risk`/`etag` through the same `onSaved` shape as before.
 *
 * ## `Suspense` (new — `useDetailSection` reads `useSearchParams()`)
 *
 * `page.tsx` (out of this rodada's territory) renders `RiskDetailView`
 * directly, with no `Suspense` of its own — unlike `(app)/risks/page.tsx`,
 * which already wraps its own `useSearchParams()` consumer this same way.
 * `RiskDetailView` therefore supplies the boundary itself: the exported
 * component is a thin wrapper, and every hook — including the
 * search-params-reading `useDetailSection`
 * (`@/components/detail/use-detail-section`, promoted from this screen's
 * own `use-risk-detail-section.ts` in 018-incident-detail-experience) —
 * lives in `RiskDetailViewContent` underneath it. `page.tsx` keeps working
 * completely unchanged; the boundary just moved one component down.
 */
import {
  DetailLayout,
  EmptyState,
  EntityHeader,
  EntityTabs,
  ErrorState,
  LoadingState,
  RiskLevelBadge,
  StatusBadge,
} from '@pharos/design-system/components';
import { ClipboardCheck, Eye, History, Link2, Pencil, Wrench } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';

import type { DetailGroup } from '@/components/detail/detail-navigation';
import type { RiskDetail } from '@/features/risks/types';
import type { EntityTab, ErrorStateProblem } from '@pharos/design-system/components';
import type { ComponentType, SVGProps } from 'react';

import {
  firstVisibleSectionOf,
  resolveActiveDetailSection,
  visibleSections,
} from '@/components/detail/detail-navigation';
import { useDetailSection } from '@/components/detail/use-detail-section';
import { Link } from '@/components/navigation/link';
import { Button } from '@/components/ui/button';
import { EvidencePanel } from '@/features/evidence/components/evidence-panel';
import { FindingsPanel } from '@/features/findings/components/findings-panel';
import { risksApi } from '@/features/risks/api';
import {
  RiskAttentionAside,
  RiskRelationshipsAside,
} from '@/features/risks/components/detail/risk-context-aside';
import { RiskDetailArtwork } from '@/features/risks/components/detail/risk-detail-artwork';
import visual from '@/features/risks/components/detail/risk-detail-visual.module.css';
import { RiskEditPanel } from '@/features/risks/components/detail/risk-edit-panel';
import { RiskLifecycleSection } from '@/features/risks/components/detail/risk-lifecycle-section';
import { RiskSummaryRow } from '@/features/risks/components/detail/risk-summary-row';
import { useRiskLifecycle } from '@/features/risks/components/detail/use-risk-lifecycle';
import { PendingApprovalBadge } from '@/features/risks/components/pending-approval-badge';
import { RiskAssessmentSection } from '@/features/risks/components/risk-assessment-section';
import { RiskAttachmentsSection } from '@/features/risks/components/risk-attachments-section';
import { RiskAuditSection } from '@/features/risks/components/risk-audit-section';
import { RiskCausesConsequences } from '@/features/risks/components/risk-causes-consequences';
import { RiskCommentsSection } from '@/features/risks/components/risk-comments-section';
import { RiskControlsSection } from '@/features/risks/components/risk-controls-section';
import { RiskHistorySection } from '@/features/risks/components/risk-history-section';
import {
  RiskIncidentLinksSection,
  RiskProblemLinksSection,
} from '@/features/risks/components/risk-incident-problem-links-section';
import { RiskOverview } from '@/features/risks/components/risk-overview';
import { RiskTreatmentSection } from '@/features/risks/components/risk-treatment-section';
import { TreatmentActionsTable } from '@/features/risks/components/treatment-actions-table';
import { formatDateOnly } from '@/features/risks/date';
import { riskStatusBadgeVariant, riskStatusLabel } from '@/features/risks/status';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { common } from '@/lib/messages/common';
import { risks } from '@/lib/messages/risks';
import { usePermissions } from '@/lib/permissions';

export interface RiskDetailViewProps {
  riskId: string;
}

/**
 * Level-1 group icons only (017-risk-overview-polish) — `EntityTabs` itself
 * ignores `icon` on a `subordinate` strip, so the level-2 leaf tabs built
 * from `group.sections` below never need an entry here.
 *
 * Reused, not invented: `ClipboardCheck`/`Wrench`/`Link2` are the exact
 * icons `RiskAttentionAside`'s own quick actions already use for "Registrar
 * avaliação" (Análise), "Registrar decisão de tratamento" (Resposta, also
 * `RiskSummaryRow`'s "Tratamento" card) and "Vincular controle"
 * (Relacionamentos) — the same concepts, one level up. `Eye` (Visão geral)
 * and `History` (Registro — histórico, auditoria, anexos, comentários) are
 * new to this screen: no icon was already established for either concept
 * here (`risk-history-section.tsx`/`risk-audit-section.tsx` carry none),
 * and both are chosen to avoid every icon already tied to a DIFFERENT
 * concept on this same page — `FileText` (Descrição/evidência), `Gauge`/
 * `ShieldCheck` (nível inerente/residual cards), `ListChecks` (Planos de
 * ação) and `MessageSquare` (Comentar).
 */
const GROUP_ICONS: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  overview: Eye,
  analysis: ClipboardCheck,
  response: Wrench,
  relationships: Link2,
  register: History,
};

export function RiskDetailView({ riskId }: RiskDetailViewProps): React.JSX.Element {
  return (
    <Suspense fallback={<LoadingState variant="block" label={risks.detail.loading} />}>
      <RiskDetailViewContent riskId={riskId} />
    </Suspense>
  );
}

function RiskDetailViewContent({ riskId }: RiskDetailViewProps): React.JSX.Element {
  const { hasPermission } = usePermissions();
  const { user } = useAuth();
  const [risk, setRisk] = useState<RiskDetail | null>(null);
  const [etag, setEtag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [problem, setProblem] = useState<ErrorStateProblem | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  // Bumped after a new assessment is recorded so `AssessmentHistory`
  // re-fetches from page 1 (its own effect depends on this, not on `risk`,
  // since `risk` itself is not guaranteed to change identity in a way that
  // would otherwise re-trigger it).
  const [assessmentRefreshToken, setAssessmentRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const result = await risksApi.getRisk(riskId);
        if (!cancelled) {
          setRisk(result.risk);
          setEtag(result.etag);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
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
  }, [riskId]);

  // The second (and last) request this page fires on mount — see this
  // file's own header comment on §4.9. Called unconditionally, before any
  // early return below (rules of hooks): `etag` is `null` until `GET
  // /risks/{riskId}` above resolves, and the hook itself does not fetch
  // until it is a real string (see its own doc comment).
  const {
    lifecycle,
    loading: lifecycleLoading,
    loadError: lifecycleLoadError,
    reload: reloadLifecycle,
  } = useRiskLifecycle(riskId, etag);

  const { sectionParam, setSection } = useDetailSection();

  if (loading) {
    return <LoadingState variant="block" label={risks.detail.loading} />;
  }

  if (notFound) {
    return (
      <EmptyState
        variant="empty"
        title={risks.detail.notFoundTitle}
        description={risks.detail.notFoundDescription}
      />
    );
  }

  if (!risk || !etag) {
    return <ErrorState problem={problem} />;
  }

  const canEdit = hasPermission('risk:edit');
  const canAssess = hasPermission('risk:assess');
  const canTreat = hasPermission('risk:treat');
  const canApprove = hasPermission('risk:approve');
  const canViewAudit = hasPermission('audit:view');
  const canComment = hasPermission('comment:create');
  const canWithdrawComment = hasPermission('comment:delete');
  const canUploadAttachment = hasPermission('attachment:create');
  const canWithdrawAttachment = hasPermission('attachment:delete');
  const canViewEvidence = hasPermission('evidence:view');
  const canCreateEvidence = hasPermission('evidence:create');
  const canLinkEvidence = hasPermission('evidence:link');
  const canAdministerEvidence = hasPermission('evidence:administer');
  const canViewFindings = hasPermission('finding:view');
  const canCreateFindings = hasPermission('finding:create');
  const canEditFindings = hasPermission('finding:edit');
  const canCloseFindings = hasPermission('finding:close');
  const canAdministerFindings = hasPermission('finding:administer');
  const canRemediateFindings = hasPermission('finding:remediate');
  const canLinkFindings = hasPermission('finding:link');

  /**
   * `POST .../assessments`'s response carries only the new assessment, not
   * the risk's updated denormalized levels/`lastAssessedOn` (see
   * `AssessmentForm`'s own doc comment) — so recording one re-reads the
   * whole risk rather than this view guessing at the new derived state.
   * Best-effort: a transient failure here leaves the previously loaded risk
   * on screen; the assessment itself already succeeded and its own success
   * feedback was already shown by `AssessmentForm`.
   */
  async function reloadRisk(): Promise<void> {
    try {
      const result = await risksApi.getRisk(riskId);
      setRisk(result.risk);
      setEtag(result.etag);
    } catch {
      // See doc comment above — deliberately silent.
    }
  }

  /**
   * The lifecycle actions bar's own `onChanged` — a transition/approval can
   * change BOTH the risk (its `status`, `pendingApproval`) and the
   * lifecycle preview (`availableTransitions`), so both are re-read
   * immediately, exactly like `RiskLifecycleActions` used to do internally
   * before this fetch moved to the page (`reloadLifecycle` alongside
   * `onChanged`, in its old `handleChanged`). Every OTHER section's
   * `onChanged` below still calls only `reloadRisk` — the lifecycle hook's
   * own effect already re-fetches whenever `etag` changes for any reason,
   * exactly as it always has.
   */
  function handleLifecycleChanged(): void {
    void reloadRisk();
    void reloadLifecycle();
  }

  const groups: readonly DetailGroup[] = [
    {
      id: 'overview',
      label: risks.detail.groups.overview,
      sections: [
        {
          id: 'overview',
          label: risks.detail.groups.overview,
          content: (
            <div className="flex flex-col gap-6">
              <RiskOverview risk={risk} />
              <RiskLifecycleSection
                riskId={risk.id}
                etag={etag}
                currentUserId={user.id}
                canApprove={canApprove}
                lifecycle={lifecycle}
                loading={lifecycleLoading}
                loadError={lifecycleLoadError}
                onChanged={handleLifecycleChanged}
              />
            </div>
          ),
        },
      ],
    },
    {
      id: 'analysis',
      label: risks.detail.groups.analysis,
      sections: [
        {
          id: 'assessment',
          label: risks.detail.sections.assessment,
          content: (
            <RiskAssessmentSection
              risk={risk}
              etag={etag}
              canAssess={canAssess}
              onAssessed={() => {
                void reloadRisk();
                setAssessmentRefreshToken((token) => token + 1);
              }}
              onReviewSaved={(result) => {
                setRisk(result.risk);
                setEtag(result.etag);
              }}
              assessmentHistoryRefreshToken={assessmentRefreshToken}
              onViewCausesConsequences={() => setSection('causes-consequences')}
            />
          ),
        },
        {
          id: 'causes-consequences',
          label: risks.detail.sections.causesConsequences,
          content: (
            <RiskCausesConsequences
              riskId={risk.id}
              initialCauses={risk.causes}
              initialConsequences={risk.consequences}
              etag={etag}
              onSaved={(result) => {
                setEtag(result.etag);
                // The risk itself must move with the server, not just the
                // ETag — see the original doc comment this preserves.
                setRisk((current) =>
                  current === null
                    ? current
                    : result.kind === 'cause'
                      ? { ...current, causes: result.items }
                      : { ...current, consequences: result.items },
                );
              }}
            />
          ),
        },
      ],
    },
    {
      id: 'response',
      label: risks.detail.groups.response,
      sections: [
        {
          id: 'treatment',
          label: risks.detail.sections.treatment,
          content: (
            <div className="flex flex-col gap-6">
              <RiskTreatmentSection
                risk={risk}
                etag={etag}
                canTreat={canTreat}
                onTreated={() => void reloadRisk()}
              />
              {/* The action table that used to live here moved to "Planos
               * de Ação" (`treatment-actions-table.tsx`'s own header
               * explains why) — this pointer keeps a caller who remembers
               * it here from reading its absence as data loss. */}
              <p className="text-sm text-muted-foreground">{risks.treatment.actionsMovedNotice}</p>
            </div>
          ),
        },
        {
          id: 'controls',
          label: risks.detail.sections.controls,
          content: (
            <RiskControlsSection
              risk={risk}
              etag={etag}
              canTreatControls={canTreat}
              canEditRelationships={canEdit}
              families={['controls']}
              onChanged={() => void reloadRisk()}
            />
          ),
        },
        {
          id: 'action-plans',
          label: risks.detail.sections.actionPlans,
          content: (
            <TreatmentActionsTable
              riskId={risk.id}
              etag={etag}
              canTreat={canTreat}
              currentTreatmentId={risk.currentTreatment?.id ?? null}
              summary={risk.treatmentActionSummary}
              onEtagChanged={(newEtag) => setEtag(newEtag)}
              onChanged={() => void reloadRisk()}
            />
          ),
        },
      ],
    },
    {
      id: 'relationships',
      label: risks.detail.groups.relationships,
      sections: [
        {
          id: 'incidents',
          label: risks.detail.sections.incidents,
          content: <RiskIncidentLinksSection riskId={risk.id} />,
        },
        {
          id: 'problems',
          label: risks.detail.sections.problems,
          content: <RiskProblemLinksSection riskId={risk.id} />,
        },
        {
          id: 'processes-assets',
          label: risks.detail.sections.processesAssets,
          content: (
            <RiskControlsSection
              risk={risk}
              etag={etag}
              canTreatControls={canTreat}
              canEditRelationships={canEdit}
              families={['processes', 'assets']}
              onChanged={() => void reloadRisk()}
            />
          ),
        },
        {
          id: 'evidence',
          label: risks.detail.sections.evidence,
          content: (
            <EvidencePanel
              subjectType="RISK"
              subjectId={risk.id}
              orgUnitId={risk.orgUnit.id}
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
        {
          id: 'findings',
          label: risks.detail.sections.findings,
          content: (
            <FindingsPanel
              orgUnitId={risk.orgUnit.id}
              defaultOwnerUserId={user.id}
              canCreate={canCreateFindings}
              canEdit={canEditFindings}
              canClose={canCloseFindings}
              canAdminister={canAdministerFindings}
              canRemediate={canRemediateFindings}
              canLinkFindings={canLinkFindings}
            />
          ),
          visible: canViewFindings,
        },
      ],
    },
    {
      id: 'register',
      label: risks.detail.groups.register,
      sections: [
        {
          id: 'history',
          label: risks.detail.sections.history,
          content: <RiskHistorySection riskId={risk.id} />,
        },
        {
          id: 'audit',
          label: risks.detail.sections.audit,
          content: <RiskAuditSection riskId={risk.id} />,
          visible: canViewAudit,
        },
        {
          id: 'attachments',
          label: risks.detail.sections.attachments,
          content: (
            <RiskAttachmentsSection
              riskId={risk.id}
              canUpload={canUploadAttachment}
              canWithdraw={canWithdrawAttachment}
            />
          ),
        },
        {
          id: 'comments',
          label: risks.detail.sections.comments,
          content: (
            <RiskCommentsSection
              riskId={risk.id}
              canComment={canComment}
              canWithdraw={canWithdrawComment}
            />
          ),
        },
      ],
    },
  ];

  const resolved = resolveActiveDetailSection(groups, sectionParam);
  const activeGroupId = resolved?.groupId ?? '';
  const activeSectionId = resolved?.sectionId ?? '';

  function handleGroupChange(nextGroupId: string): void {
    const firstSection = firstVisibleSectionOf(groups, nextGroupId);
    if (firstSection) {
      setSection(firstSection);
    }
  }

  const groupTabs: EntityTab[] = groups.map((group) => {
    const sectionsVisible = visibleSections(group);
    const content =
      sectionsVisible.length > 1 ? (
        <EntityTabs
          ariaLabel={risks.detail.sectionsAriaLabel(group.label)}
          scrollLabels={{
            scrollBack: common.entityTabs.scrollBack,
            scrollForward: common.entityTabs.scrollForward,
          }}
          value={activeSectionId}
          onValueChange={setSection}
          tabs={group.sections}
          subordinate
        />
      ) : (
        (sectionsVisible[0]?.content ?? null)
      );

    return {
      id: group.id,
      label: group.label,
      icon: GROUP_ICONS[group.id],
      visible: sectionsVisible.length > 0,
      content,
    };
  });

  return (
    <>
      <DetailLayout
        header={
          <div className={visual.hero}>
            <RiskDetailArtwork />
            <EntityHeader
              className={visual.heroHeader}
              breadcrumb={
                <>
                  <Link href="/risks" className="hover:underline">
                    {risks.detail.breadcrumbLabel}
                  </Link>
                  <span aria-hidden="true"> › </span>
                  <span>{risk.code}</span>
                </>
              }
              code={risk.code}
              title={risk.title}
              badges={
                <>
                  <StatusBadge
                    variant={riskStatusBadgeVariant(risk.status)}
                    label={riskStatusLabel(risk.status)}
                  />
                  <PendingApprovalBadge pending={risk.pendingApproval} />
                  {/*
                   * ADR-006: inherent and residual are never shown without
                   * their basis — `subtle` emphasis here keeps this
                   * glance-level, while the header still answers "what state
                   * is it in" before any section is read (CLAUDE.md §18).
                   * Omitted honestly (SC-013) when the risk has not been
                   * assessed yet.
                   */}
                  {risk.inherentLevel ? (
                    <RiskLevelBadge
                      level={risk.inherentLevel}
                      basis="inherent"
                      emphasis="subtle"
                      labels={risks.riskLevelBadge}
                    />
                  ) : null}
                  {risk.residualLevel ? (
                    <RiskLevelBadge
                      level={risk.residualLevel}
                      basis="residual"
                      emphasis="subtle"
                      labels={risks.riskLevelBadge}
                    />
                  ) : null}
                </>
              }
              metadata={
                <>
                  <span className={visual.excerpt}>
                    {risk.descriptionExcerpt ?? risk.description}
                  </span>
                  <span>{risks.detail.metadata.owner(risk.owner.fullName)}</span>
                  {risk.responsible ? (
                    <span>{risks.detail.metadata.responsible(risk.responsible.fullName)}</span>
                  ) : null}
                  <span>{risks.detail.metadata.orgUnit(risk.orgUnit.name)}</span>
                  <span>
                    {risks.detail.metadata.identifiedOn(formatDateOnly(risk.identifiedOn))}
                  </span>
                  {risk.nextReviewOn ? (
                    <span>
                      {risks.detail.metadata.nextReviewOn(formatDateOnly(risk.nextReviewOn))}
                    </span>
                  ) : null}
                </>
              }
              actions={
                canEdit ? (
                  <Button variant="outline" onClick={() => setEditing(true)}>
                    <Pencil aria-hidden="true" className="size-4" />
                    {risks.detail.editAction}
                  </Button>
                ) : null
              }
            />
          </div>
        }
        summary={<RiskSummaryRow risk={risk} />}
        navigation={
          <EntityTabs
            ariaLabel={risks.detail.groupsAriaLabel}
            scrollLabels={{
              scrollBack: common.entityTabs.scrollBack,
              scrollForward: common.entityTabs.scrollForward,
            }}
            value={activeGroupId}
            onValueChange={handleGroupChange}
            tabs={groupTabs}
            size="compact"
          />
        }
        asideLead={<RiskAttentionAside risk={risk} lifecycle={lifecycle} onNavigate={setSection} />}
        aside={
          <RiskRelationshipsAside
            risk={risk}
            activeSectionId={activeSectionId}
            canAssess={canAssess}
            canTreat={canTreat}
            canCreateEvidence={canCreateEvidence}
            canComment={canComment}
            canViewEvidence={canViewEvidence}
            canViewFindings={canViewFindings}
          />
        }
        asideLabel={risks.detail.asideLabel}
      />

      {editing ? (
        <RiskEditPanel
          risk={risk}
          etag={etag}
          onOpenChange={(open) => {
            if (!open) setEditing(false);
          }}
          onSaved={(result) => {
            setRisk(result.risk);
            setEtag(result.etag);
            setEditing(false);
          }}
        />
      ) : null}
    </>
  );
}
