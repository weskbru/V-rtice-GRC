'use client';

import { ConfirmDialog } from '@pharos/design-system/components';
import { LogOut } from 'lucide-react';
import { useState } from 'react';

import { admin } from '@/lib/messages/admin';
import { common } from '@/lib/messages/common';

import { adminApi } from '../../api';

import type { AdminUser } from '../../types';

export interface UserSessionsDialogProps {
  user: AdminUser | null;
  onOpenChange: (open: boolean) => void;
  onRevoked: () => void;
  onError: (message: string) => void;
}

export function UserSessionsDialog({
  user,
  onOpenChange,
  onRevoked,
  onError,
}: UserSessionsDialogProps): React.JSX.Element {
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm(): Promise<void> {
    if (!user) return;
    setSubmitting(true);
    try {
      await adminApi.revokeUserSessions(user.id);
      onOpenChange(false);
      onRevoked();
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
      title={user ? admin.users.sessionsDialog.title(user.fullName) : ''}
      description={admin.users.sessionsDialog.description}
      variant="destructive"
      icon={LogOut}
      isConfirming={submitting}
      onConfirm={() => void handleConfirm()}
      labels={{
        confirm: admin.users.sessionsDialog.confirm,
        cancel: common.confirmDialog.cancel,
        close: common.confirmDialog.close,
      }}
    />
  );
}
