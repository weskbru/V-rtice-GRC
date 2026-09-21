'use client';

/**
 * PharosGRC — risk register column definitions (T111, FR-087, FR-091).
 *
 * `enableSorting` is set to `false` on every column whose field is absent
 * from `GET /risks`'s `sort` enum (`code, title, riskLevel, status, owner,
 * nextReviewOn, identifiedOn, updatedAt` — risks.openapi.yaml) — the UI
 * never offers a sort the server would reject (a documented pitfall for
 * this task). `identifiedOn` itself has no register column at all: it is
 * sortable per the contract but is not one of `RiskSummary`'s own fields
 * (only `RiskDetail` carries it), so there is nothing honest to render in a
 * column for it (SC-013) — offering a sort control with no visible value
 * driving it would be more confusing than omitting it.
 *
 * The risk-level column's header and cell both make the active
 * `riskLevelBasis` explicit (`residual` vs. `inherent`, ADR-006) rather than
 * leaving "risk level" ambiguous — see `risk-level-basis` threaded in from
 * `buildRiskRegisterColumns`'s options.
 *
 * FR-091's non-color-alone requirement is met by composition: `StatusBadge`
 * and `RiskLevelBadge` (both `@pharos/design-system`) already pair an icon,
 * a text label and a color together for every value, including high/critical
 * risk levels; the overdue indicators below reuse `StatusBadge` for the same
 * reason rather than inventing a new colored-dot pattern.
 */
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

/** Columns eligible for `ColumnVisibilityMenu` — code/title stay always visible (`enableHiding: false` below), so they are deliberately excluded here. */
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
  /** Which derived level the risk-level column shows and labels (ADR-006) — never left implicit. */
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
              // `self-start` — F-80 (docs/deferred-findings.md, resolved
              // 022-asset-detail-experience): a `flex flex-col` parent
              // stretches a child with no intrinsic width to its own full
              // width by default. Without this, the badge stretched to the
              // full column width (confirmed by render: 154px badge inside
              // a 154px container) instead of a compact pill.
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
      /*
       * A boolean indicator, not a value that can be missing: "Tratamento
       * vencido: Não definido" said the deadline was unknown, when what the
       * row actually knows is that the treatment is NOT overdue. The quiet
       * state now says exactly that (`EmptyValue`'s smaller, italic
       * treatment keeps it from competing with the rows that do need
       * attention), and the overdue state keeps its badge.
       */
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
