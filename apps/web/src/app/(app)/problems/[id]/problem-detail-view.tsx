'use client';

/**
 * PharosGRC — problem detail screen (019-problem-detail-experience, Fase A
 * shell + Fase B "Visão geral"/"Ciclo de vida" + Fase C contextual aside and
 * overlay editing — supersedes the flat `EntityHeader` + loose
 * lifecycle-action card + one-level `EntityTabs` strip this screen used
 * before, itself built by 008-incidents-problems mirroring
 * `AssetDetailView`).
 *
 * ## What changed, and what did not
 *
 * The page composes `DetailLayout` (`@pharos/design-system/components`) —
 * the same two-column shell `RiskDetailView`/`IncidentDetailView` already
 * established — with a breadcrumb + code/badges/title/metadata header and a
 * two-level navigation (four groups, seven leaf sections) in the main
 * column. `summary`/`asideLead`/`aside` are all omitted in this phase (see
 * below); Fase C adds the contextual aside. Every section's underlying
 * component, endpoint, permission and behaviour is UNCHANGED — this rodada
 * reorganizes presentation only, never business logic, authorization or
 * lifecycle semantics (CLAUDE.md §18.9). The seven sections that existed
 * before Fase A all still exist, all with the same capabilities: Visão
 * geral, Riscos, Incidentes, Ações corretivas, Evidência, Anexos,
 * Comentários. None of them is gated by a view permission.
 *
 * ## "Visão geral" (Fase B)
 *
 * The read-only path of the "overview" section now composes `ProblemOverview`
 * (three cards: Descrição, Causa raiz, Detalhes do problema — see that
 * component's own header comment for why Causa raiz earns its own card) and
 * `ProblemLifecycleSection` (`components/detail/`, a fourth "Ciclo de vida"
 * card: the lifecycle track visual, the transition button row, and the
 * conditional outcome facts moved out of the old flat `<dl>`) — mirroring
 * `IncidentDetailView`'s own identical two-component composition exactly.
 * `ProblemLifecycleActions` (the transition buttons) is no longer rendered
 * directly by this file; `ProblemLifecycleSection` owns it now.
 *
 * ## `summary` and `asideLead` stay omitted — both decisions, not gaps
 *
 * `DetailLayout`'s `summary` slot stays empty — the coordinator's own
 * measurement of this screen found no honest KPI worth a dedicated card:
 * severity now has a real presence in the header's own badges (moved there
 * in Fase A), and "Registrado em"/"Atualizado em" are temporal context, not
 * a KPI. `asideLead` is likewise never passed, in Fase C or any later phase:
 * `Problem` has no honest pendency to list — no overdue review, no pending
 * approval, no blocked precondition distinct from "not offered" (mirrors
 * `IncidentContextAside`'s own reasoning, `features/incidents/components/
 * detail/incident-context-aside.tsx`'s header comment).
 *
 * ## Contextual aside (Fase C)
 *
 * `aside` now composes `ProblemContextAside` (`components/detail/`) —
 * "Ações rápidas", "Relacionamentos" (Riscos/Incidentes, no count, "Ver"
 * hint) and "Última atualização" — fed entirely by the `ProblemDetail`
 * already loaded on mount, zero requests of its own. `asideLabel` is the
 * catalog's own accessible name for the resulting `complementary` landmark,
 * present only at `xl`+ (`DetailLayout`'s own contract).
 *
 * ## Severity joins the header badges (Fase A)
 *
 * Before this phase, the header showed only the status badge — severity sat
 * exclusively inside the "Visão geral" tab's body. It is not new
 * information: `ProblemDetail.severity` was already loaded on mount. It now
 * renders as a second badge beside status, mirroring
 * `IncidentDetailView`'s own header exactly (severity, then status).
 *
 * ## One request on mount, unchanged
 *
 * `GET /problems/{problemId}` (`problemsApi.getById`) is the ONLY request
 * this page fires on mount, exactly as before this phase.
 *
 * ## Deep link (`?section=<id>`)
 *
 * The seven leaf ids are EXACTLY the ids this screen's tabs already used
 * before this phase (`overview`, `risks`, `incidents`, `corrective-actions`,
 * `evidence`, `attachments`, `comments`) — nothing renamed, nothing
 * invented. An unknown or no-longer-visible id resolves silently to the
 * first visible section (`resolveActiveDetailSection`,
 * `@/components/detail/detail-navigation`) — never an error, never nothing
 * selected.
 *
 * ## Leitura × edição (Fase C — overlay, no longer an inline swap)
 *
 * `Editar` opens `ProblemEditPanel` — an overlay `Sheet` composing
 * `DetailPanel mode="overlay"` around the SAME `ProblemForm` (`mode="edit"`,
 * untouched) — instead of swapping "Visão geral"'s own content for the form
 * inline, as it did through Fase A/B. The page behind the panel (Ciclo de
 * vida, the aside) stays fully readable throughout; saving closes the panel
 * and updates `problem` through the same `onSaved` shape as before. The
 * "Editar" button in the header no longer hides itself while `editing` is
 * true (it used to, when editing meant the button's own tab content
 * disappeared) — mirrors `IncidentDetailView`'s own header actions exactly;
 * the `Sheet`'s own focus trap and D-15's documented focus-return handle
 * the rest.
 *
 * ## `Suspense` (`useDetailSection` reads `useSearchParams()`)
 *
 * `page.tsx` (out of this rodada's territory, left untouched) renders
 * `ProblemDetailView` directly, with no `Suspense` of its own. This
 * component therefore supplies the boundary itself, mirroring
 * `IncidentDetailView`'s own split exactly: the exported component is a
 * thin wrapper, and every hook — including the search-params-reading
 * `useDetailSection` — lives in `ProblemDetailViewContent` underneath it.
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
import { problemsApi } from '@/features/problems/api';
import { ProblemContextAside } from '@/features/problems/components/detail/problem-context-aside';
import { ProblemEditPanel } from '@/features/problems/components/detail/problem-edit-panel';
import { ProblemLifecycleSection } from '@/features/problems/components/detail/problem-lifecycle-section';
import { ProblemAttachmentsSection } from '@/features/problems/components/problem-attachments-section';
import { ProblemCommentsSection } from '@/features/problems/components/problem-comments-section';
import { ProblemCorrectiveActions } from '@/features/problems/components/problem-corrective-actions';
import { ProblemOverview } from '@/features/problems/components/problem-overview';
import {
  ProblemIncidentLinksSection,
  ProblemRiskLinksSection,
} from '@/features/problems/components/problem-relationships-section';
import { formatTimestampDate } from '@/features/problems/date';
import {
  problemSeverityBadgeVariant,
  problemSeverityLabel,
  problemStatusBadgeVariant,
  problemStatusIcon,
  problemStatusLabel,
} from '@/features/problems/status';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { common } from '@/lib/messages/common';
import { problems } from '@/lib/messages/problems';
import { usePermissions } from '@/lib/permissions';

import type { DetailGroup } from '@/components/detail/detail-navigation';
import type { ProblemDetail } from '@/features/problems/types';
import type { EntityTab, ErrorStateProblem } from '@pharos/design-system/components';
import type { ComponentType, SVGProps } from 'react';

export interface ProblemDetailViewProps {
  problemId: string;
}

/**
 * Level-1 group icons only — `EntityTabs` itself ignores `icon` on a
 * `subordinate` strip, so the level-2 leaf tabs built from `group.sections`
 * below never need an entry here. Reused, not invented (CLAUDE.md §18.12):
 * the exact same four keys/icons `IncidentDetailView`'s own `GROUP_ICONS`
 * already uses for the same four concepts.
 */
const GROUP_ICONS: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  overview: Eye,
  response: Wrench,
  relationships: Link2,
  register: History,
};

export function ProblemDetailView({ problemId }: ProblemDetailViewProps): React.JSX.Element {
  return (
    <Suspense fallback={<LoadingState variant="block" label={problems.detail.loading} />}>
      <ProblemDetailViewContent problemId={problemId} />
    </Suspense>
  );
}

function ProblemDetailViewContent({ problemId }: ProblemDetailViewProps): React.JSX.Element {
  const { hasPermission } = usePermissions();
  const { user } = useAuth();
  const [problem, setProblem] = useState<ProblemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [problemState, setProblemState] = useState<ErrorStateProblem | undefined>(undefined);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const result = await problemsApi.getById(problemId);
        if (!cancelled) {
          setProblem(result);
        }
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.problem.status === 404) {
          setNotFound(true);
        } else if (error instanceof ApiError) {
          setProblemState({
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
  }, [problemId]);

  const { sectionParam, setSection } = useDetailSection();

  if (loading) {
    return <LoadingState variant="block" label={problems.detail.loading} />;
  }

  if (notFound) {
    return (
      <EmptyState
        variant="empty"
        title={problems.detail.notFoundTitle}
        description={problems.detail.notFoundDescription}
      />
    );
  }

  if (!problem) {
    return <ErrorState problem={problemState} />;
  }

  const canEdit = hasPermission('problem:edit');
  const canTransition = hasPermission('problem:transition');
  const canLink = hasPermission('problem:link');
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
      label: problems.detail.groups.overview,
      sections: [
        {
          id: 'overview',
          label: problems.detail.groups.overview,
          content: (
            <div className="flex flex-col gap-6">
              <ProblemOverview problem={problem} />
              <ProblemLifecycleSection
                problem={problem}
                canTransition={canTransition}
                onChanged={(updated) => setProblem(updated)}
              />
            </div>
          ),
        },
      ],
    },
    {
      id: 'response',
      label: problems.detail.groups.response,
      sections: [
        {
          id: 'corrective-actions',
          label: problems.detail.sections.correctiveActions,
          content: (
            <ProblemCorrectiveActions
              problemId={problem.id}
              canCreate={canCreateAction}
              canTransition={canTransitionAction}
            />
          ),
        },
      ],
    },
    {
      id: 'relationships',
      label: problems.detail.groups.relationships,
      sections: [
        {
          id: 'risks',
          label: problems.detail.sections.risks,
          content: <ProblemRiskLinksSection problemId={problem.id} canLinkPermission={canLink} />,
        },
        {
          id: 'incidents',
          label: problems.detail.sections.incidents,
          content: (
            <ProblemIncidentLinksSection problemId={problem.id} canLinkPermission={canLink} />
          ),
        },
      ],
    },
    {
      id: 'register',
      label: problems.detail.groups.register,
      sections: [
        {
          id: 'evidence',
          label: problems.detail.sections.evidence,
          content: (
            <EvidencePanel
              subjectType="PROBLEM"
              subjectId={problem.id}
              orgUnitId={problem.orgUnit.id}
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
          label: problems.detail.sections.attachments,
          content: (
            <ProblemAttachmentsSection
              problemId={problem.id}
              canUpload={canUploadAttachment}
              canWithdraw={canWithdrawAttachment}
            />
          ),
        },
        {
          id: 'comments',
          label: problems.detail.sections.comments,
          content: (
            <ProblemCommentsSection
              problemId={problem.id}
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
          ariaLabel={problems.detail.sectionsAriaLabel(group.label)}
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
                <Link href="/problems" className="hover:underline">
                  {problems.detail.breadcrumbLabel}
                </Link>
                <span aria-hidden="true"> › </span>
                <span>{problem.code}</span>
              </>
            }
            code={problem.code}
            title={problem.title}
            badges={
              <>
                <StatusBadge
                  variant={problemSeverityBadgeVariant(problem.severity)}
                  label={problemSeverityLabel(problem.severity)}
                />
                <StatusBadge
                  variant={problemStatusBadgeVariant(problem.status)}
                  label={problemStatusLabel(problem.status)}
                  icon={problemStatusIcon(problem.status)}
                />
              </>
            }
            metadata={
              <>
                <span>{problems.detail.metadata.orgUnit(problem.orgUnit.name)}</span>
                {/* `createdAt`/`updatedAt` are absent from `ProblemDetail`'s
                    own generated `required` array (the contract under-declares
                    fields the API always actually returns — the same class of
                    gap `features/findings/types.ts`'s own header documents) —
                    the server always sets both, so a non-null assertion here
                    reflects reality rather than papering over a genuine gap. */}
                <span>
                  {problems.detail.metadata.createdAt(formatTimestampDate(problem.createdAt!))}
                </span>
                <span>
                  {problems.detail.metadata.updatedAt(formatTimestampDate(problem.updatedAt!))}
                </span>
              </>
            }
            actions={
              canEdit ? (
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil aria-hidden="true" className="size-4" />
                  {problems.detail.editAction}
                </Button>
              ) : null
            }
          />
        }
        navigation={
          <EntityTabs
            ariaLabel={problems.detail.groupsAriaLabel}
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
          <ProblemContextAside
            problem={problem}
            activeSectionId={activeSectionId}
            canLink={canLink}
            canCreateAction={canCreateAction}
            canCreateEvidence={canCreateEvidence}
            canComment={canComment}
          />
        }
        asideLabel={problems.detail.asideLabel}
      />

      {editing ? (
        <ProblemEditPanel
          problem={problem}
          onOpenChange={(open) => {
            if (!open) setEditing(false);
          }}
          onSaved={(updated) => {
            setProblem(updated);
            setEditing(false);
          }}
        />
      ) : null}
    </>
  );
}
