'use client';

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega ao abrir outro usuário; `onError` é estável.
  }, [user]);

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
