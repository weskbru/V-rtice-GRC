'use client';

import { useEffect, useState } from 'react';

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
import { incidents } from '@/lib/messages/incidents';
import { StatusBadge } from '@vertice/design-system/components';

import { incidentsApi } from '../api';
import { formatTimestampDate } from '../date';

import type { IncidentProblemLinkResponse, ProblemStatusRef } from '../types';
import type { StatusVariant } from '@vertice/design-system/components';

const PROBLEM_STATUS_VARIANT: Record<ProblemStatusRef, StatusVariant> = {
  OPEN: 'info',
  IN_ANALYSIS: 'warning',
  RESOLVED: 'success',
  CLOSED: 'neutral',
  CANCELLED: 'neutral',
};

export interface IncidentProblemLinksSectionProps {
  incidentId: string;
}

export function IncidentProblemLinksSection({
  incidentId,
}: IncidentProblemLinksSectionProps): React.JSX.Element {
  const messages = incidents.relationships.problems;
  const [links, setLinks] = useState<readonly IncidentProblemLinkResponse[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [resolvedIncidentId, setResolvedIncidentId] = useState<string | null>(null);
  const loading = resolvedIncidentId !== incidentId;

  useEffect(() => {
    let cancelled = false;
    incidentsApi
      .listProblemLinks(incidentId, false)
      .then((result) => {
        if (!cancelled) {
          setLinks(result);
          setLoadError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setResolvedIncidentId(incidentId);
      });
    return () => {
      cancelled = true;
    };
  }, [incidentId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{messages.sectionTitle}</CardTitle>
        <CardDescription>{messages.sectionDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">{messages.loading}</p>
        ) : loadError ? (
          <p role="alert" className="text-sm font-medium text-status-danger-fg">
            {messages.loadError}
          </p>
        ) : links.length === 0 ? (
          <p className="text-sm text-muted-foreground">{messages.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table className="table-fixed">
              <TableCaption className="sr-only">{messages.sectionTitle}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">{messages.columns.problem}</TableHead>
                  <TableHead className="w-[20%]">{messages.columns.status}</TableHead>
                  <TableHead className="w-[22%]">{messages.columns.linkedBy}</TableHead>
                  <TableHead className="w-[18%]">{messages.columns.linkedAt}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.map((link) => (
                  <TableRow key={link.id}>
                    <TableCell className="whitespace-normal break-words">
                      <div className="font-medium text-foreground">{link.problem.title}</div>
                      <div className="text-sm text-muted-foreground">{link.problem.code}</div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        variant={PROBLEM_STATUS_VARIANT[link.problem.status]}
                        label={messages.statusLabels[link.problem.status]}
                      />
                    </TableCell>
                    <TableCell className="whitespace-normal break-words">
                      {link.linkedBy.fullName}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatTimestampDate(link.linkedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
