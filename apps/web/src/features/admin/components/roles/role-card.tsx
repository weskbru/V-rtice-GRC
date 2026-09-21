'use client';

/**
 * PharosGRC — Administration, one role as a card
 * (015-roles-permissions-surface FR-006 to FR-008, D-03, T032).
 *
 * The card replaces the table row `specs/012-admin-roles-screen/STATE.md`
 * §2.1 chose, and the reversal is registered in `spec.md` D-03 rather than
 * made silently. The reason the row stopped fitting is measurable: a role
 * now carries five dimensions — kind, privilege, description, the modules
 * it reaches, and two counts — and the modules are variable-width chips.
 * Chips inside a table cell are precisely the horizontal overflow F-66
 * records and NFR-005 forbids at 390 px.
 *
 * ## The whole card is the control
 *
 * There is nothing else interactive inside it, so the card IS a `<button>`
 * rather than a box with a link buried in it: one target, reachable by Tab
 * in list order, with the platform's focus ring. `aria-current` — not
 * `aria-pressed` — marks the selected one, because selecting a second card
 * replaces the selection rather than toggling this one off.
 *
 * Selection is signalled by four things, never by colour alone (NFR-004):
 * `aria-current`, a 4px left accent, a tinted surface, and the words
 * "Papel selecionado" printed in the card.
 */
import { ChevronRight, KeyRound, ShieldCheck } from 'lucide-react';

import { admin } from '@/lib/messages/admin';
import { roleDisplayName } from '@/lib/role-display-name';
import { cn } from '@/lib/utils';

import { roleModuleReach } from './role-filtering';
import { isPrivilegedRole } from './role-privilege';
import { RolePrivilegeBadge } from './role-privilege-badge';
import { RoleTypeTag } from './role-type-tag';

import type { Role } from '../../types';

/** Module chips printed before the rest collapse into "+N módulos" — whole names only, never cut mid-word. */
const MODULE_PREVIEW_COUNT = 3;

export interface RoleCardProps {
  role: Role;
  selected: boolean;
  onSelect: (role: Role) => void;
}

export function RoleCard({ role, selected, onSelect }: RoleCardProps): React.JSX.Element {
  const messages = admin.roles.card;
  const privileged = isPrivilegedRole(role);
  // ADR-022 — the pt-BR name for a seeded role, the stored name unchanged for
  // a custom one. `role.name` itself is never sent anywhere from here.
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
          // Column below `sm`, row above: at 390 px a fixed side column for
          // the two counts left the name roughly 160 px, and a role name and
          // "17 permissões" cannot both hold a line there. Stacking is what
          // keeps the page from scrolling sideways (NFR-005).
          'flex w-full flex-col gap-3 rounded-lg border border-l-4 border-border bg-card p-4 text-left transition-colors sm:flex-row sm:items-start',
          'hover:border-l-primary/60 hover:bg-muted/40',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          selected
            ? 'border-primary border-l-primary bg-accent/50 dark:bg-accent/25'
            : 'border-l-border',
        )}
      >
        {/*
         * What activating the card DOES, first in its accessible name. As
         * `sr-only` content rather than `aria-label`, which would replace
         * the whole subtree and take the role's name, kind, module reach
         * and both counts out of the accessible name with it.
         */}
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

            {/*
             * Clamped to two lines for scanning only (FR-008). The stored
             * text is never altered, it stays whole in the DOM for assistive
             * technology, and the panel shows it in full.
             */}
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
                {/* FR-007 — the visible chips are capped; the complete list is never withheld from a screen reader. */}
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
