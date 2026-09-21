'use client';

/**
 * PharosGRC — Administration, organizational unit tree (T183, FR-024,
 * ADR-004). Built client-side from the flat `GET /admin/org-units` list via
 * `parentId` — the contract returns units "ordered by materialized path",
 * so a stable, correctly-nested tree needs no separate traversal endpoint.
 */
import {
  Building2,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Plus,
  ShieldOff,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { admin } from '@/lib/messages/admin';
import { cn } from '@/lib/utils';

import type { OrgUnitNode } from '../../types';

/** "Sensitive" action tier (CLAUDE.md §18.11) — same tokens/reasoning as `user-admin-columns.tsx`'s identical constants. */
const SENSITIVE_ACTION_CLASS =
  'text-status-warning-fg focus:bg-status-warning-bg focus:text-status-warning-fg';
const SENSITIVE_ICON_CLASS = 'text-status-warning-fg';

export interface OrgUnitTreeNode extends OrgUnitNode {
  readonly children: readonly OrgUnitTreeNode[];
}

/** Builds a nested tree from the flat, materialized-path-ordered list — never re-sorts it, since the server already returns it in the correct display order. */
export function buildOrgUnitTree(units: readonly OrgUnitNode[]): readonly OrgUnitTreeNode[] {
  const byId = new Map<string, OrgUnitTreeNode>(
    units.map((unit) => [unit.id, { ...unit, children: [] }]),
  );
  const roots: OrgUnitTreeNode[] = [];
  for (const unit of units) {
    const node = byId.get(unit.id)!;
    if (unit.parentId && byId.has(unit.parentId)) {
      (byId.get(unit.parentId)!.children as OrgUnitTreeNode[]).push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

/** Every descendant id of `unitId`, computed from the flat list (used to size the reparent blast radius and to forbid selecting a descendant as the new parent). */
export function descendantIdsOf(
  units: readonly OrgUnitNode[],
  unitId: string,
): ReadonlySet<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const unit of units) {
    if (!unit.parentId) continue;
    const siblings = childrenByParent.get(unit.parentId) ?? [];
    siblings.push(unit.id);
    childrenByParent.set(unit.parentId, siblings);
  }
  const result = new Set<string>();
  const queue = [...(childrenByParent.get(unitId) ?? [])];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (result.has(id)) continue;
    result.add(id);
    queue.push(...(childrenByParent.get(id) ?? []));
  }
  return result;
}

export interface OrgUnitTreeProps {
  units: readonly OrgUnitNode[];
  selectedId: string | null;
  onSelect: (unit: OrgUnitNode) => void;
  canManage: boolean;
  onCreateChild: (parent: OrgUnitNode) => void;
  onEdit: (unit: OrgUnitNode) => void;
  onToggleStatus: (unit: OrgUnitNode) => void;
}

function TreeNode({
  node,
  ...rest
}: {
  node: OrgUnitTreeNode;
} & Omit<OrgUnitTreeProps, 'units'>): React.JSX.Element {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isSelected = rest.selectedId === node.id;

  return (
    <li>
      <div
        className={cn(
          'flex items-center gap-1 rounded-md py-1.5 pr-2 pl-[calc(0.5rem-2px)]',
          // Selection is carried by three independent signals — background
          // tint, a left accent bar (matching `DataTable`'s own selected/
          // focused-row convention), and bold text — never by color alone
          // (CLAUDE.md §18.8), so the current unit stays unmistakable even
          // for a reader who cannot rely on hue.
          isSelected
            ? 'border-l-2 border-primary-on-surface bg-accent text-accent-foreground'
            : 'border-l-2 border-transparent hover:bg-muted',
        )}
      >
        <button
          type="button"
          aria-label={expanded ? admin.organization.tree.collapse : admin.organization.tree.expand}
          className={cn(
            'flex size-5 shrink-0 items-center justify-center',
            !hasChildren && 'invisible',
          )}
          onClick={() => setExpanded((current) => !current)}
        >
          {hasChildren ? (
            expanded ? (
              <ChevronDown aria-hidden="true" className="size-4" />
            ) : (
              <ChevronRight aria-hidden="true" className="size-4" />
            )
          ) : null}
        </button>
        <button
          type="button"
          aria-current={isSelected ? 'true' : undefined}
          className="flex flex-1 items-center gap-2 truncate rounded-sm text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => rest.onSelect(node)}
        >
          <Building2
            aria-hidden="true"
            className={cn(
              'size-3.5 shrink-0',
              isSelected ? 'text-primary-on-surface' : 'text-muted-foreground',
            )}
          />
          <span className={cn('truncate', isSelected ? 'font-semibold' : 'font-medium')}>
            {node.name}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">{node.code}</span>
          {node.status === 'INACTIVE' ? (
            <span className="shrink-0 rounded-md border border-status-neutral-border bg-status-neutral-bg px-1.5 py-0 text-[10px] leading-4 text-status-neutral-fg">
              {admin.organization.tree.inactiveBadge}
            </span>
          ) : null}
        </button>
        {rest.canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                aria-label={admin.organization.tree.rowActionsLabel(node.name)}
              >
                <MoreHorizontal aria-hidden="true" className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => rest.onCreateChild(node)}>
                <Plus aria-hidden="true" className="size-4" />
                {admin.organization.tree.createChildAction}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => rest.onEdit(node)}>
                {admin.organization.tree.edit}
              </DropdownMenuItem>
              {/* Deactivating a unit is reversible but immediately changes who can select it for new risks/users (task brief) — carried in the amber "sensitive" tone, distinct from an ordinary edit above and from the true deletions in Users/Roles (CLAUDE.md §18.11). */}
              <DropdownMenuItem
                className={node.status === 'ACTIVE' ? SENSITIVE_ACTION_CLASS : undefined}
                onSelect={() => rest.onToggleStatus(node)}
              >
                {node.status === 'ACTIVE' ? (
                  <ShieldOff aria-hidden="true" className={SENSITIVE_ICON_CLASS} />
                ) : null}
                {node.status === 'ACTIVE'
                  ? admin.organization.tree.deactivate
                  : admin.organization.tree.activate}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      {hasChildren && expanded ? (
        // Each nesting level is a real, nested `<ul>` inside this `<li>` — the
        // indent and its vertical guide line compound naturally with depth
        // (no manual `depth * Nrem` arithmetic to keep in sync), and the
        // guide visually ties every child back to the parent row it hangs
        // from, which a per-row `padding-left` alone cannot communicate once
        // a unit has siblings at the same depth (CLAUDE.md §18.11 — hierarchy
        // must be legible, not just indented).
        <ul className="ml-[0.7rem] flex flex-col gap-0.5 border-l border-border pl-3">
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} {...rest} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function OrgUnitTree({ units, ...rest }: OrgUnitTreeProps): React.JSX.Element {
  const tree = useMemo(() => buildOrgUnitTree(units), [units]);

  if (units.length === 0) {
    return <p className="text-sm text-muted-foreground">{admin.organization.tree.empty}</p>;
  }

  return (
    <ul aria-label={admin.organization.tree.ariaLabel} className="flex flex-col gap-0.5">
      {tree.map((node) => (
        <TreeNode key={node.id} node={node} {...rest} />
      ))}
    </ul>
  );
}
