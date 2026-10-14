'use client';

import { Link } from '@/components/navigation/link';
import { problems } from '@/lib/messages/problems';
import { StatusBadge } from '@vertice/design-system/components';

import { formatDateOnly, formatTimestampDate } from '../date';
import {
  problemSeverityBadgeVariant,
  problemSeverityIcon,
  problemStatusBadgeVariant,
  problemStatusIcon,
} from '../status';

import type { ProblemSummary } from '../types';
import type { ColumnDef } from '@vertice/design-system/components';

export const PROBLEM_REGISTER_COLUMN_IDS = {
  code: 'code',
  title: 'title',
  severity: 'severity',
  status: 'status',
  orgUnit: 'orgUnit',
  owner: 'owner',
  identifiedOn: 'identifiedOn',
  updatedAt: 'updatedAt',
} as const;

export function buildProblemRegisterColumns(): ColumnDef<ProblemSummary, unknown>[] {
  const columns = problems.register.columns;

  return [
    {
      id: PROBLEM_REGISTER_COLUMN_IDS.code,
      accessorKey: 'code',
      header: columns.code,
      enableHiding: false,
      size: 140,
      cell: ({ row }) => (
        <Link
          href={`/problems/${row.original.id}`}
          className="font-semibold text-primary-on-surface underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {row.original.code}
        </Link>
      ),
    },
    {
      id: PROBLEM_REGISTER_COLUMN_IDS.title,
      accessorKey: 'title',
      header: columns.title,
      enableHiding: false,
      size: 320,
      cell: ({ row }) => (
        <Link
          href={`/problems/${row.original.id}`}
          title={row.original.title}
          className="line-clamp-2 font-medium break-words whitespace-normal text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {row.original.title}
        </Link>
      ),
    },
    {
      id: PROBLEM_REGISTER_COLUMN_IDS.severity,
      accessorKey: 'severity',
      header: columns.severity,
      size: 130,
      cell: ({ row }) => (
        <StatusBadge
          variant={problemSeverityBadgeVariant(row.original.severity)}
          label={problems.severityLabels[row.original.severity]}
          icon={problemSeverityIcon(row.original.severity)}
        />
      ),
    },
    {
      id: PROBLEM_REGISTER_COLUMN_IDS.status,
      accessorKey: 'status',
      header: columns.status,
      size: 150,
      cell: ({ row }) => (
        <StatusBadge
          variant={problemStatusBadgeVariant(row.original.status)}
          label={problems.statusLabels[row.original.status]}
          icon={problemStatusIcon(row.original.status)}
        />
      ),
    },
    {
      id: PROBLEM_REGISTER_COLUMN_IDS.orgUnit,
      accessorFn: (row) => row.orgUnit.name,
      header: columns.orgUnit,
      enableSorting: false,
      size: 200,
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.orgUnit.name}</span>,
    },
    {
      id: PROBLEM_REGISTER_COLUMN_IDS.owner,
      accessorFn: (row) => row.owner.fullName,
      header: columns.owner,
      enableSorting: false,
      size: 180,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.owner.fullName}</span>
      ),
    },
    {
      id: PROBLEM_REGISTER_COLUMN_IDS.identifiedOn,
      accessorKey: 'identifiedOn',
      header: columns.identifiedOn,
      size: 150,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatDateOnly(row.original.identifiedOn)}</span>
      ),
    },
    {
      id: PROBLEM_REGISTER_COLUMN_IDS.updatedAt,
      accessorKey: 'updatedAt',
      header: columns.updatedAt,
      size: 160,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatTimestampDate(row.original.updatedAt!)}
        </span>
      ),
    },
  ];
}
