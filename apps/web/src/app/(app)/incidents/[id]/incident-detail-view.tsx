'use client';

/**
 * PharosGRC — incident detail screen (018-incident-detail-experience, Fase
 * 2+3 shell, Fase 4 contextual aside + overlay editing — supersedes the
 * flat `EntityHeader` + loose lifecycle-action card + one-level
 * `EntityTabs` strip this screen used before, itself built by
 * 008-incidents-problems mirroring `AssetDetailView`).
 *
 * ## What changed, and what did not
 *
 * The page composes `DetailLayout` (`@pharos/design-system/components`) —
 * the same two-column shell `RiskDetailView` established in
 * 016-risk-detail-experience — with a breadcrumb + code/badges/title/
 * metadata header, a two-level navigation (four groups, nine leaf sections)
 * in the main column, and a contextual aside beside it. Every section's
 * underlying component, endpoint, permission and behaviour is UNCHANGED —
 * this rodada reorganizes presentation only, never business logic,
 * authorization or lifecycle semantics (CLAUDE.md §18.9). The nine sections
 * that existed before Fase 2+3 all still exist, all with the same
 * capabilities: Visão geral, Riscos, Ativos, Processos, Problemas, Ações
 * corretivas, Evidência, Anexos, Comentários. None of them is gated by a
 * view permission — unlike `RiskDetailView`'s Audit/Evidence/Findings, no
 * incident section has ever needed one, and this rodada does not introduce
 * one.
 *
 * ## `summary` stays empty; `asideLead` stays omitted — both decisions, not
 * gaps
 *
 * `DetailLayout`'s `summary` slot stays empty — the user explicitly
 * declined a `SummaryStatCard` row for this screen (severity and status
 * already have a real presence in the header's own badges; "Reportado em"
 * is temporal context, not a KPI). `asideLead` is likewise never passed:
 * unlike Risk (`overdueReview`, `overdueTreatment`, pending approval, a
 * blocked transition), `Incident` has no honest pendency to list —
 * `IncidentContextAside`'s own header comment records this in full. `aside`
 * (Fase 4) fills the rest of the contextual column: "Ações rápidas",
 * "Relacionamentos" and "Última atualização", built entirely from data this
 * page already loaded.
 *
 * ## One request on mount, unchanged
 *
 * `GET /incidents/{incidentId}` (`incidentsApi.getById`) is the ONLY
 * request this page fires on mount, exactly as before Fase 2+3 and
 * unchanged by Fase 4's aside (which fetches nothing of its own). Unlike
 * `RiskDetailView`, there is no second `GET .../lifecycle` request to add:
 * `status.ts`'s own header comment explains why no such endpoint exists for
 * Incident — `availableIncidentTransitions` is a client-side table, and the
 * "Ciclo de vida" track (`components/detail/incident-lifecycle-track.ts`)
 * is derived entirely from the SAME `IncidentDetail` this request already
 * returns.
 *
 * ## Deep link (`?section=<id>`)
 *
 * The nine leaf ids are EXACTLY the ids this screen's tabs already used
 * before Fase 2+3 (`overview`, `risks`, `assets`, `processes`, `problems`,
 * `corrective-actions`, `evidence`, `attachments`, `comments`) — nothing
 * renamed, nothing invented. An unknown or no-longer-visible id resolves
 * silently to the first visible section (`resolveActiveDetailSection`,
 * `@/components/detail/detail-navigation`) — never an error, never nothing
 * selected.
 *
 * ## Leitura × edição (Fase 4 — overlay, no longer an inline swap)
 *
 * `Editar` opens `IncidentEditPanel` — an overlay `Sheet` composing
 * `DetailPanel mode="overlay"` around the SAME `IncidentForm`
 * (`mode="edit"`, untouched) — instead of swapping "Visão geral"'s own
 * content for the form inline, as it did through Fase 2+3. The page behind
 * the panel (Ciclo de vida, the aside) stays fully readable throughout;
 * saving closes the panel and updates `incident` through the same
 * `onSaved` shape as before.
 *
 * ## `Suspense` (`useDetailSection` reads `useSearchParams()`)
 *
 * `page.tsx` (out of this rodada's territory, left untouched) renders
 * `IncidentDetailView` directly, with no `Suspense` of its own. This
 * component therefore supplies the boundary itself, mirroring
 * `RiskDetailView`'s own split exactly: the exported component is a thin
 * wrapper, and every hook — including the search-params-reading
 * `useDetailSection` — lives in `IncidentDetailViewContent` underneath it.
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
import { Eye, History, Link2, Pencil, Wrench } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';

import {
  firstVisibleSectionOf,
  resolveActiveDetailSection,
  visibleSections,
} from '@/components/detail/detail-navigation';
import { useDetailSection } from '@/components/detail/use-detail-section';
import { Link } from '@/components/navigation/link';
import { Button } from '@/components/ui/button';
import { EvidencePanel } from '@/features/evidence/components/evidence-panel';
import { incidentsApi } from '@/features/incidents/api';
import { IncidentContextAside } from '@/features/incidents/components/detail/incident-context-aside';
import { IncidentEditPanel } from '@/features/incidents/components/detail/incident-edit-panel';
import { IncidentLifecycleSection } from '@/features/incidents/components/detail/incident-lifecycle-section';
import { IncidentAttachmentsSection } from '@/features/incidents/components/incident-attachments-section';
import { IncidentCommentsSection } from '@/features/incidents/components/incident-comments-section';
import { IncidentCorrectiveActions } from '@/features/incidents/components/incident-corrective-actions';
import { IncidentOverview } from '@/features/incidents/components/incident-overview';
import { IncidentProblemLinksSection } from '@/features/incidents/components/incident-problem-links-section';
import {
  IncidentAssetRelationshipsSection,
  IncidentProcessRelationshipsSection,
  IncidentRiskRelationshipsSection,
} from '@/features/incidents/components/incident-relationships-section';
import { formatDateOnly } from '@/features/incidents/date';
import {
  incidentSeverityBadgeVariant,
  incidentSeverityLabel,
  incidentStatusBadgeVariant,
  incidentStatusLabel,
} from '@/features/incidents/status';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { common } from '@/lib/messages/common';
import { incidents } from '@/lib/messages/incidents';
import { usePermissions } from '@/lib/permissions';

import type { DetailGroup } from '@/components/detail/detail-navigation';
import type { IncidentDetail } from '@/features/incidents/types';
import type { EntityTab, ErrorStateProblem } from '@pharos/design-system/components';
import type { ComponentType, SVGProps } from 'react';

export interface IncidentDetailViewProps {
  incidentId: string;
}

/**
 * Level-1 group icons only — `EntityTabs` itself ignores `icon` on a
 * `subordinate` strip, so the level-2 leaf tabs built from `group.sections`
 * below never need an entry here. Reused, not invented (CLAUDE.md §18.12):
 * `Eye`/`Wrench`/`Link2`/`History` are the EXACT icons `RiskDetailView`'s
 * own `GROUP_ICONS` already uses for the same four concepts (Visão geral,
 * a response-type group, relationships, register-type group).
 */
const GROUP_ICONS: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  overview: Eye,
  response: Wrench,
  relationships: Link2,
  register: History,
};

export function IncidentDetailView({ incidentId }: IncidentDetailViewProps): React.JSX.Element {
  return (
    <Suspense fallback={<LoadingState variant="block" label={incidents.detail.loading} />}>
      <IncidentDetailViewContent incidentId={incidentId} />
    </Suspense>
  );
}

function IncidentDetailViewContent({ incidentId }: IncidentDetailViewProps): React.JSX.Element {
  const { hasPermission } = usePermissions();
  const { user } = useAuth();
  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [problem, setProblem] = useState<ErrorStateProblem | undefined>(undefined);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const result = await incidentsApi.getById(incidentId);
        if (!cancelled) {
          setIncident(result);
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
  }, [incidentId]);

  const { sectionParam, setSection } = useDetailSection();

  if (loading) {
    return <LoadingState variant="block" label={incidents.detail.loading} />;
  }

  if (notFound) {
    return (
      <EmptyState
        variant="empty"
        title={incidents.detail.notFoundTitle}
        description={incidents.detail.notFoundDescription}
      />
    );
  }

  if (!incident) {
    return <ErrorState problem={problem} />;
  }

  const canEdit = hasPermission('incident:edit');
  const canTransition = hasPermission('incident:transition');
  const canLink = hasPermission('incident:link');
  const canCreateAction = canEdit && hasPermission('action:create');
  const canTransitionAction = hasPermission('action:edit');
  const canCreateEvidence = hasPermission('evidence:create');
  const canLinkEvidence = hasPermission('evidence:link');
  const canAdministerEvidence = hasPermission('evidence:administer');
  const canUploadAttachment = hasPermission('attachment:create');
  const canWithdrawAttachment = hasPermission('attachment:delete');
  const canComment = hasPermission('comment:create');
  const canWithdrawComment = hasPermission('comment:delete');

  const groups: readonly DetailGroup[] = [
    {
      id: 'overview',
      label: incidents.detail.groups.overview,
      sections: [
        {
          id: 'overview',
          label: incidents.detail.groups.overview,
          content: (
            <div className="flex flex-col gap-6">
              <IncidentOverview incident={incident} />
              <IncidentLifecycleSection
                incident={incident}
                canTransition={canTransition}
                onChanged={(updated) => setIncident(updated)}
              />
            </div>
          ),
        },
      ],
    },
    {
      id: 'response',
      label: incidents.detail.groups.response,
      sections: [
        {
          id: 'corrective-actions',
          label: incidents.detail.sections.correctiveActions,
          content: (
            <IncidentCorrectiveActions
              incidentId={incident.id}
              canCreate={canCreateAction}
              canTransition={canTransitionAction}
            />
          ),
        },
      ],
    },
    {
      id: 'relationships',
      label: incidents.detail.groups.relationships,
      sections: [
        {
          id: 'risks',
          label: incidents.detail.sections.risks,
          content: <IncidentRiskRelationshipsSection incidentId={incident.id} canLink={canLink} />,
        },
        {
          id: 'assets',
          label: incidents.detail.sections.assets,
          content: <IncidentAssetRelationshipsSection incidentId={incident.id} canLink={canLink} />,
        },
        {
          id: 'processes',
          label: incidents.detail.sections.processes,
          content: (
            <IncidentProcessRelationshipsSection incidentId={incident.id} canLink={canLink} />
          ),
        },
        {
          id: 'problems',
          label: incidents.detail.sections.problems,
          content: <IncidentProblemLinksSection incidentId={incident.id} />,
        },
      ],
    },
    {
      id: 'register',
      label: incidents.detail.groups.register,
      sections: [
        {
          id: 'evidence',
          label: incidents.detail.sections.evidence,
          content: (
            <EvidencePanel
              subjectType="INCIDENT"
              subjectId={incident.id}
              orgUnitId={incident.orgUnit.id}
              defaultOwnerUserId={user.id}
              canCreate={canCreateEvidence}
              canLink={canLinkEvidence}
              canAdminister={canAdministerEvidence}
              canUploadAttachment={canUploadAttachment}
              canWithdrawAttachment={canWithdrawAttachment}
            />
          ),
        },
        {
          id: 'attachments',
          label: incidents.detail.sections.attachments,
          content: (
            <IncidentAttachmentsSection
              incidentId={incident.id}
              canUpload={canUploadAttachment}
              canWithdraw={canWithdrawAttachment}
            />
          ),
        },
        {
          id: 'comments',
          label: incidents.detail.sections.comments,
          content: (
            <IncidentCommentsSection
              incidentId={incident.id}
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
          ariaLabel={incidents.detail.sectionsAriaLabel(group.label)}
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
          <EntityHeader
            breadcrumb={
              <>
                <Link href="/incidents" className="hover:underline">
                  {incidents.detail.breadcrumbLabel}
                </Link>
                <span aria-hidden="true"> › </span>
                <span>{incident.code}</span>
              </>
            }
            code={incident.code}
            title={incident.title}
            badges={
              <>
                <StatusBadge
                  variant={incidentSeverityBadgeVariant(incident.severity)}
                  label={incidentSeverityLabel(incident.severity)}
                />
                <StatusBadge
                  variant={incidentStatusBadgeVariant(incident.status)}
                  label={incidentStatusLabel(incident.status)}
                />
              </>
            }
            metadata={
              <>
                <span>{incidents.detail.metadata.orgUnit(incident.orgUnit.name)}</span>
                <span>{incidents.detail.metadata.owner(incident.owner.fullName)}</span>
                <span>
                  {incidents.detail.metadata.reportedOn(formatDateOnly(incident.reportedOn))}
                </span>
              </>
            }
            actions={
              canEdit ? (
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil aria-hidden="true" className="size-4" />
                  {incidents.detail.editAction}
                </Button>
              ) : null
            }
          />
        }
        navigation={
          <EntityTabs
            ariaLabel={incidents.detail.groupsAriaLabel}
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
        aside={
          <IncidentContextAside
            incident={incident}
            activeSectionId={activeSectionId}
            canLink={canLink}
            canCreateAction={canCreateAction}
            canCreateEvidence={canCreateEvidence}
            canComment={canComment}
          />
        }
        asideLabel={incidents.detail.asideLabel}
      />

      {editing ? (
        <IncidentEditPanel
          incident={incident}
          onOpenChange={(open) => {
            if (!open) setEditing(false);
          }}
          onSaved={(updated) => {
            setIncident(updated);
            setEditing(false);
          }}
        />
      ) : null}
    </>
  );
}
