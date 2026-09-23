'use client';

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
