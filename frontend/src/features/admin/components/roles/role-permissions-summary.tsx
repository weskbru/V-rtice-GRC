'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { useId, useState } from 'react';

import { admin } from '@/lib/messages/admin';
import { cn } from '@/lib/utils';
import { EmptyValue } from '@vertice/design-system/components';

import { groupPermissionsByResource } from './permission-grouping';

import type { Permission } from '../../types';

export interface RolePermissionsSummaryProps {
  roleName: string;
  permissions: readonly Permission[];
  previewCount?: number;
}

export function RolePermissionsSummary({
  roleName,
  permissions,
  previewCount = 3,
}: RolePermissionsSummaryProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();

  if (permissions.length === 0) {
    return <EmptyValue>{admin.roles.permissionsSummary.none}</EmptyValue>;
  }

  const preview = permissions.slice(0, previewCount);
  const hiddenCount = permissions.length - preview.length;
  const groups = groupPermissionsByResource(permissions);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1">
        {preview.map((permission) => (
          <span
            key={permission.identifier}
            className="rounded-md border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] leading-4 text-foreground"
          >
            {permission.identifier}
          </span>
        ))}
        {hiddenCount > 0 || expanded ? (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={() => setExpanded((current) => !current)}
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            {expanded
              ? admin.roles.permissionsSummary.collapse
              : admin.roles.permissionsSummary.moreCount(hiddenCount)}
            {expanded ? (
              <ChevronUp aria-hidden="true" className="size-3" />
            ) : (
              <ChevronDown aria-hidden="true" className="size-3" />
            )}
          </button>
        ) : null}
      </div>

      {expanded ? (
        <div
          id={panelId}
          role="group"
          aria-label={admin.roles.permissionsSummary.ariaLabel(roleName)}
          className="flex max-h-72 flex-col gap-3 overflow-y-auto rounded-md border border-border bg-card p-2.5"
        >
          {groups.map((group) => (
            <div key={group.resource} className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                {group.resource}
              </span>
              <ul className="flex flex-col gap-1">
                {group.permissions.map((permission) => (
                  <li key={permission.identifier} className="flex flex-col">
                    <span className="font-mono text-xs text-foreground">
                      {permission.identifier}
                    </span>
                    <span className="text-xs text-muted-foreground">{permission.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
