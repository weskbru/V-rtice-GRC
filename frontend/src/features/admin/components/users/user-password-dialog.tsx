'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api-client';
import { admin } from '@/lib/messages/admin';
import { resetPasswordFormSchema, type ResetPasswordFormValues } from '@/lib/validation/admin';
import { FormField } from '@vertice/design-system/components';

import { adminApi } from '../../api';

import type { AdminUser } from '../../types';

export interface UserPasswordDialogProps {
  user: AdminUser | null;
  onOpenChange: (open: boolean) => void;
  onReset: () => void;
  onError: (message: string) => void;
}

export function UserPasswordDialog({
  user,
  onOpenChange,
  onReset,
  onError,
}: UserPasswordDialogProps): React.JSX.Element {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  useEffect(() => {
    if (user) {
      form.reset({ newPassword: '', confirmPassword: '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reseta ao abrir para outro usuário.
  }, [user]);

  function handleOpenChange(next: boolean): void {
    if (submitting) return;
    onOpenChange(next);
  }

  async function onSubmit(values: ResetPasswordFormValues): Promise<void> {
    if (!user) return;
    setSubmitting(true);
    try {
      await adminApi.resetUserPassword(user.id, { newPassword: values.newPassword });
      handleOpenChange(false);
      onReset();
    } catch (error) {
      const detail =
        error instanceof ApiError && error.problem.status === 422
          ? (error.problem.detail ?? admin.users.feedback.genericError)
          : admin.users.feedback.genericError;
      onError(detail);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={user !== null} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound aria-hidden="true" className="size-4 text-status-warning-fg" />
            {user ? admin.users.passwordDialog.title(user.fullName) : ''}
          </DialogTitle>
          <DialogDescription>{admin.users.passwordDialog.description}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            void form.handleSubmit(onSubmit)(event);
          }}
          noValidate
          className="flex flex-col gap-4"
        >
          <FormField
            label={admin.users.passwordDialog.fields.newPassword.label}
            required
            description={admin.users.passwordDialog.fields.newPassword.description}
            error={form.formState.errors.newPassword?.message}
          >
            {(field) => (
              <Input
                {...field}
                type="password"
                autoComplete="new-password"
                {...form.register('newPassword')}
                disabled={submitting}
              />
            )}
          </FormField>

          <FormField
            label={admin.users.passwordDialog.fields.confirmPassword.label}
            required
            error={form.formState.errors.confirmPassword?.message}
          >
            {(field) => (
              <Input
                {...field}
                type="password"
                autoComplete="new-password"
                {...form.register('confirmPassword')}
                disabled={submitting}
              />
            )}
          </FormField>

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
              type="submit"
              disabled={submitting}
              className="bg-status-warning-solid-bg text-status-warning-solid-fg hover:opacity-90"
            >
              {submitting ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <KeyRound aria-hidden="true" className="size-4" />
              )}
              {submitting
                ? admin.users.passwordDialog.submitting
                : admin.users.passwordDialog.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
