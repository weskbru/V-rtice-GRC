'use client';

/**
 * PharosGRC — Administration, assign roles to a user (T181, FR-023,
 * FR-028). Replaces the complete set (contract: `PUT
 * /admin/users/{userId}/roles`), takes effect on the user's NEXT request —
 * stated here so an administrator does not expect an already-open session
 * to change immediately (task brief, FR-028).
 */
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { admin } from '@/lib/messages/admin';
import { roleDisplayName } from '@/lib/role-display-name';

import { adminApi } from '../../api';
import { RolePermissionsSummary } from '../roles/role-permissions-summary';

import type { AdminUser, Role, UserRoleAssignment } from '../../types';

export interface UserRolesDialogProps {
  user: AdminUser | null;
  onOpenChange: (open: boolean) => void;
  /**
   * Receives the operation's own minimized result (F-73) — the subject id
   * and its resulting role set — never the administrative user record. The
   * route is gated by `role:administer`, which does not imply
   * `user:administer`, so there is no personal data here to hand on.
   */
  onSaved: (assignment: UserRoleAssignment) => void;
  onError: (message: string) => void;
}

export function UserRolesDialog({
  user,
  onOpenChange,
  onSaved,
  onError,
}: UserRolesDialogProps): React.JSX.Element {
  const [roles, setRoles] = useState<readonly Role[] | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    // A5-F02 — `GET /admin/roles` has no name search, only `page`/`pageSize`
    // (`admin.openapi.yaml`), so this dialog cannot switch to a searched
    // lookup the way a user picker does (S-10) — it must instead exhaust
    // every page. Each module GRC futuro seeds its own roles (CLAUDE.md
    // §1), so the catalog is small and grows slowly; paginating it in full
    // once, per dialog open, is the correct fix here, not a bounded first
    // page a role beyond it could never be assigned from.
    async function loadAllRoles(): Promise<readonly Role[]> {
      const collected: Role[] = [];
      let page = 1;
      for (;;) {
        const result = await adminApi.listRoles(page, 100);
        collected.push(...result.data);
        if (page >= result.meta.totalPages) break;
        page += 1;
      }
      return collected;
    }

    loadAllRoles()
      .then((allRoles) => {
        if (cancelled) return;
        setRoles(allRoles);
        // Set together with `roles`, from the SAME successful response, so
        // the checklist never briefly renders roles with a stale `selected`
        // computed from a previous target user.
        setSelected(new Set(user.roles.map((role) => role.id)));
      })
      .catch(() => {
        if (!cancelled) onError(admin.roles.feedback.loadError);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reloads only when a new target user opens the dialog; `onError` is a stable callback prop.
  }, [user]);

  // Resets on CLOSE, not via an effect on `open`/`user` becoming true — this
  // dialog stays mounted across different target users (unlike
  // `UserEditDialog`, which the parent only mounts per-target) — mirrors
  // `TransitionConfirmDialog`'s identical convention
  // (`apps/web/src/features/risks/components/risk-lifecycle-actions.tsx`).
  function handleOpenChange(next: boolean): void {
    if (submitting) return;
    if (!next) {
      setRoles(null);
      setSelected(new Set());
      setLoading(true);
    }
    onOpenChange(next);
  }

  function toggle(roleId: string): void {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(roleId)) {
        next.delete(roleId);
      } else {
        next.add(roleId);
      }
      return next;
    });
  }

  async function handleSubmit(): Promise<void> {
    if (!user) return;
    setSubmitting(true);
    try {
      const updated = await adminApi.replaceUserRoles(user.id, { roleIds: Array.from(selected) });
      handleOpenChange(false);
      onSaved(updated);
    } catch {
      onError(admin.users.feedback.genericError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={user !== null} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{user ? admin.users.rolesDialog.title(user.fullName) : ''}</DialogTitle>
          <DialogDescription>{admin.users.rolesDialog.description}</DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[26rem] flex-col gap-4 overflow-y-auto">
          {loading ? (
            <p className="text-sm text-muted-foreground">…</p>
          ) : roles && roles.length > 0 ? (
            roles.map((role) => (
              <div key={role.id} className="flex items-start gap-2">
                <Checkbox
                  id={`role-${role.id}`}
                  checked={selected.has(role.id)}
                  onCheckedChange={() => toggle(role.id)}
                  disabled={submitting}
                />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor={`role-${role.id}`} className="flex flex-col gap-0.5 font-normal">
                    <span className="font-medium text-foreground">
                      {roleDisplayName(role.name)}
                    </span>
                    <span className="text-sm text-muted-foreground">{role.description}</span>
                  </Label>
                  {/* Legibility, not just names: a reader deciding whether to grant this role sees WHAT it grants right here, without leaving this dialog (task brief — "a role is a set of permissions"). */}
                  <RolePermissionsSummary
                    roleName={roleDisplayName(role.name)}
                    permissions={role.permissions}
                  />
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">{admin.users.rolesDialog.noRoles}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => handleOpenChange(false)}
          >
            {admin.users.form.cancel}
          </Button>
          <Button
            type="button"
            disabled={submitting || loading}
            onClick={() => void handleSubmit()}
          >
            {submitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
            {submitting ? admin.users.rolesDialog.submitting : admin.users.rolesDialog.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
