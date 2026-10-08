'use client';

import { EmptyValue, RiskLevelBadge, StatusBadge } from '@pharos/design-system/components';
import { CalendarClock, Hourglass } from 'lucide-react';

import { Link } from '@/components/navigation/link';
import { risks } from '@/lib/messages/risks';

import { formatDateOnly, formatTimestamp } from '../date';
import { riskStatusBadgeVariant, riskStatusLabel } from '../status';

import { PendingApprovalBadge } from './pending-approval-badge';

import type { RiskLevelBasis, RiskSummary } from '../types';
import type { ColumnDef } from '@pharos/design-system/components';

export const RISK_REGISTER_COLUMN_IDS = {
  code: 'code',
  title: 'title',
  status: 'status',
  riskLevel: 'riskLevel',
  category: 'category',
  orgUnit: 'orgUnit',
  owner: 'owner',
  nextReviewOn: 'nextReviewOn',
  lastAssessedOn: 'lastAssessedOn',
  treatment: 'treatment',
  updatedAt: 'updatedAt',
} as const;

export const RISK_REGISTER_HIDEABLE_COLUMNS: readonly { id: string; label: string }[] = [
  { id: RISK_REGISTER_COLUMN_IDS.status, label: risks.register.columns.status },
  { id: RISK_REGISTER_COLUMN_IDS.riskLevel, label: risks.register.filters.riskLevelLabel },
  { id: RISK_REGISTER_COLUMN_IDS.category, label: risks.register.columns.category },
  { id: RISK_REGISTER_COLUMN_IDS.orgUnit, label: risks.register.columns.orgUnit },
  { id: RISK_REGISTER_COLUMN_IDS.owner, label: risks.register.columns.owner },
  { id: RISK_REGISTER_COLUMN_IDS.nextReviewOn, label: risks.register.columns.nextReviewOn },
  { id: RISK_REGISTER_COLUMN_IDS.lastAssessedOn, label: risks.register.columns.lastAssessedOn },
  { id: RISK_REGISTER_COLUMN_IDS.treatment, label: risks.register.indicators.overdueTreatment },
  { id: RISK_REGISTER_COLUMN_IDS.updatedAt, label: risks.register.columns.updatedAt },
];

export interface BuildRiskRegisterColumnsOptions {
  riskLevelBasis: RiskLevelBasis;
}

function riskLevelColumnHeader(basis: RiskLevelBasis): string {
  const suffix =
    basis === 'INHERENT'
      ? risks.register.columns.riskLevelBasisSuffix.INHERENT
      : risks.register.columns.riskLevelBasisSuffix.RESIDUAL;
  return `${risks.register.filters.riskLevelLabel} (${suffix})`;
}

export function buildRiskRegisterColumns({
  riskLevelBasis,
}: BuildRiskRegisterColumnsOptions): ColumnDef<RiskSummary, unknown>[] {
  const levelField = riskLevelBasis === 'INHERENT' ? 'inherentLevel' : 'residualLevel';

  return [
    {
      id: RISK_REGISTER_COLUMN_IDS.code,
      accessorKey: 'code',
      header: risks.register.columns.code,
      enableHiding: false,
      size: 128,
      cell: ({ row }) => (
        <Link
          href={`/risks/${row.original.id}`}
          className="font-semibold text-primary-on-surface underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {row.original.code}
        </Link>
      ),
    },
    {
      id: RISK_REGISTER_COLUMN_IDS.title,
      accessorKey: 'title',
      header: risks.register.columns.title,
      enableHiding: false,
      size: 340,
      cell: ({ row }) => (
        <Link
          href={`/risks/${row.original.id}`}
          title={row.original.title}
          className="line-clamp-2 font-medium break-words whitespace-normal text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {row.original.title}
        </Link>
      ),
    },
    {
      id: RISK_REGISTER_COLUMN_IDS.status,
      accessorKey: 'status',
      header: risks.register.columns.status,
      size: 190,
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge
            variant={riskStatusBadgeVariant(row.original.status)}
            label={riskStatusLabel(row.original.status)}
          />
          <PendingApprovalBadge pending={row.original.pendingApproval} />
        </div>
      ),
    },
    {
      id: RISK_REGISTER_COLUMN_IDS.riskLevel,
      accessorFn: (row) => row[levelField] ?? '',
      header: riskLevelColumnHeader(riskLevelBasis),
      size: 190,
      cell: ({ row }) => {
        const level = row.original[levelField];
        return level ? (
          <RiskLevelBadge
            level={level}
            basis={riskLevelBasis === 'INHERENT' ? 'inherent' : 'residual'}
            labels={risks.riskLevelBadge}
          />
        ) : (
          <EmptyValue>{risks.register.columns.notSet}</EmptyValue>
        );
      },
    },
    {
      id: RISK_REGISTER_COLUMN_IDS.category,
      accessorFn: (row) => row.category?.name ?? '',
      header: risks.register.columns.category,
      enableSorting: false,
      size: 150,
      cell: ({ row }) =>
        row.original.category ? (
          <span className="text-muted-foreground">{row.original.category.name}</span>
        ) : (
          <EmptyValue>{risks.register.columns.notSet}</EmptyValue>
        ),
    },
    {
      id: RISK_REGISTER_COLUMN_IDS.orgUnit,
      accessorFn: (row) => row.orgUnit.name,
      header: risks.register.columns.orgUnit,
      enableSorting: false,
      size: 170,
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.orgUnit.name}</span>,
    },
    {
      id: RISK_REGISTER_COLUMN_IDS.owner,
      accessorFn: (row) => row.owner.fullName,
      header: risks.register.columns.owner,
      size: 170,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.owner.fullName}</span>
      ),
    },
    {
      id: RISK_REGISTER_COLUMN_IDS.nextReviewOn,
      accessorFn: (row) => row.nextReviewOn ?? '',
      header: risks.register.columns.nextReviewOn,
      size: 170,
      cell: ({ row }) => {
        const risk = row.original;
        return (
          <div className="flex flex-col gap-1">
            {risk.nextReviewOn ? (
              <span className="text-muted-foreground">{formatDateOnly(risk.nextReviewOn)}</span>
            ) : (
              <EmptyValue>{risks.register.columns.notSet}</EmptyValue>
            )}
            {risk.overdueReview ? (
              <StatusBadge
                variant="danger"
                label={risks.register.indicators.overdueReview}
                icon={CalendarClock}
                className="self-start"
              />
            ) : null}
          </div>
        );
      },
    },
    {
      id: RISK_REGISTER_COLUMN_IDS.lastAssessedOn,
      accessorFn: (row) => row.lastAssessedOn ?? '',
      header: risks.register.columns.lastAssessedOn,
      enableSorting: false,
      size: 150,
      cell: ({ row }) =>
        row.original.lastAssessedOn ? (
          <span className="text-muted-foreground">
            {formatDateOnly(row.original.lastAssessedOn)}
          </span>
        ) : (
          <EmptyValue>{risks.register.columns.notSet}</EmptyValue>
        ),
    },
    {
      id: RISK_REGISTER_COLUMN_IDS.treatment,
      accessorFn: (row) => (row.overdueTreatment ? '1' : '0'),
      header: risks.register.indicators.overdueTreatment,
      enableSorting: false,
      size: 170,
      cell: ({ row }) =>
        row.original.overdueTreatment ? (
          <StatusBadge
            variant="danger"
            label={risks.register.indicators.overdueTreatment}
            icon={Hourglass}
          />
        ) : (
          <EmptyValue>{risks.register.indicators.treatmentOnTime}</EmptyValue>
        ),
    },
    {
      id: RISK_REGISTER_COLUMN_IDS.updatedAt,
      accessorKey: 'updatedAt',
      header: risks.register.columns.updatedAt,
      size: 160,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatTimestamp(row.original.updatedAt)}</span>
      ),
    },
  ];
}
