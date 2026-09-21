'use client';

/**
 * PharosGRC — audit engagement detail screen (T076, US1, FR-002 to
 * FR-004a), mirroring `ControlDetailView`'s structure exactly (CLAUDE.md
 * §18.12): `EntityHeader` + `EntityTabs`, a 404 rendered identically
 * whether the engagement does not exist or lies outside the caller's
 * organizational scope.
 *
 * `canEdit` is gated by BOTH the permission AND the record's own status
 * (`status === 'PLANNING'`, research.md D-3/D-13) — the "Editar" action
 * itself is never offered once the server would refuse the edit (CLAUDE.md
 * §18.11), rather than being shown and then failing with a `422`.
 *
 * `COMPLETED`/`CANCELLED` render through this exact same view, never a
 * degraded one (FR-004, "permanece integralmente legível") — only the
 * lifecycle card's own available actions and the scope tab's edit
 * affordance disappear; every fact stays visible.
 */
import {
  EmptyState,
  EntityHeader,
  EntityTabs,
  ErrorState,
  LoadingState,
  StatusBadge,
} from '@pharos/design-system/components';
import { Pencil } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  auditEngagementsApi,
  type AuditEngagementWithEtag,
} from '@/features/audit-engagements/api';
import { AuditEngagementForm } from '@/features/audit-engagements/components/audit-engagement-form';
import { AuditEngagementLifecycleActions } from '@/features/audit-engagements/components/audit-engagement-lifecycle-actions';
import { AuditEngagementOverview } from '@/features/audit-engagements/components/audit-engagement-overview';
import { AuditScopeSection } from '@/features/audit-engagements/components/audit-scope-section';
import { EngagementFindingsSection } from '@/features/audit-engagements/components/engagement-findings-section';
import { formatDateOnly, formatTimestampDate } from '@/features/audit-engagements/date';
import {
  engagementStatusBadgeVariant,
  engagementStatusIcon,
} from '@/features/audit-engagements/status';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { auditEngagements } from '@/lib/messages/audit-engagements';
import { common } from '@/lib/messages/common';
import { usePermissions } from '@/lib/permissions';

import type { AuditEngagement } from '@/features/audit-engagements/types';
import type { ErrorStateProblem } from '@pharos/design-system/components';

export interface AuditEngagementDetailViewProps {
  auditId: string;
}

export function AuditEngagementDetailView({
  auditId,
}: AuditEngagementDetailViewProps): React.JSX.Element {
  const { hasPermission } = usePermissions();
  const { user } = useAuth();
  const [engagement, setEngagement] = useState<AuditEngagement | null>(null);
  const [etag, setEtag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [problem, setProblem] = useState<ErrorStateProblem | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  /** Incremented on every scope change — see `AuditEngagementLifecycleActions`' own prop doc. */
  const [scopeChangeToken, setScopeChangeToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const result = await auditEngagementsApi.getEngagement(auditId);
        if (!cancelled) {
          setEngagement(result.engagement);
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
  }, [auditId]);

  if (loading) {
    return <LoadingState variant="block" label={auditEngagements.detail.loading} />;
  }

  if (notFound) {
    return (
      <EmptyState
        variant="empty"
        title={auditEngagements.detail.notFoundTitle}
        description={auditEngagements.detail.notFoundDescription}
      />
    );
  }

  if (!engagement || !etag) {
    return <ErrorState problem={problem} />;
  }

  const canEdit = hasPermission('audit-engagement:edit') && engagement.status === 'PLANNING';
  const canManageScope = hasPermission('audit-engagement:scope');

  async function reloadEngagement(): Promise<void> {
    try {
      const result = await auditEngagementsApi.getEngagement(auditId);
      setEngagement(result.engagement);
      setEtag(result.etag);
    } catch {
      // Best-effort, mirroring `ControlDetailView.reloadControl` — deliberately silent.
    }
  }

  function handleLifecycleChanged(result: AuditEngagementWithEtag): void {
    setEngagement(result.engagement);
    setEtag(result.etag);
  }

  return (
    <div className="flex flex-col gap-6">
      <EntityHeader
        code={engagement.code}
        title={engagement.objective}
        badges={
          <StatusBadge
            variant={engagementStatusBadgeVariant(engagement.status)}
            label={auditEngagements.statusLabels[engagement.status]}
            icon={engagementStatusIcon(engagement.status)}
          />
        }
        metadata={
          <>
            <span>{auditEngagements.detail.metadata.code(engagement.code)}</span>
            <span>{auditEngagements.detail.metadata.orgUnit(engagement.orgUnit.name)}</span>
            <span>
              {auditEngagements.detail.metadata.leadAuditor(engagement.leadAuditor.fullName)}
            </span>
            <span>
              {auditEngagements.detail.metadata.period(
                formatDateOnly(engagement.periodStart),
                formatDateOnly(engagement.periodEnd),
              )}
            </span>
            <span>
              {auditEngagements.detail.metadata.createdAt(
                formatTimestampDate(engagement.createdAt),
              )}
            </span>
            {engagement.startedAt ? (
              <span>
                {auditEngagements.detail.metadata.startedAt(
                  formatTimestampDate(engagement.startedAt),
                )}
              </span>
            ) : null}
            {engagement.completedAt ? (
              <span>
                {auditEngagements.detail.metadata.completedAt(
                  formatTimestampDate(engagement.completedAt),
                )}
              </span>
            ) : null}
            {engagement.cancelledAt ? (
              <span>
                {auditEngagements.detail.metadata.cancelledAt(
                  formatTimestampDate(engagement.cancelledAt),
                )}
              </span>
            ) : null}
          </>
        }
        actions={
          canEdit && !editing ? (
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil aria-hidden="true" className="size-4" />
              {auditEngagements.detail.editAction}
            </Button>
          ) : null
        }
      />

      <AuditEngagementLifecycleActions
        engagement={engagement}
        etag={etag}
        scopeChangeToken={scopeChangeToken}
        onChanged={handleLifecycleChanged}
      />

      <EntityTabs
        ariaLabel={common.entityTabs.sectionsAriaLabel}
        scrollLabels={{
          scrollBack: common.entityTabs.scrollBack,
          scrollForward: common.entityTabs.scrollForward,
        }}
        tabs={[
          {
            id: 'overview',
            label: auditEngagements.detail.sections.overview,
            content: editing ? (
              <AuditEngagementForm
                mode="edit"
                engagement={engagement}
                etag={etag}
                onSaved={(result) => {
                  setEngagement(result.engagement);
                  setEtag(result.etag);
                  setEditing(false);
                }}
              />
            ) : (
              <AuditEngagementOverview engagement={engagement} />
            ),
          },
          {
            id: 'scope',
            label: auditEngagements.detail.sections.scope,
            content: (
              <AuditScopeSection
                auditId={engagement.id}
                engagementStatus={engagement.status}
                canManageScope={canManageScope}
                onChanged={() => {
                  // Adding a scope entry does NOT bump the engagement's own
                  // version, so re-reading the engagement alone leaves the
                  // lifecycle card's start precondition stale — see
                  // `AuditEngagementLifecycleActions`' `scopeChangeToken`.
                  setScopeChangeToken((token) => token + 1);
                  void reloadEngagement();
                }}
              />
            ),
          },
          {
            id: 'findings',
            label: auditEngagements.detail.sections.findings,
            content: (
              <EngagementFindingsSection
                engagementId={engagement.id}
                engagementStatus={engagement.status}
                canCreate={hasPermission('finding:create')}
                defaultOwnerUserId={user.id}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
