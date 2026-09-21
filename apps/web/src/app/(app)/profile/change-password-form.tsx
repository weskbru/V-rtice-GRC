'use client';

/**
 * PharosGRC — change-own-password form (T075, FR-010).
 *
 * On success the API revokes every session for the user, including the one
 * making this request (FR-017) — the browser's cookie is no longer valid
 * the instant this resolves, so the only correct next step is to send the
 * user back through sign-in with their new password.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { feedback } from '@/components/shell/feedback-provider';
import { useNavigate } from '@/components/shell/navigation-pending';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { ApiError, apiClient } from '@/lib/api-client';
import { errors } from '@/lib/messages/errors';
import { profile } from '@/lib/messages/profile';
import { changePasswordSchema, type ChangePasswordFormValues } from '@/lib/validation/auth';

export function ChangePasswordForm(): React.JSX.Element {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmNewPassword: '' },
  });

  async function onSubmit(values: ChangePasswordFormValues): Promise<void> {
    setFormError(null);
    setSubmitting(true);
    try {
      // A 401 here is contractually ambiguous (wrong current password vs. an
      // already-expired session) and this form owns that message — it must
      // never be swallowed by the global session-expiry prompt.
      await apiClient.post<void>(
        '/auth/me/password',
        { currentPassword: values.currentPassword, newPassword: values.newPassword },
        { skipUnauthorizedHandler: true },
      );
      feedback.success(
        profile.changePassword.successTitle,
        profile.changePassword.successDescription,
      );
      navigate('/login');
    } catch (error) {
      if (error instanceof ApiError) {
        if (
          error.problem.status === 422 &&
          error.problem.errors &&
          error.problem.errors.length > 0
        ) {
          for (const fieldError of error.problem.errors) {
            if (fieldError.field === 'newPassword' || fieldError.field === 'currentPassword') {
              form.setError(fieldError.field, { message: fieldError.message });
            }
          }
          setFormError(profile.changePassword.fixHighlightedFields);
        } else if (error.problem.status === 401) {
          setFormError(profile.changePassword.ambiguousUnauthorized);
        } else if (error.problem.status === 429) {
          setFormError(errors.rateLimited);
        } else {
          setFormError(profile.changePassword.genericError);
        }
      } else {
        setFormError(profile.changePassword.genericError);
      }
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={(event) => {
          void form.handleSubmit(onSubmit)(event);
        }}
        noValidate
        className="flex flex-col gap-4"
      >
        {formError ? (
          <p
            role="alert"
            className="rounded-md border border-status-danger-border bg-status-danger-bg px-3 py-2 text-sm text-status-danger-fg"
          >
            {formError}
          </p>
        ) : null}

        <FormField
          control={form.control}
          name="currentPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{profile.changePassword.currentPasswordLabel}</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="current-password"
                  disabled={submitting}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="newPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{profile.changePassword.newPasswordLabel}</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  disabled={submitting}
                  {...field}
                />
              </FormControl>
              <FormDescription>{profile.changePassword.newPasswordHint}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmNewPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{profile.changePassword.confirmNewPasswordLabel}</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  disabled={submitting}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div>
          <Button type="submit" disabled={submitting}>
            {submitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
            {submitting ? profile.changePassword.submitting : profile.changePassword.submit}
          </Button>
        </div>
      </form>
    </Form>
  );
}
