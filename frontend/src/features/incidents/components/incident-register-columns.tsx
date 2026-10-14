'use client';

import { Link } from '@/components/navigation/link';
import { incidents } from '@/lib/messages/incidents';
import { StatusBadge } from '@vertice/design-system/components';

import { formatDateOnly, formatTimestampDate } from '../date';
import { incidentSeverityBadgeVariant, incidentStatusBadgeVariant } from '../status';

import type { IncidentSummary } from '../types';
import type { ColumnDef } from '@vertice/design-system/components';

export const INCIDENT_REGISTER_COLUMN_IDS = {
  code: 'code',
  title: 'title',
  severity: 'severity',
  status: 'status',
  orgUnit: 'orgUnit',
  owner: 'owner',
  reportedOn: 'reportedOn',
  updatedAt: 'updatedAt',
} as const;

export function buildIncidentRegisterColumns(): ColumnDef<IncidentSummary, unknown>[] {
  const columns = incidents.register.columns;

  return [
    {
      id: INCIDENT_REGISTER_COLUMN_IDS.code,
      accessorKey: 'code',
      header: columns.code,
      enableHiding: false,
      size: 140,
      cell: ({ row }) => (
        <Link
          href={`/incidents/${row.original.id}`}
          className="font-semibold text-primary-on-surface underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {row.original.code}
        </Link>
      ),
    },
    {
      id: INCIDENT_REGISTER_COLUMN_IDS.title,
      accessorKey: 'title',
      header: columns.title,
      enableHiding: false,
      size: 320,
      cell: ({ row }) => (
        <Link
          href={`/incidents/${row.original.id}`}
          title={row.original.title}
          className="line-clamp-2 font-medium break-words whitespace-normal text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {row.original.title}
        </Link>
      ),
    },
    {
      id: INCIDENT_REGISTER_COLUMN_IDS.severity,
      accessorKey: 'severity',
      header: columns.severity,
      size: 130,
      cell: ({ row }) => (
        <StatusBadge
          variant={incidentSeverityBadgeVariant(row.original.severity)}
          label={incidents.severityLabels[row.original.severity]}
        />
      ),
    },
    {
      id: INCIDENT_REGISTER_COLUMN_IDS.status,
      accessorKey: 'status',
      header: columns.status,
      size: 150,
      cell: ({ row }) => (
        <StatusBadge
          variant={incidentStatusBadgeVariant(row.original.status)}
          label={incidents.statusLabels[row.original.status]}
        />
      ),
    },
    {
      id: INCIDENT_REGISTER_COLUMN_IDS.orgUnit,
      accessorFn: (row) => row.orgUnit.name,
      header: columns.orgUnit,
      enableSorting: false,
      size: 200,
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.orgUnit.name}</span>,
    },
    {
      id: INCIDENT_REGISTER_COLUMN_IDS.owner,
      accessorFn: (row) => row.owner.fullName,
      header: columns.owner,
      enableSorting: false,
      size: 180,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.owner.fullName}</span>
      ),
    },
    {
      id: INCIDENT_REGISTER_COLUMN_IDS.reportedOn,
      accessorKey: 'reportedOn',
      header: columns.reportedOn,
      size: 150,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatDateOnly(row.original.reportedOn)}</span>
      ),
    },
    {
      id: INCIDENT_REGISTER_COLUMN_IDS.updatedAt,
      accessorKey: 'updatedAt',
      header: columns.updatedAt,
      size: 160,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.updatedAt ? formatTimestampDate(row.original.updatedAt) : '—'}
        </span>
      ),
    },
  ];
}
