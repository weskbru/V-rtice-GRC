'use client';

import { AlertTriangle, Eye, History, Pencil } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Link } from '@/components/navigation/link';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { actions } from '@/lib/messages/actions';
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

import { formatDateOnly } from '../../risks/date';
import { actionsApi } from '../api';
import { actionStatusBadgeVariant, actionStatusLabel } from '../status';

import { ActionAuditSection } from './action-audit-section';
import { ActionOverview } from './action-overview';
import { ActionEditPanel } from './detail/action-edit-panel';
import { ActionLifecycleSection } from './detail/action-lifecycle-section';

import type { Action } from '../types';
import type { ErrorStateProblem } from '@vertice/design-system/components';

export interface ActionDetailViewProps {
  actionId: string;
}

export function ActionDetailView({ actionId }: ActionDetailViewProps): React.JSX.Element {
  const { hasPermission } = usePermissions();
  const [action, setAction] = useState<Action | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [problem, setProblem] = useState<ErrorStateProblem | undefined>(undefined);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const result = await actionsApi.getAction(actionId);
        if (!cancelled) {
          setAction(result);
        }
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.problem.status === 404) {
          setNotFound(true);
        } else if (error instanceof ApiError && error.problem.status === 403) {
          setForbidden(true);
        } else if (error instanceof ApiError) {
          setProblem({
            title: error.problem.title,
            detail: error.problem.detail,
            correlationId: error.problem.correlationId,
          });
        } else {
          setProblem({});
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
  }, [actionId]);

  if (loading) {
    return <LoadingState variant="block" label={actions.detail.loading} />;
  }

  if (notFound) {
    return (
      <EmptyState
        variant="empty"
        title={actions.detail.notFoundTitle}
        description={actions.detail.notFoundDescription}
      />
    );
  }

  if (forbidden) {
    return <ErrorState problem={actions.detail.forbidden} />;
  }

  if (!action) {
    return <ErrorState problem={problem} />;
  }

  const canEdit = hasPermission('action:edit');
  const canViewAudit = hasPermission('audit:view');

  return (
    <>
      <DetailLayout
        header={
          <EntityHeader
            breadcrumb={
              <>
                <Link href="/actions" className="hover:underline">
                  {actions.detail.breadcrumbLabel}
                </Link>
                <span aria-hidden="true"> › </span>
                <span>{action.code}</span>
              </>
            }
            code={action.code}
            title={action.title}
            badges={
              <>
                <StatusBadge
                  variant={actionStatusBadgeVariant(action.status)}
                  label={actionStatusLabel(action.status)}
                />
                {action.overdue ? (
                  <StatusBadge
                    variant="danger"
                    label={actions.myActions.indicators.overdue}
                    icon={AlertTriangle}
                  />
                ) : null}
              </>
            }
            metadata={
              <>
                <span>{actions.detail.metadata.orgUnit(action.orgUnit.name)}</span>
                <span>{actions.detail.metadata.responsible(action.responsible.fullName)}</span>
                <span>{actions.detail.metadata.dueOn(formatDateOnly(action.dueOn))}</span>
              </>
            }
            actions={
              canEdit ? (
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil aria-hidden="true" className="size-4" />
                  {actions.detail.editAction}
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
            tabs={[
              {
                id: 'overview',
                label: actions.detail.sections.overview,
                icon: Eye,
                content: (
                  <div className="flex flex-col gap-6">
                    <ActionOverview action={action} />
                    <ActionLifecycleSection
                      action={action}
                      canTransition={canEdit}
                      onChanged={(updated) => setAction(updated)}
                    />
                  </div>
                ),
              },
              {
                id: 'audit',
                label: actions.detail.sections.audit,
                icon: History,
                visible: canViewAudit,
                content: <ActionAuditSection actionId={action.id} />,
              },
            ]}
          />
        }
      />

      {editing ? (
        <ActionEditPanel
          action={action}
          onOpenChange={(open) => {
            if (!open) setEditing(false);
          }}
          onSaved={(updated) => {
            setAction(updated);
            setEditing(false);
          }}
        />
      ) : null}
    </>
  );
}
