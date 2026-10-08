'use client';

import { ConfirmDialog } from '@pharos/design-system/components';
import { Power, ShieldOff } from 'lucide-react';
import { useState } from 'react';

import { admin } from '@/lib/messages/admin';
import { common } from '@/lib/messages/common';

import type { AdminUser, AdminUserDetail } from '../../types';

export interface UserStatusDialogProps {
  user: AdminUser | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (user: AdminUser) => Promise<AdminUserDetail>;
  onChanged: (user: AdminUserDetail) => void;
  onError: (message: string) => void;
}

export function UserStatusDialog({
  user,
  onOpenChange,
  onConfirm,
  onChanged,
  onError,
}: UserStatusDialogProps): React.JSX.Element {
  const [submitting, setSubmitting] = useState(false);
  const activating = user?.status === 'INACTIVE';

  async function handleConfirm(): Promise<void> {
    if (!user) return;
    setSubmitting(true);
    try {
      const updated = await onConfirm(user);
      onChanged(updated);
    } catch {
      onError(admin.users.feedback.genericError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ConfirmDialog
      open={user !== null}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false);
      }}
      title={
        user
          ? activating
            ? admin.users.statusDialog.activateTitle
            : admin.users.statusDialog.deactivateTitle
          : ''
      }
      description={
        user
          ? activating
            ? admin.users.statusDialog.activateDescription(user.fullName)
            : admin.users.statusDialog.deactivateDescription(user.fullName)
          : ''
      }
      variant={activating ? 'default' : 'sensitive'}
      icon={activating ? Power : ShieldOff}
      isConfirming={submitting}
      onConfirm={() => void handleConfirm()}
      labels={{
        confirm: activating
          ? admin.users.statusDialog.confirmActivate
          : admin.users.statusDialog.confirmDeactivate,
        cancel: common.confirmDialog.cancel,
        close: common.confirmDialog.close,
      }}
    />
  );
}
