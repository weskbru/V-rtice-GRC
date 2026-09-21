'use client';

/**
 * PharosGRC — process catalog column definitions (T046), mirroring
 * `features/audit-engagements/components/audit-engagement-register-
 * columns.tsx` (CLAUDE.md §18.12).
 *
 * `enableSorting` is `false` on every column whose field is absent from
 * `GET /processes`'s `sort` enum (`code, name, updatedAt`) — `orgUnit` and
 * `situation` are shown but never offered as a sortable column header.
 *
 * Situation pairs an icon with its colour and text label (`StatusBadge`,
 * CLAUDE.md §18.8) — never colour alone (FR-019).
 */
import { StatusBadge } from '@pharos/design-system/components';

import { Link } from '@/components/navigation/link';
import { processes } from '@/lib/messages/processes';

import { formatTimestampDate } from '../date';
import { processSituationLabel, processSituationVariant } from '../situation';

import type { ProcessSummary } from '../types';
import type { ColumnDef } from '@pharos/design-system/components';

export const PROCESS_REGISTER_COLUMN_IDS = {
  code: 'code',
  name: 'name',
  orgUnit: 'orgUnit',
  situation: 'situation',
  updatedAt: 'updatedAt',
} as const;

export function buildProcessRegisterColumns(): ColumnDef<ProcessSummary, unknown>[] {
  const columns = processes.register.columns;

  return [
    {
      id: PROCESS_REGISTER_COLUMN_IDS.code,
      accessorKey: 'code',
      header: columns.code,
      enableHiding: false,
      size: 140,
      cell: ({ row }) => (
        <Link
          href={`/processes/${row.original.id}`}
          className="font-semibold text-primary-on-surface underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {row.original.code}
        </Link>
      ),
    },
    {
      id: PROCESS_REGISTER_COLUMN_IDS.name,
      accessorKey: 'name',
      header: columns.name,
      enableHiding: false,
      size: 320,
      cell: ({ row }) => (
        <Link
          href={`/processes/${row.original.id}`}
          title={row.original.name}
          className="line-clamp-2 font-medium break-words whitespace-normal text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {row.original.name}
        </Link>
      ),
    },
    {
      id: PROCESS_REGISTER_COLUMN_IDS.situation,
      accessorKey: 'isActive',
      header: columns.situation,
      enableSorting: false,
      size: 140,
      cell: ({ row }) => (
        <StatusBadge
          variant={processSituationVariant(row.original.isActive)}
          label={processSituationLabel(row.original.isActive)}
        />
      ),
    },
    {
      id: PROCESS_REGISTER_COLUMN_IDS.orgUnit,
      accessorFn: (row) => row.orgUnit?.name ?? '',
      header: columns.orgUnit,
      enableSorting: false,
      size: 200,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.orgUnit?.name ?? columns.notSet}
        </span>
      ),
    },
    {
      id: PROCESS_REGISTER_COLUMN_IDS.updatedAt,
      accessorKey: 'updatedAt',
      header: columns.updatedAt,
      size: 160,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatTimestampDate(row.original.updatedAt)}</span>
      ),
    },
  ];
}
