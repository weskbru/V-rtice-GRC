'use client';

/**
 * PharosGRC — the per-target-requirement outcome table of one mapping
 * migration execution (US2, SC-004). Shared by `MappingMigrationDialog`'s
 * own result step and the migration detail page, so the same outcome
 * rendering — icon + text + colour, `PENDING_DECISION` always shown as
 * unfinished work, never as success (CLAUDE.md §18.8, §18.11) — appears
 * identically in both places.
 */
import { StatusBadge } from '@pharos/design-system/components';

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { compliance } from '@/lib/messages/compliance';

import {
  mappingMigrationOutcomeBadgeVariant,
  mappingMigrationOutcomeIcon,
  mappingMigrationOutcomeLabel,
} from '../status';

import type { MappingMigrationItem } from '../types';

export interface MappingMigrationItemsTableProps {
  items: readonly MappingMigrationItem[];
}

export function MappingMigrationItemsTable({
  items,
}: MappingMigrationItemsTableProps): React.JSX.Element {
  return (
    // `min-w-0`: this table renders inside `MappingMigrationDialog`'s
    // `DialogContent`, a CSS grid — a grid item's default `min-width: auto`
    // stops it from ever shrinking below the table's own intrinsic width,
    // so without this the table was silently clipped by the dialog's edge
    // instead of scrolling (a real, rendered defect this catalog's own
    // §18.1 loop exists to catch — caught here, not merely described).
    //
    // `table-fixed` + explicit column widths below: with the default
    // `table-layout: auto`, a `max-width`/`truncate` class on a cell is only
    // a hint the browser's content-based sizing algorithm is free to
    // ignore — confirmed rendered: the 3rd/4th columns (`Resultado`,
    // `Vínculos transportados`) were still pushed off the visible dialog
    // width after truncating the first two columns alone. `table-fixed`
    // makes the header row's own widths authoritative instead.
    <div className="min-w-0 overflow-x-auto">
      <Table className="table-fixed">
        <TableCaption className="sr-only">{compliance.mappingMigration.resultTitle}</TableCaption>
        <TableHeader>
          <TableRow>
            {/* `whitespace-normal` overrides `TableHead`'s own default `whitespace-nowrap` (`components/ui/table.tsx`) — with `table-fixed` widths this narrow, a nowrap header overflows its column and visually overlaps the next one instead of wrapping onto a second line (a real, rendered defect this table's own capture caught). */}
            <TableHead className="w-[32%] whitespace-normal">
              {compliance.mappingMigration.itemColumns.target}
            </TableHead>
            <TableHead className="w-[20%] whitespace-normal">
              {compliance.mappingMigration.itemColumns.sources}
            </TableHead>
            <TableHead className="w-[24%] whitespace-normal">
              {compliance.mappingMigration.itemColumns.outcome}
            </TableHead>
            <TableHead className="w-[24%] whitespace-normal">
              {compliance.mappingMigration.itemColumns.copiedLinkCount}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.targetRequirement.id}>
              <TableCell>
                <div
                  className="truncate font-medium text-foreground"
                  title={item.targetRequirement.title}
                >
                  {item.targetRequirement.title}
                </div>
                <div className="font-mono text-xs text-muted-foreground">
                  {item.targetRequirement.externalRef}
                </div>
              </TableCell>
              <TableCell className="truncate text-sm text-muted-foreground">
                {item.sourceRequirements.length === 0
                  ? compliance.mappingMigration.noSources
                  : item.sourceRequirements.map((source) => source.externalRef).join(', ')}
              </TableCell>
              <TableCell>
                <StatusBadge
                  variant={mappingMigrationOutcomeBadgeVariant(item.outcome)}
                  label={mappingMigrationOutcomeLabel(item.outcome)}
                  icon={mappingMigrationOutcomeIcon(item.outcome)}
                />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {item.copiedLinkCount}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
