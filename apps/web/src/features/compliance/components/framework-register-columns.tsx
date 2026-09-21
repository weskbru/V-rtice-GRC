'use client';

/**
 * PharosGRC — framework register column definitions (US1), mirroring
 * `features/controls/components/control-register-columns.tsx` (CLAUDE.md
 * §18.12). `origin` is a plain classification, not a lifecycle/severity
 * status — rendered as quiet text, the same treatment `control-register-
 * columns.tsx` gives `nature`/`type`/`frequency`, never a `StatusBadge`.
 */
import { Link } from '@/components/navigation/link';
import { compliance } from '@/lib/messages/compliance';

import { formatTimestampDate } from '../date';

import type { Framework } from '../types';
import type { ColumnDef } from '@pharos/design-system/components';

export const FRAMEWORK_REGISTER_COLUMN_IDS = {
  code: 'code',
  name: 'name',
  origin: 'origin',
  updatedAt: 'updatedAt',
} as const;

export function buildFrameworkRegisterColumns(): ColumnDef<Framework, unknown>[] {
  return [
    {
      id: FRAMEWORK_REGISTER_COLUMN_IDS.code,
      accessorKey: 'code',
      header: compliance.register.columns.code,
      enableHiding: false,
      enableSorting: true,
      size: 140,
      cell: ({ row }) => (
        <Link
          href={`/compliance/${row.original.id}`}
          className="font-semibold text-primary-on-surface underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {row.original.code}
        </Link>
      ),
    },
    {
      id: FRAMEWORK_REGISTER_COLUMN_IDS.name,
      accessorKey: 'name',
      header: compliance.register.columns.name,
      enableHiding: false,
      enableSorting: true,
      size: 360,
      cell: ({ row }) => (
        <Link
          href={`/compliance/${row.original.id}`}
          title={row.original.name}
          className="line-clamp-2 font-medium break-words whitespace-normal text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {row.original.name}
        </Link>
      ),
    },
    {
      id: FRAMEWORK_REGISTER_COLUMN_IDS.origin,
      accessorKey: 'origin',
      header: compliance.register.columns.origin,
      enableSorting: false,
      size: 170,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {compliance.originLabels[row.original.origin]}
        </span>
      ),
    },
    {
      id: FRAMEWORK_REGISTER_COLUMN_IDS.updatedAt,
      accessorKey: 'updatedAt',
      header: compliance.register.columns.updatedAt,
      enableSorting: true,
      size: 170,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatTimestampDate(row.original.updatedAt)}</span>
      ),
    },
  ];
}
