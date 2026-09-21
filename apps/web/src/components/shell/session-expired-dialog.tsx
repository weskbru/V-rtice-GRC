'use client';

/**
 * PharosGRC application shell — in-place re-authentication (T077, FR-016).
 *
 * Registers itself as the `api-client.ts` session-expiry seam
 * (`setUnauthorizedHandler`) for the lifetime of the authenticated shell. On
 * an unexpected 401 (the session expired or was revoked mid-use) it opens a
 * modal *over* whatever the user was doing — it does not navigate anywhere,
 * so the page underneath, and every value in every field on it, is left
 * completely untouched. Re-entering the password re-establishes a session in
 * place; the user resumes exactly where they left off (FR-016: no data the
 * user has entered is lost).
 *
 * The dialog cannot be dismissed by pressing Escape or clicking outside — a
 * genuinely expired session is not something closing the dialog fixes — but
 * it does offer an explicit "Sign in as someone else" escape hatch for the
 * (rare) case the current user is not who should continue; choosing that is
 * a deliberate, informed decision by the user to leave the page, not
 * something this component decides silently on a 401.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { useNavigate } from '@/components/shell/navigation-pending';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { apiClient, setUnauthorizedHandler } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { auth } from '@/lib/messages/auth';
import { errors } from '@/lib/messages/errors';
import { loginSchema, type LoginFormValues } from '@/lib/validation/auth';

import type { AuthenticatedIdentity } from '@/lib/auth-types';

export function SessionExpiredDialog(): React.JSX.Element {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: user.email, password: '' },
  });

  useEffect(() => {
    // Seeding the form and clearing any stale error happens here, at the
    // moment the seam actually fires — not in a second effect keyed on
    // `open` (which would call setState synchronously inside an effect body
    // purely to react to a state change this component itself just made).
    setUnauthorizedHandler(() => {
      form.reset({ email: user.email, password: '' });
      setFormError(null);
      setOpen(true);
    });
    return () => setUnauthorizedHandler(null);
  }, [form, user.email]);

  async function handleReauthenticate(values: LoginFormValues): Promise<void> {
    setSubmitting(true);
    setFormError(null);
    try {
      const identity = await apiClient.post<AuthenticatedIdentity>('/auth/login', values, {
        skipUnauthorizedHandler: true,
      });
      setOpen(false);
      if (identity.mustChangePassword) {
        navigate('/profile?mustChangePassword=true');
        return;
      }
      await refresh();
    } catch {
      setFormError(errors.invalidCredentials);
    } finally {
      setSubmitting(false);
    }
  }

  function handleSignInAsSomeoneElse(): void {
    setOpen(false);
    navigate('/login');
  }

  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert aria-hidden="true" className="size-5 text-status-warning-fg" />
            <DialogTitle>{auth.sessionExpired.title}</DialogTitle>
          </div>
          <DialogDescription>
            {auth.sessionExpired.descriptionPrefix} <strong>{user.email}</strong>
            {auth.sessionExpired.descriptionSuffix}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={(event) => {
              void form.handleSubmit(handleReauthenticate)(event);
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
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{auth.login.emailLabel}</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="username" disabled={submitting} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{auth.login.passwordLabel}</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="current-password"
                      autoFocus
                      disabled={submitting}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                disabled={submitting}
                onClick={handleSignInAsSomeoneElse}
              >
                {auth.sessionExpired.signInAsSomeoneElse}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
                {submitting ? auth.sessionExpired.submitting : auth.sessionExpired.submit}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
