'use client';

import { Link } from '@/components/navigation/link';
import { auditEngagements } from '@/lib/messages/audit-engagements';
import { StatusBadge } from '@vertice/design-system/components';

import { formatDateOnly, formatTimestampDate } from '../date';
import { engagementStatusBadgeVariant, engagementStatusIcon } from '../status';

import type { AuditEngagement } from '../types';
import type { ColumnDef } from '@vertice/design-system/components';

export const ENGAGEMENT_REGISTER_COLUMN_IDS = {
  code: 'code',
  objective: 'objective',
  periodStart: 'periodStart',
  orgUnit: 'orgUnit',
  leadAuditor: 'leadAuditor',
  status: 'status',
  updatedAt: 'updatedAt',
} as const;

export function buildEngagementRegisterColumns(): ColumnDef<AuditEngagement, unknown>[] {
  const columns = auditEngagements.register.columns;

  return [
    {
      id: ENGAGEMENT_REGISTER_COLUMN_IDS.code,
      accessorKey: 'code',
      header: columns.code,
      enableHiding: false,
      size: 140,
      cell: ({ row }) => (
        <Link
          href={`/audits/${row.original.id}`}
          className="font-semibold text-primary-on-surface underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {row.original.code}
        </Link>
      ),
    },
    {
      id: ENGAGEMENT_REGISTER_COLUMN_IDS.objective,
      accessorKey: 'objective',
      header: columns.objective,
      enableSorting: false,
      enableHiding: false,
      size: 320,
      cell: ({ row }) => (
        <Link
          href={`/audits/${row.original.id}`}
          title={row.original.objective}
          className="line-clamp-2 font-medium break-words whitespace-normal text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {row.original.objective}
        </Link>
      ),
    },
    {
      id: ENGAGEMENT_REGISTER_COLUMN_IDS.status,
      accessorKey: 'status',
      header: columns.status,
      enableSorting: false,
      size: 160,
      cell: ({ row }) => (
        <StatusBadge
          variant={engagementStatusBadgeVariant(row.original.status)}
          label={auditEngagements.statusLabels[row.original.status]}
          icon={engagementStatusIcon(row.original.status)}
        />
      ),
    },
    {
      id: ENGAGEMENT_REGISTER_COLUMN_IDS.periodStart,
      accessorKey: 'periodStart',
      header: columns.period,
      size: 190,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {auditEngagements.register.card.periodLabel(
            formatDateOnly(row.original.periodStart),
            formatDateOnly(row.original.periodEnd),
          )}
        </span>
      ),
    },
    {
      id: ENGAGEMENT_REGISTER_COLUMN_IDS.orgUnit,
      accessorFn: (row) => row.orgUnit.name,
      header: columns.orgUnit,
      enableSorting: false,
      size: 180,
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.orgUnit.name}</span>,
    },
    {
      id: ENGAGEMENT_REGISTER_COLUMN_IDS.leadAuditor,
      accessorFn: (row) => row.leadAuditor.fullName,
      header: columns.leadAuditor,
      enableSorting: false,
      size: 180,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.leadAuditor.fullName}</span>
      ),
    },
    {
      id: ENGAGEMENT_REGISTER_COLUMN_IDS.updatedAt,
      accessorKey: 'updatedAt',
      header: columns.updatedAt,
      size: 160,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatTimestampDate(row.original.updatedAt)}</span>
      ),
    },
  ];
}
