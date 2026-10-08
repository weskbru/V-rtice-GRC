'use client';

import { EmptyValue, StatusBadge } from '@pharos/design-system/components';

import { Link } from '@/components/navigation/link';
import { controls } from '@/lib/messages/controls';

import { formatTimestamp } from '../date';
import {
  controlEffectivenessBadgeVariant,
  controlEffectivenessIcon,
  controlEffectivenessLabel,
  controlStatusBadgeVariant,
  controlStatusIcon,
  controlStatusLabel,
} from '../status';

import type { ControlSummary } from '../types';
import type { ColumnDef } from '@pharos/design-system/components';

export const CONTROL_REGISTER_COLUMN_IDS = {
  code: 'code',
  name: 'name',
  status: 'status',
  effectiveness: 'effectiveness',
  nature: 'nature',
  type: 'type',
  frequency: 'frequency',
  orgUnit: 'orgUnit',
  owner: 'owner',
  updatedAt: 'updatedAt',
} as const;

export const CONTROL_REGISTER_HIDEABLE_COLUMNS: readonly { id: string; label: string }[] = [
  { id: CONTROL_REGISTER_COLUMN_IDS.status, label: controls.register.columns.status },
  { id: CONTROL_REGISTER_COLUMN_IDS.effectiveness, label: controls.register.columns.effectiveness },
  { id: CONTROL_REGISTER_COLUMN_IDS.nature, label: controls.register.columns.nature },
  { id: CONTROL_REGISTER_COLUMN_IDS.type, label: controls.register.columns.type },
  { id: CONTROL_REGISTER_COLUMN_IDS.frequency, label: controls.register.columns.frequency },
  { id: CONTROL_REGISTER_COLUMN_IDS.orgUnit, label: controls.register.columns.orgUnit },
  { id: CONTROL_REGISTER_COLUMN_IDS.owner, label: controls.register.columns.owner },
  { id: CONTROL_REGISTER_COLUMN_IDS.updatedAt, label: controls.register.columns.updatedAt },
];

export function buildControlRegisterColumns(): ColumnDef<ControlSummary, unknown>[] {
  return [
    {
      id: CONTROL_REGISTER_COLUMN_IDS.code,
      accessorKey: 'code',
      header: controls.register.columns.code,
      enableHiding: false,
      size: 128,
      cell: ({ row }) => (
        <Link
          href={`/controls/${row.original.id}`}
          className="font-semibold text-primary-on-surface underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {row.original.code}
        </Link>
      ),
    },
    {
      id: CONTROL_REGISTER_COLUMN_IDS.name,
      accessorKey: 'name',
      header: controls.register.columns.name,
      enableHiding: false,
      size: 320,
      cell: ({ row }) => (
        <Link
          href={`/controls/${row.original.id}`}
          title={row.original.name}
          className="line-clamp-2 font-medium break-words whitespace-normal text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {row.original.name}
        </Link>
      ),
    },
    {
      id: CONTROL_REGISTER_COLUMN_IDS.status,
      accessorKey: 'status',
      header: controls.register.columns.status,
      size: 160,
      cell: ({ row }) => (
        <StatusBadge
          variant={controlStatusBadgeVariant(row.original.status)}
          label={controlStatusLabel(row.original.status)}
          icon={controlStatusIcon(row.original.status)}
        />
      ),
    },
    {
      id: CONTROL_REGISTER_COLUMN_IDS.effectiveness,
      accessorKey: 'effectiveness',
      header: controls.register.columns.effectiveness,
      size: 190,
      cell: ({ row }) => (
        <StatusBadge
          variant={controlEffectivenessBadgeVariant(row.original.effectiveness)}
          label={controlEffectivenessLabel(row.original.effectiveness)}
          icon={controlEffectivenessIcon(row.original.effectiveness)}
        />
      ),
    },
    {
      id: CONTROL_REGISTER_COLUMN_IDS.nature,
      accessorFn: (row) => row.nature ?? '',
      header: controls.register.columns.nature,
      enableSorting: false,
      size: 130,
      cell: ({ row }) =>
        row.original.nature ? (
          <span className="text-muted-foreground">
            {controls.natureLabels[row.original.nature]}
          </span>
        ) : (
          <EmptyValue>{controls.register.columns.notSet}</EmptyValue>
        ),
    },
    {
      id: CONTROL_REGISTER_COLUMN_IDS.type,
      accessorFn: (row) => row.type ?? '',
      header: controls.register.columns.type,
      enableSorting: false,
      size: 130,
      cell: ({ row }) =>
        row.original.type ? (
          <span className="text-muted-foreground">{controls.typeLabels[row.original.type]}</span>
        ) : (
          <EmptyValue>{controls.register.columns.notSet}</EmptyValue>
        ),
    },
    {
      id: CONTROL_REGISTER_COLUMN_IDS.frequency,
      accessorFn: (row) => row.frequency ?? '',
      header: controls.register.columns.frequency,
      enableSorting: false,
      size: 130,
      cell: ({ row }) =>
        row.original.frequency ? (
          <span className="text-muted-foreground">
            {controls.frequencyLabels[row.original.frequency]}
          </span>
        ) : (
          <EmptyValue>{controls.register.columns.notSet}</EmptyValue>
        ),
    },
    {
      id: CONTROL_REGISTER_COLUMN_IDS.orgUnit,
      accessorFn: (row) => row.orgUnit?.name ?? '',
      header: controls.register.columns.orgUnit,
      enableSorting: false,
      size: 170,
      cell: ({ row }) =>
        row.original.orgUnit ? (
          <span className="text-muted-foreground">{row.original.orgUnit.name}</span>
        ) : (
          <EmptyValue>{controls.register.columns.notSet}</EmptyValue>
        ),
    },
    {
      id: CONTROL_REGISTER_COLUMN_IDS.owner,
      accessorFn: (row) => row.owner?.fullName ?? '',
      header: controls.register.columns.owner,
      size: 170,
      cell: ({ row }) =>
        row.original.owner ? (
          <span className="text-muted-foreground">{row.original.owner.fullName}</span>
        ) : (
          <EmptyValue>{controls.register.card.noOwner}</EmptyValue>
        ),
    },
    {
      id: CONTROL_REGISTER_COLUMN_IDS.updatedAt,
      accessorKey: 'updatedAt',
      header: controls.register.columns.updatedAt,
      size: 160,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatTimestamp(row.original.updatedAt)}</span>
      ),
    },
  ];
}
