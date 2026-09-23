import { LockKeyhole } from 'lucide-react';

import { admin } from '@/lib/messages/admin';
import { cn } from '@/lib/utils';

export interface RoleTypeTagProps {
  isSystem: boolean;
  className?: string;
}

export function RoleTypeTag({ isSystem, className }: RoleTypeTagProps): React.JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-1.5 py-px text-xs leading-4 font-medium whitespace-nowrap text-muted-foreground',
        className,
      )}
    >
      {isSystem ? <LockKeyhole aria-hidden="true" className="size-3" /> : null}
      {isSystem ? admin.roles.type.system : admin.roles.type.custom}
    </span>
  );
}
