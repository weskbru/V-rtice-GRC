'use client';

import { FormField } from '@pharos/design-system/components';
import { ArrowRight, Eye, EyeOff, Loader2, LockKeyhole, Mail } from 'lucide-react';
import { useRef, useState } from 'react';

import { useNavigate } from '@/components/shell/navigation-pending';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError, apiClient } from '@/lib/api-client';
import { auth } from '@/lib/messages/auth';
import { errors } from '@/lib/messages/errors';
import { loginSchema } from '@/lib/validation/auth';

import type { AuthenticatedIdentity } from '@/lib/auth-types';

export interface LoginFormProps {
  returnTo: string;
}

interface LoginFieldErrors {
  email?: string;
  password?: string;
}

export function LoginForm({ returnTo }: LoginFormProps): React.JSX.Element {
  const navigate = useNavigate();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const submittingRef = useRef(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submittingRef.current) return;

    const parsed = loginSchema.safeParse({
      email: emailRef.current?.value ?? '',
      password: passwordRef.current?.value ?? '',
    });

    if (!parsed.success) {
      const nextFieldErrors: LoginFieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === 'email' && !nextFieldErrors.email) {
          nextFieldErrors.email = issue.message;
        } else if (key === 'password' && !nextFieldErrors.password) {
          nextFieldErrors.password = issue.message;
        }
      }
      setFieldErrors(nextFieldErrors);
      (nextFieldErrors.email ? emailRef : passwordRef).current?.focus();
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setSubmitting(true);
    submittingRef.current = true;
    try {
      const identity = await apiClient.post<AuthenticatedIdentity>('/auth/login', parsed.data, {
        skipUnauthorizedHandler: true,
      });

      if (identity.mustChangePassword) {
        navigate('/profile?mustChangePassword=true');
        return;
      }

      navigate(returnTo);
      navigate.refresh();
    } catch (error) {
      setFormError(
        error instanceof ApiError && error.problem.status === 429
          ? errors.rateLimited
          : errors.invalidCredentials,
      );
      setSubmitting(false);
      submittingRef.current = false;
    }
  }

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
      noValidate
      aria-label={auth.login.formAriaLabel}
      className="flex flex-col gap-5"
    >
      {formError ? (
        <p
          role="alert"
          className="rounded-md border border-status-danger-border bg-status-danger-bg px-3 py-2 text-sm text-status-danger-fg"
        >
          {formError}
        </p>
      ) : null}

      <FormField label={auth.login.emailLabel} error={fieldErrors.email}>
        {(field) => (
          <div className="relative">
            <Mail
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              {...field}
              ref={emailRef}
              type="email"
              name="email"
              autoComplete="username"
              autoFocus
              disabled={submitting}
              placeholder={auth.login.emailPlaceholder}
              className="h-12 pl-14 text-sm"
            />
          </div>
        )}
      </FormField>

      <FormField label={auth.login.passwordLabel} error={fieldErrors.password}>
        {(field) => (
          <div className="relative">
            <LockKeyhole
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              {...field}
              ref={passwordRef}
              type={passwordVisible ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              disabled={submitting}
              placeholder={auth.login.passwordPlaceholder}
              className="h-12 pl-14 pr-12 text-sm"
            />
            <button
              type="button"
              disabled={submitting}
              aria-label={passwordVisible ? auth.login.hidePassword : auth.login.showPassword}
              aria-controls={field.id}
              onClick={() => setPasswordVisible((visible) => !visible)}
              className="absolute right-1 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              {passwordVisible ? (
                <Eye aria-hidden="true" className="size-5" />
              ) : (
                <EyeOff aria-hidden="true" className="size-5" />
              )}
            </button>
          </div>
        )}
      </FormField>

      <Button
        type="submit"
        disabled={submitting}
        className="h-12 w-full gap-3 text-base font-semibold"
      >
        {submitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
        {submitting ? auth.login.submitting : auth.login.submit}
        {!submitting ? <ArrowRight aria-hidden="true" className="size-4" /> : null}
      </Button>
    </form>
  );
}
