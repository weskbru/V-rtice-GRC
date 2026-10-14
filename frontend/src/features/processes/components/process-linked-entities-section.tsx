'use client';

import { useEffect, useState } from 'react';

import { Link } from '@/components/navigation/link';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { processes } from '@/lib/messages/processes';
import { StatusBadge } from '@vertice/design-system/components';

import { processesApi } from '../api';

import type { ControlRef, IncidentStatusRef, ProcessIncidentLink, RiskRef } from '../types';
import type { StatusVariant } from '@vertice/design-system/components';

const INCIDENT_STATUS_VARIANT: Record<IncidentStatusRef, StatusVariant> = {
  OPEN: 'info',
  IN_PROGRESS: 'warning',
  RESOLVED: 'success',
  CLOSED: 'neutral',
  CANCELLED: 'neutral',
};

export interface ProcessLinkedRisksSectionProps {
  risks: readonly RiskRef[];
}

export function ProcessLinkedRisksSection({
  risks,
}: ProcessLinkedRisksSectionProps): React.JSX.Element {
  const messages = processes.linkedRisks;

  if (risks.length === 0) {
    return <p className="text-sm text-muted-foreground">{messages.empty}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableCaption className="sr-only">{processes.detail.sections.risks}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{messages.columns.code}</TableHead>
            <TableHead>{messages.columns.title}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {risks.map((risk) => (
            <TableRow key={risk.id}>
              <TableCell>
                <Link
                  href={`/risks/${risk.id}`}
                  className="font-medium text-primary-on-surface underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {risk.code}
                </Link>
              </TableCell>
              <TableCell className="text-foreground">{risk.title}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="mt-3 text-xs text-muted-foreground">{messages.sectionDescription}</p>
    </div>
  );
}

export interface ProcessLinkedControlsSectionProps {
  controls: readonly ControlRef[];
}

export function ProcessLinkedControlsSection({
  controls,
}: ProcessLinkedControlsSectionProps): React.JSX.Element {
  const messages = processes.linkedControls;

  if (controls.length === 0) {
    return <p className="text-sm text-muted-foreground">{messages.empty}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableCaption className="sr-only">{processes.detail.sections.controls}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{messages.columns.code}</TableHead>
            <TableHead>{messages.columns.name}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {controls.map((control) => (
            <TableRow key={control.id}>
              <TableCell>
                <Link
                  href={`/controls/${control.id}`}
                  className="font-medium text-primary-on-surface underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {control.code}
                </Link>
              </TableCell>
              <TableCell className="text-foreground">{control.name}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="mt-3 text-xs text-muted-foreground">{messages.sectionDescription}</p>
    </div>
  );
}

export interface ProcessLinkedIncidentsSectionProps {
  processId: string;
}

export function ProcessLinkedIncidentsSection({
  processId,
}: ProcessLinkedIncidentsSectionProps): React.JSX.Element {
  const messages = processes.linkedIncidents;
  const [links, setLinks] = useState<readonly ProcessIncidentLink[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [resolvedProcessId, setResolvedProcessId] = useState<string | null>(null);
  const loading = resolvedProcessId !== processId;

  useEffect(() => {
    let cancelled = false;
    processesApi
      .listIncidentLinks(processId, false)
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
        if (!cancelled) setResolvedProcessId(processId);
      });
    return () => {
      cancelled = true;
    };
  }, [processId]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">{messages.loading}</p>;
  }

  if (loadError) {
    return (
      <p role="alert" className="text-sm font-medium text-status-danger-fg">
        {messages.loadError}
      </p>
    );
  }

  if (links.length === 0) {
    return <p className="text-sm text-muted-foreground">{messages.empty}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableCaption className="sr-only">{processes.detail.sections.incidents}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{messages.columns.code}</TableHead>
            <TableHead>{messages.columns.title}</TableHead>
            <TableHead>{messages.columns.status}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {links.map((link) => (
            <TableRow key={link.id}>
              <TableCell>
                <Link
                  href={`/incidents/${link.incident.id}`}
                  className="font-medium text-primary-on-surface underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {link.incident.code}
                </Link>
              </TableCell>
              <TableCell className="text-foreground">{link.incident.title}</TableCell>
              <TableCell>
                <StatusBadge
                  variant={INCIDENT_STATUS_VARIANT[link.incident.status]}
                  label={messages.statusLabels[link.incident.status]}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="mt-3 text-xs text-muted-foreground">{messages.sectionDescription}</p>
    </div>
  );
}
