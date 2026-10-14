'use client';

import { Eye, Pencil, Search, Target } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';

import { useDetailSection } from '@/components/detail/use-detail-section';
import { Link } from '@/components/navigation/link';
import { Button } from '@/components/ui/button';
import {
  auditEngagementsApi,
  type AuditEngagementWithEtag,
} from '@/features/audit-engagements/api';
import { AuditEngagementLifecycleActions } from '@/features/audit-engagements/components/audit-engagement-lifecycle-actions';
import { AuditEngagementOverview } from '@/features/audit-engagements/components/audit-engagement-overview';
import { AuditScopeSection } from '@/features/audit-engagements/components/audit-scope-section';
import { AuditEngagementEditPanel } from '@/features/audit-engagements/components/detail/audit-engagement-edit-panel';
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
import {
  DetailLayout,
  EmptyState,
  EntityHeader,
  EntityTabs,
  ErrorState,
  LoadingState,
  StatusBadge,
} from '@vertice/design-system/components';

import type { AuditEngagement } from '@/features/audit-engagements/types';
import type { EntityTab, ErrorStateProblem } from '@vertice/design-system/components';

export interface AuditEngagementDetailViewProps {
  auditId: string;
}

export function AuditEngagementDetailView({
  auditId,
}: AuditEngagementDetailViewProps): React.JSX.Element {
  return (
    <Suspense fallback={<LoadingState variant="block" label={auditEngagements.detail.loading} />}>
      <AuditEngagementDetailViewContent auditId={auditId} />
    </Suspense>
  );
}

function AuditEngagementDetailViewContent({
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

  const { sectionParam, setSection } = useDetailSection();

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
    } catch {}
  }

  function handleLifecycleChanged(result: AuditEngagementWithEtag): void {
    setEngagement(result.engagement);
    setEtag(result.etag);
  }

  const tabs: EntityTab[] = [
    {
      id: 'overview',
      label: auditEngagements.detail.sections.overview,
      icon: Eye,
      content: (
        <div className="flex flex-col gap-4">
          <AuditEngagementOverview engagement={engagement} />
          <AuditEngagementLifecycleActions
            engagement={engagement}
            etag={etag}
            scopeChangeToken={scopeChangeToken}
            onChanged={handleLifecycleChanged}
          />
        </div>
      ),
    },
    {
      id: 'scope',
      label: auditEngagements.detail.sections.scope,
      icon: Target,
      content: (
        <AuditScopeSection
          auditId={engagement.id}
          engagementStatus={engagement.status}
          canManageScope={canManageScope}
          onChanged={() => {
            setScopeChangeToken((token) => token + 1);
            void reloadEngagement();
          }}
        />
      ),
    },
    {
      id: 'findings',
      label: auditEngagements.detail.sections.findings,
      icon: Search,
      content: (
        <EngagementFindingsSection
          engagementId={engagement.id}
          engagementStatus={engagement.status}
          canCreate={hasPermission('finding:create')}
          defaultOwnerUserId={user.id}
        />
      ),
    },
  ];

  return (
    <>
      <DetailLayout
        header={
          <EntityHeader
            breadcrumb={
              <>
                <Link href="/audits" className="hover:underline">
                  {auditEngagements.detail.breadcrumbLabel}
                </Link>
                <span aria-hidden="true"> › </span>
                <span>{engagement.code}</span>
              </>
            }
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
              canEdit ? (
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil aria-hidden="true" className="size-4" />
                  {auditEngagements.detail.editAction}
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
      />

      {editing ? (
        <AuditEngagementEditPanel
          engagement={engagement}
          etag={etag}
          onOpenChange={(open) => {
            if (!open) setEditing(false);
          }}
          onSaved={(result) => {
            setEngagement(result.engagement);
            setEtag(result.etag);
            setEditing(false);
          }}
        />
      ) : null}
    </>
  );
}
