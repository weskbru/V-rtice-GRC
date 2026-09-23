'use client';

import { StatusBadge } from '@pharos/design-system/components';
import { AlertTriangle } from 'lucide-react';

import { Link } from '@/components/navigation/link';
import { actions } from '@/lib/messages/actions';

import { formatDateOnly } from '../../risks/date';
import { actionOriginHref } from '../origin';
import { actionStatusBadgeVariant, actionStatusLabel } from '../status';

import { ActionRowMenu } from './action-row-menu';

import type { Action, ActionStatus } from '../types';
import type { ColumnDef } from '@pharos/design-system/components';

export const MY_ACTIONS_COLUMN_IDS = {
  code: 'code',
  title: 'title',
  origin: 'origin',
  responsible: 'responsible',
  dueOn: 'dueOn',
  status: 'status',
  rowActions: 'rowActions',
} as const;

export interface BuildMyActionsColumnsOptions {
  canEdit: boolean;
  onTransition: (action: Action, to: ActionStatus) => void;
  onReopenRequest: (action: Action) => void;
}

export function buildMyActionsColumns({
  canEdit,
  onTransition,
  onReopenRequest,
}: BuildMyActionsColumnsOptions): ColumnDef<Action, unknown>[] {
  return [
    {
      id: MY_ACTIONS_COLUMN_IDS.code,
      accessorKey: 'code',
      header: actions.myActions.columns.code,
      enableHiding: false,
      enableSorting: false,
      size: 112,
      cell: ({ row }) => (
        <Link
          href={`/actions/${row.original.id}`}
          className="font-semibold text-primary-on-surface underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {row.original.code}
        </Link>
      ),
    },
    {
      id: MY_ACTIONS_COLUMN_IDS.title,
      accessorKey: 'title',
      header: actions.myActions.columns.title,
      enableHiding: false,
      enableSorting: false,
      size: 260,
      cell: ({ row }) => (
        <span
          title={row.original.title}
          className="line-clamp-2 font-medium break-words whitespace-normal text-foreground"
        >
          {row.original.title}
        </span>
      ),
    },
    {
      id: MY_ACTIONS_COLUMN_IDS.origin,
      accessorFn: (row) => row.originLabel ?? actions.originTypeLabels[row.originType],
      header: actions.myActions.columns.origin,
      enableSorting: false,
      size: 190,
      cell: ({ row }) => {
        const label = row.original.originLabel ?? actions.originTypeLabels[row.original.originType];
        const href = actionOriginHref(row.original.originType, row.original.originId);
        if (href) {
          return (
            <Link
              href={href}
              className="text-primary-on-surface underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {label}
            </Link>
          );
        }
        return <span className="text-muted-foreground">{label}</span>;
      },
    },
    {
      id: MY_ACTIONS_COLUMN_IDS.responsible,
      accessorFn: (row) => row.responsible.fullName,
      header: actions.myActions.columns.responsible,
      enableSorting: false,
      size: 150,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.responsible.fullName}</span>
      ),
    },
    {
      id: MY_ACTIONS_COLUMN_IDS.dueOn,
      accessorKey: 'dueOn',
      header: actions.myActions.columns.dueOn,
      enableSorting: false,
      size: 150,
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground">{formatDateOnly(row.original.dueOn)}</span>
          {row.original.overdue ? (
            <StatusBadge
              variant="danger"
              label={actions.myActions.indicators.overdue}
              icon={AlertTriangle}
              className="self-start"
            />
          ) : null}
        </div>
      ),
    },
    {
      id: MY_ACTIONS_COLUMN_IDS.status,
      accessorKey: 'status',
      header: actions.myActions.columns.status,
      enableSorting: false,
      size: 130,
      cell: ({ row }) => (
        <StatusBadge
          variant={actionStatusBadgeVariant(row.original.status)}
          label={actionStatusLabel(row.original.status)}
        />
      ),
    },
    ...(canEdit
      ? [
          {
            id: MY_ACTIONS_COLUMN_IDS.rowActions,
            header: actions.myActions.columns.actions,
            enableSorting: false,
            enableHiding: false,
            size: 56,
            cell: ({ row }: { row: { original: Action } }) => (
              <ActionRowMenu
                action={row.original}
                onTransition={onTransition}
                onReopenRequest={onReopenRequest}
              />
            ),
          } satisfies ColumnDef<Action, unknown>,
        ]
      : []),
  ];
}
