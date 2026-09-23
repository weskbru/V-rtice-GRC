import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProblemCloseDialog } from './problem-close-dialog';

import type { ProblemDetail } from '../types';

const { transitionMock, hasCompletedCorrectiveActionMock } = vi.hoisted(() => ({
  transitionMock: vi.fn(),
  hasCompletedCorrectiveActionMock: vi.fn(),
}));

vi.mock('../api', () => ({
  problemsApi: {
    transition: transitionMock,
    hasCompletedCorrectiveAction: hasCompletedCorrectiveActionMock,
  },
}));

function problemFixture(overrides: Partial<ProblemDetail> = {}): ProblemDetail {
  return {
    id: 'problem-1',
    code: 'PRB-2026-0001',
    title: 'Falhas recorrentes de autenticação',
    description: 'Investigação da causa raiz das falhas recorrentes.',
    severity: 'HIGH',
    status: 'RESOLVED',
    orgUnit: { id: 'org-1', code: 'ORG-1', name: 'Unidade de teste' },
    owner: { id: 'user-1', fullName: 'Ana Souza' },
    identifiedOn: '2026-02-01',
    updatedAt: '2026-02-05T10:00:00.000Z',
    rootCause: 'Configuração incorreta do provedor de identidade.',
    resolvedAt: '2026-02-04T10:00:00.000Z',
    resolvedBy: { id: 'user-1', fullName: 'Ana Souza' },
    closedAt: null,
    closedBy: null,
    cancellationReason: null,
    createdAt: '2026-02-01T09:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  transitionMock.mockReset();
  hasCompletedCorrectiveActionMock.mockReset();
});

describe('ProblemCloseDialog', () => {
  it('shows the corrective-action requirement proactively, and disables closing, when none is completed yet', async () => {
    hasCompletedCorrectiveActionMock.mockResolvedValue(false);

    render(
      <ProblemCloseDialog
        problem={problemFixture()}
        onOpenChange={() => undefined}
        onClosed={() => undefined}
      />,
    );

    await waitFor(() => expect(hasCompletedCorrectiveActionMock).toHaveBeenCalledWith('problem-1'));

    await screen.findByText('Ação corretiva concluída necessária');
    const dialog = screen.getByRole('dialog');
    const confirmButton = within(dialog).getByRole('button', { name: 'Fechar problema' });
    expect(confirmButton).toBeDisabled();
    expect(transitionMock).not.toHaveBeenCalled();
  });

  it('allows closing once a completed corrective action exists', async () => {
    hasCompletedCorrectiveActionMock.mockResolvedValue(true);
    transitionMock.mockResolvedValue(problemFixture({ status: 'CLOSED' }));

    render(
      <ProblemCloseDialog
        problem={problemFixture()}
        onOpenChange={() => undefined}
        onClosed={() => undefined}
      />,
    );

    await waitFor(() => expect(hasCompletedCorrectiveActionMock).toHaveBeenCalled());
    expect(screen.queryByText('Ação corretiva concluída necessária')).not.toBeInTheDocument();

    const dialog = screen.getByRole('dialog');
    const confirmButton = within(dialog).getByRole('button', { name: 'Fechar problema' });
    expect(confirmButton).not.toBeDisabled();

    fireEvent.click(confirmButton);
    await waitFor(() =>
      expect(transitionMock).toHaveBeenCalledWith('problem-1', { toStatus: 'CLOSED' }),
    );
  });

  it('distinguishes the segregation-of-duties refusal (403) from the missing-action refusal (422)', async () => {
    const { ApiError } = await import('@/lib/api-client');
    hasCompletedCorrectiveActionMock.mockResolvedValue(true);
    transitionMock.mockRejectedValue(
      new ApiError({ status: 403, title: 'Proibido', type: 'about:blank' }),
    );

    render(
      <ProblemCloseDialog
        problem={problemFixture()}
        onOpenChange={() => undefined}
        onClosed={() => undefined}
      />,
    );

    await waitFor(() => expect(hasCompletedCorrectiveActionMock).toHaveBeenCalled());
    const dialog = screen.getByRole('dialog');
    const confirmButton = within(dialog).getByRole('button', { name: 'Fechar problema' });
    fireEvent.click(confirmButton);

    await screen.findByText(
      'Quem fecha o problema precisa ser diferente de quem concluiu a ação corretiva.',
    );
  });

  it('does not block on a failed corrective-action check — the server remains the authority', async () => {
    hasCompletedCorrectiveActionMock.mockRejectedValue(new Error('network error'));

    render(
      <ProblemCloseDialog
        problem={problemFixture()}
        onOpenChange={() => undefined}
        onClosed={() => undefined}
      />,
    );

    await waitFor(() => expect(hasCompletedCorrectiveActionMock).toHaveBeenCalled());
    const dialog = screen.getByRole('dialog');
    const confirmButton = within(dialog).getByRole('button', { name: 'Fechar problema' });
    expect(confirmButton).not.toBeDisabled();
  });
});
