import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function asInputElement(element: HTMLElement): HTMLInputElement {
  return element as HTMLInputElement;
}

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
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import * as ApiClientModule from '@/lib/api-client';

import { LoginForm } from './login-form';

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

  it('reveals and conceals the existing password input without losing an autofilled value', () => {
    render(<LoginForm returnTo="/dashboard" />);
    const password = asInputElement(screen.getByLabelText('Senha'));
    password.value = 'password-manager-value';
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }));
    expect(screen.getByLabelText('Senha')).toBe(password);
    expect(password).toHaveAttribute('type', 'text');
    expect(password).toHaveValue('password-manager-value');
    expect(password).toHaveAttribute('autoComplete', 'current-password');
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar senha' }));
    expect(password).toHaveAttribute('type', 'password');
    expect(password).toHaveValue('password-manager-value');
    expect(postMock).not.toHaveBeenCalled();
  });

  it('accepts only one submission while the request is pending', () => {
    postMock.mockReturnValue(new Promise(() => undefined));
    render(<LoginForm returnTo="/dashboard" />);
    asInputElement(screen.getByLabelText('E-mail')).value = 'user@example.com';
    asInputElement(screen.getByLabelText('Senha')).value = 'correct-password';
    fireEvent.submit(screen.getByRole('form'));
    fireEvent.submit(screen.getByRole('form'));
    expect(postMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Entrando…' })).toBeDisabled();
    expect(screen.getByLabelText('E-mail')).toBeDisabled();
    expect(screen.getByLabelText('Senha')).toBeDisabled();
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
