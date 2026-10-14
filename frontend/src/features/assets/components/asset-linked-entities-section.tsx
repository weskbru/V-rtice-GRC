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
import { assets } from '@/lib/messages/assets';
import { StatusBadge } from '@vertice/design-system/components';

import { assetsApi } from '../api';

import type { AssetIncidentLink, ControlRef, IncidentStatusRef, RiskRef } from '../types';
import type { StatusVariant } from '@vertice/design-system/components';

const INCIDENT_STATUS_VARIANT: Record<IncidentStatusRef, StatusVariant> = {
  OPEN: 'info',
  IN_PROGRESS: 'warning',
  RESOLVED: 'success',
  CLOSED: 'neutral',
  CANCELLED: 'neutral',
};

export interface AssetLinkedRisksSectionProps {
  risks: readonly RiskRef[];
}

export function AssetLinkedRisksSection({
  risks,
}: AssetLinkedRisksSectionProps): React.JSX.Element {
  const messages = assets.linkedRisks;

  if (risks.length === 0) {
    return <p className="text-sm text-muted-foreground">{messages.empty}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table className="sm:table-fixed">
        <TableCaption className="sr-only">{assets.detail.sections.risks}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[30%]">{messages.columns.code}</TableHead>
            <TableHead className="w-[70%]">{messages.columns.title}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {risks.map((risk) => (
            <TableRow key={risk.id}>
              <TableCell className="whitespace-normal break-words">
                <Link
                  href={`/risks/${risk.id}`}
                  className="font-medium text-primary-on-surface underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {risk.code}
                </Link>
              </TableCell>
              <TableCell className="whitespace-normal break-words text-foreground">
                {risk.title}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="mt-3 text-xs text-muted-foreground">{messages.sectionDescription}</p>
    </div>
  );
}

export interface AssetLinkedControlsSectionProps {
  controls: readonly ControlRef[];
}

export function AssetLinkedControlsSection({
  controls,
}: AssetLinkedControlsSectionProps): React.JSX.Element {
  const messages = assets.linkedControls;

  if (controls.length === 0) {
    return <p className="text-sm text-muted-foreground">{messages.empty}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table className="sm:table-fixed">
        <TableCaption className="sr-only">{assets.detail.sections.controls}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[30%]">{messages.columns.code}</TableHead>
            <TableHead className="w-[70%]">{messages.columns.name}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {controls.map((control) => (
            <TableRow key={control.id}>
              <TableCell className="whitespace-normal break-words">
                <Link
                  href={`/controls/${control.id}`}
                  className="font-medium text-primary-on-surface underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {control.code}
                </Link>
              </TableCell>
              <TableCell className="whitespace-normal break-words text-foreground">
                {control.name}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="mt-3 text-xs text-muted-foreground">{messages.sectionDescription}</p>
    </div>
  );
}

export interface AssetLinkedIncidentsSectionProps {
  assetId: string;
}

export function AssetLinkedIncidentsSection({
  assetId,
}: AssetLinkedIncidentsSectionProps): React.JSX.Element {
  const messages = assets.linkedIncidents;
  const [links, setLinks] = useState<readonly AssetIncidentLink[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [resolvedAssetId, setResolvedAssetId] = useState<string | null>(null);
  const loading = resolvedAssetId !== assetId;

  useEffect(() => {
    let cancelled = false;
    assetsApi
      .listIncidentLinks(assetId, false)
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
        if (!cancelled) setResolvedAssetId(assetId);
      });
    return () => {
      cancelled = true;
    };
  }, [assetId]);

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
      <Table className="sm:table-fixed">
        <TableCaption className="sr-only">{assets.detail.sections.incidents}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[22%]">{messages.columns.code}</TableHead>
            <TableHead className="w-[53%]">{messages.columns.title}</TableHead>
            <TableHead className="w-[25%]">{messages.columns.status}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {links.map((link) => (
            <TableRow key={link.id}>
              <TableCell className="whitespace-normal break-words">
                <Link
                  href={`/incidents/${link.incident.id}`}
                  className="font-medium text-primary-on-surface underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {link.incident.code}
                </Link>
              </TableCell>
              <TableCell className="whitespace-normal break-words text-foreground">
                {link.incident.title}
              </TableCell>
              <TableCell className="whitespace-normal">
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
