import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `screen.getByLabelText` returns a plain `HTMLElement`; the D-21 regression
 * test below needs `.value`, which only exists on `HTMLInputElement`. An
 * inline `as HTMLInputElement` at the call site trips
 * `@typescript-eslint/no-unnecessary-type-assertion` inconsistently (a
 * typed-linting/`tsc` disagreement observed directly: removing the inline
 * assertion breaks `tsc --noEmit` with "Property 'value' does not exist on
 * type 'HTMLElement'", yet the lint rule still flagged one of two
 * structurally identical call sites as redundant). Narrowing through a
 * named, explicitly-typed helper avoids the inline-assertion shape the rule
 * misfires on, without weakening the actual type check `tsc` still runs.
 */
function asInputElement(element: HTMLElement): HTMLInputElement {
  return element as HTMLInputElement;
}

// `vi.mock` factories are hoisted above every other statement in the file
// (including `const` declarations) — variables they close over must be
// declared through `vi.hoisted` so they exist by the time the factory runs.
const { pushMock, refreshMock, postMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
  postMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof ApiClientModule>('@/lib/api-client');
  return {
    ...actual,
    apiClient: { ...actual.apiClient, post: postMock },
  };
});

import { ApiError } from '@/lib/api-client';
// `typeof ApiClientModule` below needs a real value import — `import type *
// as ApiClientModule` cannot be used as a type argument (TS2709: "cannot use
// namespace as a type"), so this one import is deliberately not `import type`.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import * as ApiClientModule from '@/lib/api-client';

import { LoginForm } from './login-form';

/**
 * Component-mount evidence for T070 (the login screen, FR-007). Exercises
 * `LoginForm` directly — the server component wrapper (`page.tsx`) only
 * resolves `returnTo`/existing-session redirects, which is Playwright's job
 * (`e2e/auth.spec.ts`).
 */
describe('LoginForm', () => {
  beforeEach(() => {
    pushMock.mockReset();
    refreshMock.mockReset();
    postMock.mockReset();
  });

  it('renders accessible, labeled email and password fields and a submit button', () => {
    render(<LoginForm returnTo="/dashboard" />);
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('shows one generic, non-disclosing error on failed sign-in regardless of the server detail (FR-007)', async () => {
    postMock.mockRejectedValueOnce(
      new ApiError({
        title: 'Invalid credentials',
        status: 401,
        detail: 'The account does not exist.',
      }),
    );
    render(<LoginForm returnTo="/dashboard" />);

    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'wrong-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('E-mail ou senha incorretos.');
    expect(alert).not.toHaveTextContent('does not exist');
  });

  it('routes a mustChangePassword response to the profile screen instead of the requested destination', async () => {
    postMock.mockResolvedValueOnce({ mustChangePassword: true });
    render(<LoginForm returnTo="/dashboard" />);

    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'admin@example.local' } });
    fireEvent.change(screen.getByLabelText('Senha'), {
      target: { value: 'Temp-Password-123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/profile?mustChangePassword=true'));
  });

  it('navigates to returnTo on an ordinary successful sign-in', async () => {
    postMock.mockResolvedValueOnce({ mustChangePassword: false });
    render(<LoginForm returnTo="/dashboard" />);

    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'correct-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/dashboard'));
  });

  it('submits whatever is in the DOM even without a prior React change event (D-21 regression)', async () => {
    // D-21 (`apps/web/e2e/support/admin-session.ts`, `fillLoginCredentials`):
    // a value typed into this form before hydration finishes never reaches
    // React via `onChange` — the keystrokes land on a plain DOM node that
    // nothing is listening to yet. Setting `.value` directly (bypassing
    // `fireEvent.change`, which dispatches a React-observable synthetic
    // event and would mask exactly this) reproduces that: a value present
    // in the DOM that React's event system never saw. The fix must read
    // the DOM at submit time rather than trust any framework-tracked copy
    // of it, so this has to pass regardless of how the value got there.
    postMock.mockResolvedValueOnce({ mustChangePassword: false });
    render(<LoginForm returnTo="/dashboard" />);

    const emailInput = asInputElement(screen.getByLabelText('E-mail'));
    const passwordInput = asInputElement(screen.getByLabelText('Senha'));
    emailInput.value = 'user@example.com';
    passwordInput.value = 'correct-password';

    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith(
        '/auth/login',
        { email: 'user@example.com', password: 'correct-password' },
        { skipUnauthorizedHandler: true },
      ),
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/dashboard'));
  });
});
