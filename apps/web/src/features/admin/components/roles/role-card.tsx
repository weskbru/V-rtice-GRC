'use client';

import { ChevronRight, KeyRound, ShieldCheck } from 'lucide-react';

import { admin } from '@/lib/messages/admin';
import { roleDisplayName } from '@/lib/role-display-name';
import { cn } from '@/lib/utils';

import { roleModuleReach } from './role-filtering';
import { isPrivilegedRole } from './role-privilege';
import { RolePrivilegeBadge } from './role-privilege-badge';
import { RoleTypeTag } from './role-type-tag';

import type { Role } from '../../types';

const MODULE_PREVIEW_COUNT = 3;

export interface RoleCardProps {
  role: Role;
  selected: boolean;
  onSelect: (role: Role) => void;
}

export function RoleCard({ role, selected, onSelect }: RoleCardProps): React.JSX.Element {
  const messages = admin.roles.card;
  const privileged = isPrivilegedRole(role);
  const displayName = roleDisplayName(role.name);
  const modules = roleModuleReach(role);
  const visibleModules = modules.slice(0, MODULE_PREVIEW_COUNT);
  const hiddenModuleCount = modules.length - visibleModules.length;
  const RoleIcon = privileged ? ShieldCheck : KeyRound;

  return (
    <li>
      <button
        type="button"
        aria-current={selected ? 'true' : undefined}
        onClick={() => onSelect(role)}
        className={cn(
          'flex w-full flex-col gap-3 rounded-lg border border-l-4 border-border bg-card p-4 text-left transition-colors sm:flex-row sm:items-start',
          'hover:border-l-primary/60 hover:bg-muted/40',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          selected
            ? 'border-primary border-l-primary bg-accent/50 dark:bg-accent/25'
            : 'border-l-border',
        )}
      >
        <span className="sr-only">{messages.openLabel(displayName)}</span>

        <span className="flex min-w-0 flex-1 items-start gap-3">
          <span
            aria-hidden="true"
            className={cn(
              'mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md',
              selected ? 'bg-primary/15 text-primary-on-surface' : 'bg-muted text-muted-foreground',
            )}
          >
            <RoleIcon className="size-4" />
          </span>

          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-sm font-semibold text-foreground">{displayName}</span>
              <RoleTypeTag isSystem={role.isSystem} />
              {privileged ? <RolePrivilegeBadge roleName={displayName} /> : null}
            </span>

            <span className="line-clamp-2 text-sm leading-5 text-muted-foreground">
              {role.description === '' ? messages.noDescription : role.description}
            </span>

            {modules.length > 0 ? (
              <>
                <span aria-hidden="true" className="flex flex-wrap items-center gap-1 pt-0.5">
                  {visibleModules.map((module) => (
                    <span
                      key={module.area}
                      className="inline-flex items-center rounded-md border border-border bg-muted/60 px-1.5 py-px text-xs leading-4 whitespace-nowrap text-muted-foreground"
                    >
                      {module.label}
                    </span>
                  ))}
                  {hiddenModuleCount > 0 ? (
                    <span className="inline-flex items-center px-0.5 text-xs leading-4 whitespace-nowrap text-muted-foreground tabular-nums">
                      {messages.moreModules(hiddenModuleCount)}
                    </span>
                  ) : null}
                </span>
                <span className="sr-only">
                  {messages.modulesAccessibleLabel(
                    modules.map((module) => module.label).join(', '),
                  )}
                </span>
              </>
            ) : (
              <span className="pt-0.5 text-xs text-muted-foreground">{messages.noModules}</span>
            )}
          </span>
        </span>

        <span className="flex shrink-0 items-center justify-between gap-3 sm:justify-end sm:self-center">
          <span className="flex flex-row items-baseline gap-3 sm:flex-col sm:items-end sm:gap-0.5 sm:text-right">
            <span className="text-sm font-medium text-foreground tabular-nums">
              {role.permissions.length === 0
                ? messages.noPermissions
                : messages.permissionCount(role.permissions.length)}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {role.assignedUserCount === 0
                ? messages.noUsers
                : messages.userCount(role.assignedUserCount)}
            </span>
            {selected ? (
              <span className="text-xs font-medium text-primary-on-surface">
                {messages.selectedLabel}
              </span>
            ) : null}
          </span>
          <ChevronRight
            aria-hidden="true"
            className={cn(
              'size-4 shrink-0',
              selected ? 'text-primary-on-surface' : 'text-muted-foreground',
            )}
          />
        </span>
      </button>
    </li>
  );
}
