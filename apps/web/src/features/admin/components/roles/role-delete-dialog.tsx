'use client';

import { ConfirmDialog } from '@pharos/design-system/components';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';

import { ApiError } from '@/lib/api-client';
import { admin } from '@/lib/messages/admin';
import { common } from '@/lib/messages/common';
import { roleDisplayName } from '@/lib/role-display-name';

import { adminApi } from '../../api';

import type { Role } from '../../types';

export interface RoleDeleteDialogProps {
  role: Role | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
  onError: (message: string) => void;
}

export function RoleDeleteDialog({
  role,
  onOpenChange,
  onDeleted,
  onError,
}: RoleDeleteDialogProps): React.JSX.Element {
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm(): Promise<void> {
    if (!role) return;
    setSubmitting(true);
    try {
      await adminApi.deleteRole(role.id);
      onOpenChange(false);
      onDeleted();
    } catch (error) {
      if (error instanceof ApiError && error.problem.status === 422) {
        onError(admin.roles.feedback.deleteBlockedError);
      } else {
        onError(admin.roles.feedback.genericError);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ConfirmDialog
      open={role !== null}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false);
      }}
      title={role ? admin.roles.deleteDialog.title(roleDisplayName(role.name)) : ''}
      description={admin.roles.deleteDialog.description}
      variant="destructive"
      icon={Trash2}
      isConfirming={submitting}
      onConfirm={() => void handleConfirm()}
      labels={{
        confirm: admin.roles.deleteDialog.confirm,
        cancel: common.confirmDialog.cancel,
        close: common.confirmDialog.close,
      }}
    />
  );
}
