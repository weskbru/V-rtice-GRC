/**
 * PharosGRC — Administration, the privilege badge
 * (015-roles-permissions-surface FR-035, ADR-021).
 *
 * A reading aid of this screen and nothing else. It is computed by
 * `isPrivilegedRole` from the permissions `GET /admin/roles` already
 * returned, it is not persisted, and no access check consults it — the
 * badge's own catalogue text says so where the reader can see it
 * (`admin.roles.privilege.explanation`).
 *
 * Colour is never the only signal (NFR-004): the badge carries a shield
 * glyph, a border of its own and — in the accessible name — a full sentence
 * saying what the label means, rather than the bare word "Privilegiado" a
 * screen-reader user would have no way to interpret.
 */
import { ShieldAlert } from 'lucide-react';

import { admin } from '@/lib/messages/admin';
import { cn } from '@/lib/utils';

export interface RolePrivilegeBadgeProps {
  /** The role's name, so the accessible name is a statement about THIS role. */
  roleName: string;
  className?: string;
}

export function RolePrivilegeBadge({
  roleName,
  className,
}: RolePrivilegeBadgeProps): React.JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-md border border-status-warning-border bg-status-warning-bg px-1.5 py-px text-xs leading-4 font-medium whitespace-nowrap text-status-warning-fg',
        className,
      )}
    >
      <ShieldAlert aria-hidden="true" className="size-3" />
      <span aria-hidden="true">{admin.roles.privilege.badge}</span>
      <span className="sr-only">{admin.roles.privilege.badgeAccessibleLabel(roleName)}</span>
    </span>
  );
}
