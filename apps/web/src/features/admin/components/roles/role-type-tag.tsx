/**
 * PharosGRC — Administration, the role-kind tag (roles screen refinement).
 *
 * Deliberately quiet: a neutral outline tag, never a tinted status badge. The
 * kind of a role is a property to notice, not an alert — the former info-blue
 * "Papel do sistema" badge wrapped onto two lines under every name and was the
 * loudest element on a screen where eleven of twelve rows carried it. Both
 * kinds are labelled in text (never told apart by the absence of a tag), and
 * the system kind also carries a lock glyph, so the distinction survives
 * without colour (CLAUDE.md §18.8).
 */
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
