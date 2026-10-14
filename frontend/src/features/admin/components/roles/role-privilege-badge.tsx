import { ShieldAlert } from 'lucide-react';

import { admin } from '@/lib/messages/admin';
import { cn } from '@/lib/utils';

export interface RolePrivilegeBadgeProps {
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
