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
import { risks } from '@/lib/messages/risks';
import { StatusBadge } from '@vertice/design-system/components';

import { risksApi } from '../api';

import type {
  IncidentStatusRef,
  ProblemStatusRef,
  RiskIncidentLink,
  RiskProblemLink,
} from '../types';
import type { StatusVariant } from '@vertice/design-system/components';

const INCIDENT_STATUS_VARIANT: Record<IncidentStatusRef, StatusVariant> = {
  OPEN: 'info',
  IN_PROGRESS: 'warning',
  RESOLVED: 'success',
  CLOSED: 'neutral',
  CANCELLED: 'neutral',
};

const PROBLEM_STATUS_VARIANT: Record<ProblemStatusRef, StatusVariant> = {
  OPEN: 'info',
  IN_ANALYSIS: 'warning',
  RESOLVED: 'success',
  CLOSED: 'neutral',
  CANCELLED: 'neutral',
};

export interface RiskIncidentLinksSectionProps {
  riskId: string;
}

export function RiskIncidentLinksSection({
  riskId,
}: RiskIncidentLinksSectionProps): React.JSX.Element {
  const messages = risks.relationships.incidents;
  const [links, setLinks] = useState<readonly RiskIncidentLink[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [resolvedRiskId, setResolvedRiskId] = useState<string | null>(null);
  const loading = resolvedRiskId !== riskId;

  useEffect(() => {
    let cancelled = false;
    risksApi
      .listIncidentLinks(riskId, false)
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
        if (!cancelled) setResolvedRiskId(riskId);
      });
    return () => {
      cancelled = true;
    };
  }, [riskId]);

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
            <Table>
              <TableCaption className="sr-only">{messages.sectionTitle}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>{messages.columns.incident}</TableHead>
                  <TableHead>{messages.columns.status}</TableHead>
                  <TableHead>{messages.columns.linkedBy}</TableHead>
                  <TableHead>{messages.columns.linkedAt}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.map((link) => (
                  <TableRow key={link.id}>
                    <TableCell>
                      <div className="font-medium text-foreground">{link.incident.title}</div>
                      <div className="text-sm text-muted-foreground">{link.incident.code}</div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        variant={INCIDENT_STATUS_VARIANT[link.incident.status]}
                        label={messages.statusLabels[link.incident.status]}
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{link.linkedBy.fullName}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {new Date(link.linkedAt).toLocaleDateString('pt-BR')}
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

export interface RiskProblemLinksSectionProps {
  riskId: string;
}

export function RiskProblemLinksSection({
  riskId,
}: RiskProblemLinksSectionProps): React.JSX.Element {
  const messages = risks.relationships.problems;
  const [links, setLinks] = useState<readonly RiskProblemLink[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [resolvedRiskId, setResolvedRiskId] = useState<string | null>(null);
  const loading = resolvedRiskId !== riskId;

  useEffect(() => {
    let cancelled = false;
    risksApi
      .listProblemLinks(riskId, false)
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
        if (!cancelled) setResolvedRiskId(riskId);
      });
    return () => {
      cancelled = true;
    };
  }, [riskId]);

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
            <Table>
              <TableCaption className="sr-only">{messages.sectionTitle}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>{messages.columns.problem}</TableHead>
                  <TableHead>{messages.columns.status}</TableHead>
                  <TableHead>{messages.columns.linkedBy}</TableHead>
                  <TableHead>{messages.columns.linkedAt}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.map((link) => (
                  <TableRow key={link.id}>
                    <TableCell>
                      <div className="font-medium text-foreground">{link.problem.title}</div>
                      <div className="text-sm text-muted-foreground">{link.problem.code}</div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        variant={PROBLEM_STATUS_VARIANT[link.problem.status]}
                        label={messages.statusLabels[link.problem.status]}
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{link.linkedBy.fullName}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {new Date(link.linkedAt).toLocaleDateString('pt-BR')}
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
