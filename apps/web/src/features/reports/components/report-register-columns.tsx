'use client';

/**
 * PharosGRC — report catalog column definitions (009-indicators-reports, T061), mirroring
 * `features/incidents/components/incident-register-columns.tsx` (CLAUDE.md §18.12).
 *
 * Every column has `enableSorting: false` — `listReportDefinitions` declares no `sort` parameter
 * at all (`contracts/reports.openapi.yaml`), unlike `GET /incidents`.
 *
 * The row-actions column takes `onRun` as a parameter (mirrors `features/actions/components/
 * my-actions-columns.tsx`'s own `BuildMyActionsColumnsOptions` shape) rather than a bare `Link` —
 * there is no `GET /reports/{reportId}` to route a detail page to (`ReportController`'s own header
 * comment: that operation is declared in the contract but deliberately not implemented), so
 * "Executar" opens `ReportRunDialog` with the row's own already-loaded `ReportDefinition` instead
 * of navigating anywhere.
 *
 * ## Código folds into the Nome cell, rather than a column of its own
 *
 * Unlike Risks/Assets/Processes, `code` here is never a link target (no detail route exists — see
 * above), so the family's usual "narrow leading code column, wide title column" split has nothing
 * to anchor the code column ON: it would just be inert text competing with the name for attention.
 * `code` instead renders as a small caption ABOVE `name` inside ONE cell — the coordinator's
 * "code as a small line above/beside the name" option — which both reads as a single identified
 * row (code, then what it's called) and returns the freed column budget to Descrição, the field
 * that actually needs it. Screen readers still get both strings, in that order, as one cell's text
 * content; nothing here removes `code` from the accessible tree, only from the header row.
 *
 * ## Métricas: the count is always visible, the metric names are a keyboard/AT-reachable disclosure
 *
 * `reports.register.metricCountLabel` renders the compact "N indicadores" text every row shows.
 * When there is at least one, that text sits inside a `PopoverTrigger` button — Radix's own
 * `aria-haspopup`/`aria-expanded` wiring makes it operable by keyboard (Enter/Space to open,
 * Escape to close) and announced by a screen reader exactly like any other disclosure, never a
 * hover-only affordance (CLAUDE.md §18.8). Its content lists each metric's real pt-BR label from
 * `indicators.metricKeyLabels` — the owning catalog (`lib/messages/indicators.ts`'s own header) —
 * reused here, never re-declared.
 */
import { StatusBadge } from '@pharos/design-system/components';
import { ChevronDown, Play } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { indicators } from '@/lib/messages/indicators';
import { reports } from '@/lib/messages/reports';

import { formatTimestamp } from '../date';
import { reportSituationLabel, reportSituationVariant } from '../situation';

import type { ReportDefinition } from '../types';
import type { ColumnDef } from '@pharos/design-system/components';

export const REPORT_REGISTER_COLUMN_IDS = {
  name: 'name',
  description: 'description',
  metrics: 'metrics',
  situation: 'situation',
  createdBy: 'createdBy',
  createdAt: 'createdAt',
  rowActions: 'rowActions',
} as const;

export interface BuildReportRegisterColumnsOptions {
  onRun: (report: ReportDefinition) => void;
}

export function buildReportRegisterColumns({
  onRun,
}: BuildReportRegisterColumnsOptions): ColumnDef<ReportDefinition, unknown>[] {
  const columns = reports.register.columns;

  return [
    {
      id: REPORT_REGISTER_COLUMN_IDS.name,
      accessorKey: 'name',
      header: columns.name,
      enableSorting: false,
      enableHiding: false,
      size: 220,
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">{row.original.code}</span>
          <span
            title={row.original.name}
            className="line-clamp-2 font-semibold break-words whitespace-normal text-foreground"
          >
            {row.original.name}
          </span>
        </div>
      ),
    },
    {
      id: REPORT_REGISTER_COLUMN_IDS.description,
      accessorKey: 'description',
      header: columns.description,
      enableSorting: false,
      size: 230,
      cell: ({ row }) => (
        <span
          title={row.original.description}
          className="line-clamp-2 break-words whitespace-normal text-muted-foreground"
        >
          {row.original.description}
        </span>
      ),
    },
    {
      id: REPORT_REGISTER_COLUMN_IDS.metrics,
      accessorFn: (row) => row.metricKeys.length,
      header: columns.metrics,
      enableSorting: false,
      size: 140,
      cell: ({ row }) => {
        const metricKeys = row.original.metricKeys;
        if (metricKeys.length === 0) {
          return <span className="text-xs text-muted-foreground italic">{columns.notSet}</span>;
        }
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="text-muted-foreground hover:text-foreground"
              >
                {reports.register.metricCountLabel(metricKeys.length)}
                <ChevronDown aria-hidden="true" className="size-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="start">
              <PopoverTitle>{reports.register.metricsPopoverTitle}</PopoverTitle>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-foreground">
                {metricKeys.map((key) => (
                  <li key={key}>{indicators.metricKeyLabels[key]}</li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>
        );
      },
    },
    {
      id: REPORT_REGISTER_COLUMN_IDS.situation,
      accessorKey: 'isActive',
      header: columns.situation,
      enableSorting: false,
      size: 100,
      cell: ({ row }) => (
        <StatusBadge
          variant={reportSituationVariant(row.original.isActive)}
          label={reportSituationLabel(row.original.isActive)}
        />
      ),
    },
    {
      id: REPORT_REGISTER_COLUMN_IDS.createdBy,
      accessorFn: (row) => row.createdBy.fullName,
      header: columns.createdBy,
      enableSorting: false,
      size: 130,
      cell: ({ row }) => (
        <span
          title={row.original.createdBy.fullName}
          className="line-clamp-2 text-sm break-words text-muted-foreground"
        >
          {row.original.createdBy.fullName}
        </span>
      ),
    },
    {
      id: REPORT_REGISTER_COLUMN_IDS.createdAt,
      accessorKey: 'createdAt',
      header: columns.createdAt,
      enableSorting: false,
      size: 120,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatTimestamp(row.original.createdAt)}
        </span>
      ),
    },
    {
      id: REPORT_REGISTER_COLUMN_IDS.rowActions,
      header: columns.actions,
      enableSorting: false,
      enableHiding: false,
      size: 110,
      cell: ({ row }) => (
        <Button type="button" variant="outline" size="sm" onClick={() => onRun(row.original)}>
          <Play aria-hidden="true" className="size-3.5" />
          {reports.register.runAction}
        </Button>
      ),
    },
  ];
}
