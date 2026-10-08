'use client';

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
    <div className="min-w-0 overflow-x-auto">
      <Table className="table-fixed">
        <TableCaption className="sr-only">{compliance.mappingMigration.resultTitle}</TableCaption>
        <TableHeader>
          <TableRow>
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
