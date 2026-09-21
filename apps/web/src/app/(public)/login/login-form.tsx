'use client';

/**
 * PharosGRC — sign-in form (T070).
 *
 * FR-007: failure is reported with one generic, non-disclosing message
 * regardless of whether the account does not exist, is deactivated, or the
 * password is wrong — this component never inspects the failure's
 * `ApiProblem` to decide what to say (only the HTTP status is used, and only
 * to add a distinct message for rate limiting, which is not a credentials
 * disclosure).
 *
 * D-21 (`apps/web/e2e/support/admin-session.ts`, see `fillLoginCredentials`'s
 * header comment for the full diagnosis): this form is server-rendered and
 * looks interactive on first paint, but a value typed into a field before
 * hydration finishes can be silently discarded the instant hydration
 * catches up — with nothing telling the person it happened. On a slow
 * connection or device this is a real defect, not only a CI timing
 * artifact: the four WebKit screenshots D-21 cites show exactly that, on a
 * real (if throttled) browser.
 *
 * Two mechanisms turned out to cause this, not one, and both had to go
 * before a value typed pre-hydration reliably survived:
 *
 * 1. The shadcn/react-hook-form `Controller` pattern (`@/components/ui/form`'s
 *    `FormField`, used elsewhere in the app) keeps a field's DOM `value`
 *    pinned to React state. Until hydration commits, that state is still
 *    the empty default, so the first controlled render after hydration
 *    forces the DOM back to `''`.
 * 2. Switching to `register(...)` (react-hook-form's uncontrolled, ref-based
 *    API — confirmed, by direct measurement against a throttled page, NOT
 *    to be sufficient on its own) does not fully fix it either: `register`
 *    returns a brand-new ref-callback function identity on every render,
 *    so React detaches and reattaches the DOM ref on every re-render of
 *    this component (not only on mount) — and react-hook-form's ref
 *    callback, on (re)attaching, writes the field's *internally tracked*
 *    value back onto the DOM node to support programmatic `setValue`/
 *    `reset()`. Because no `onChange` had reached react-hook-form's
 *    internal store yet (nothing was listening pre-hydration), that
 *    tracked value is still the empty default — so the very first
 *    (re)attach after hydration overwrites the DOM the same way the
 *    controlled path did, just via a different mechanism.
 *
 * The only wiring that survives is a `useRef` object ref — stable across
 * renders, so React attaches it exactly once on mount and never touches it
 * again — combined with reading the DOM's live value directly at submit
 * time instead of trusting any framework-tracked copy of it. Neither
 * react-hook-form's `Controller` nor its `register` can offer that
 * guarantee (both actively sync a tracked value onto the DOM at points
 * this component does not fully control), so validation here is done
 * directly against the same `zodSchema` (`loginSchema.safeParse`) without
 * react-hook-form as an intermediary. Nothing about how credentials are
 * handled, transmitted or reported changes; only the value-collection path
 * changed color, not the destination — the required properties.
 *
 * F-56 (`docs/deferred-findings.md`): this makes the login form the only
 * one in the product not built on the shared `Controller`/`FormField`
 * library — a deliberate, but so far unique, divergence (CLAUDE.md §18.3,
 * §18.12 treat undocumented divergence between screens as a defect; F-56
 * is that documentation). The same two mechanisms above are a credible
 * hypothesis for every other form built on `Controller`, not only this
 * one — untested elsewhere, and left as an open architectural decision
 * rather than a mass rewrite done under a blocked pipeline and a full
 * disk. Read F-56 before assuming this pattern is login-only.
 *
 * On an ordinary fast load this is invisible: there is no "loading" or
 * "not ready" state to flash, because nothing is ever disabled or hidden
 * while hydration catches up — the fields simply work immediately,
 * whichever side of hydration a keystroke lands on, exactly as before.
 */
import { FormField } from '@pharos/design-system/components';
import { Loader2 } from 'lucide-react';
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
  /** Path to send the user to after a successful sign-in that does not require a password change. Always same-origin — validated by the server page before this component ever receives it. */
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    // Read the DOM directly rather than any framework-tracked copy of it —
    // see the header comment for why that distinction is the entire point
    // of this component.
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
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setSubmitting(true);
    try {
      // A failed sign-in is an expected, form-owned outcome here — it must
      // never be treated as a "session expired mid-use" event.
      const identity = await apiClient.post<AuthenticatedIdentity>('/auth/login', parsed.data, {
        skipUnauthorizedHandler: true,
      });

      if (identity.mustChangePassword) {
        // The seeded administrator (and anyone else flagged this way) is
        // sent to change their password instead of into the app.
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
          <Input
            {...field}
            ref={emailRef}
            type="email"
            name="email"
            autoComplete="username"
            autoFocus
            disabled={submitting}
          />
        )}
      </FormField>

      <FormField label={auth.login.passwordLabel} error={fieldErrors.password}>
        {(field) => (
          <Input
            {...field}
            ref={passwordRef}
            type="password"
            name="password"
            autoComplete="current-password"
            disabled={submitting}
          />
        )}
      </FormField>

      <Button type="submit" disabled={submitting} className="mt-2">
        {submitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
        {submitting ? auth.login.submitting : auth.login.submit}
      </Button>
    </form>
  );
}
