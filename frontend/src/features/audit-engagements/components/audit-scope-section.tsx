'use client';

import {
  EmptyState,
  ErrorState,
  LoadingState,
  type ErrorStateProblem,
} from '@pharos/design-system/components';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApiError } from '@/lib/api-client';
import { auditEngagements } from '@/lib/messages/audit-engagements';
import { common } from '@/lib/messages/common';

import { auditEngagementsApi } from '../api';
import { formatTimestampDate } from '../date';

import { AuditScopeControlPicker } from './audit-scope-control-picker';
import { AuditScopeFrameworkVersionPicker } from './audit-scope-framework-version-picker';
import { AuditScopeRequirementPicker } from './audit-scope-requirement-picker';

import type { AuditEngagementStatus, AuditScopeEntry } from '../types';

export interface AuditScopeSectionProps {
  auditId: string;
  engagementStatus: AuditEngagementStatus;
  canManageScope: boolean;
  onChanged?: () => void;
}

export function AuditScopeSection({
  auditId,
  engagementStatus,
  canManageScope,
  onChanged,
}: AuditScopeSectionProps): React.JSX.Element {
  const scope = auditEngagements.scope;

  const [entries, setEntries] = useState<readonly AuditScopeEntry[]>([]);
  const [error, setError] = useState<ErrorStateProblem | undefined>(undefined);
  const [reloadToken, setReloadToken] = useState(0);

  const requestKey = `${auditId}|${reloadToken}`;
  const [resolvedRequestKey, setResolvedRequestKey] = useState<string | null>(null);
  const loading = resolvedRequestKey !== requestKey;

  useEffect(() => {
    let cancelled = false;

    auditEngagementsApi
      .listScope(auditId)
      .then((result) => {
        if (cancelled) return;
        setEntries(result);
        setError(undefined);
        setResolvedRequestKey(requestKey);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        if (caught instanceof ApiError) {
          setError({
            title: caught.problem.title,
            detail: caught.problem.detail,
            correlationId: caught.problem.correlationId,
          });
        } else {
          setError({});
        }
        setResolvedRequestKey(requestKey);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `requestKey` deriva das dependências listadas.
  }, [auditId, reloadToken]);

  function handleAdded(entry: AuditScopeEntry): void {
    setEntries((current) => [entry, ...current]);
    onChanged?.();
  }

  const canEditScope = canManageScope && engagementStatus === 'PLANNING';

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{scope.sectionDescription}</p>

      {!canManageScope ? null : engagementStatus !== 'PLANNING' ? (
        <p
          role="status"
          className="rounded-md border border-status-info-border bg-status-info-bg px-3 py-2 text-sm text-status-info-fg"
        >
          {scope.notPlanningNotice}
        </p>
      ) : null}

      {loading ? (
        <LoadingState variant="table" rows={3} label={scope.loading} />
      ) : error ? (
        <ErrorState
          problem={error}
          message={scope.loadError}
          action={
            <Button variant="outline" onClick={() => setReloadToken((token) => token + 1)}>
              {common.actions.retry}
            </Button>
          }
        />
      ) : entries.length === 0 ? (
        <EmptyState variant="empty" title={scope.empty} />
      ) : (
        <div className="flex flex-col gap-2">
          <div className="overflow-x-auto">
            <Table>
              <caption className="sr-only">{auditEngagements.aria.scopeRegionLabel}</caption>
              <TableHeader>
                <TableRow>
                  <TableHead>{scope.columns.targetType}</TableHead>
                  <TableHead>{scope.columns.target}</TableHead>
                  <TableHead>{scope.columns.linkedBy}</TableHead>
                  <TableHead>{scope.columns.linkedAt}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {auditEngagements.scopeTargetTypeLabels[entry.targetType]}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {entry.target.label}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{entry.linkedBy.fullName}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatTimestampDate(entry.linkedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-sm text-muted-foreground">{scope.noRemovalNotice}</p>
        </div>
      )}

      {canEditScope ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold text-foreground">{scope.addAction}</h3>
          <Tabs defaultValue="frameworkVersion">
            <TabsList aria-label={scope.addAction}>
              <TabsTrigger value="frameworkVersion">
                {scope.variantTabs.frameworkVersion}
              </TabsTrigger>
              <TabsTrigger value="requirement">{scope.variantTabs.requirement}</TabsTrigger>
              <TabsTrigger value="control">{scope.variantTabs.control}</TabsTrigger>
            </TabsList>
            <TabsContent value="frameworkVersion" className="pt-3">
              <AuditScopeFrameworkVersionPicker
                auditId={auditId}
                currentScope={entries}
                onAdded={handleAdded}
              />
            </TabsContent>
            <TabsContent value="requirement" className="pt-3">
              <AuditScopeRequirementPicker
                auditId={auditId}
                currentScope={entries}
                onAdded={handleAdded}
              />
            </TabsContent>
            <TabsContent value="control" className="pt-3">
              <AuditScopeControlPicker
                auditId={auditId}
                currentScope={entries}
                onAdded={handleAdded}
              />
            </TabsContent>
          </Tabs>
        </div>
      ) : null}
    </div>
  );
}
