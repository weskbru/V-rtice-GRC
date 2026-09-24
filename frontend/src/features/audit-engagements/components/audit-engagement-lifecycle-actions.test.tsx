import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuditEngagementLifecycleActions } from './audit-engagement-lifecycle-actions';

import type { AuditEngagement, AuditScopeEntry } from '../types';

const { listScopeMock, startEngagementMock, completeEngagementMock, cancelEngagementMock } =
  vi.hoisted(() => ({
    listScopeMock: vi.fn(),
    startEngagementMock: vi.fn(),
    completeEngagementMock: vi.fn(),
    cancelEngagementMock: vi.fn(),
  }));

vi.mock('../api', () => ({
  auditEngagementsApi: {
    listScope: listScopeMock,
    startEngagement: startEngagementMock,
    completeEngagement: completeEngagementMock,
    cancelEngagement: cancelEngagementMock,
  },
}));

function buildEngagement(overrides: Partial<AuditEngagement> = {}): AuditEngagement {
  return {
    id: 'engagement-1',
    code: 'AUD-2026-0001',
    objective: 'Verificar controles de acesso privilegiado',
    periodStart: '2026-01-01',
    periodEnd: '2026-03-31',
    orgUnit: { id: 'org-1', name: 'PharosGRC' },
    leadAuditor: { id: 'user-1', fullName: 'Ana Souza' },
    status: 'PLANNING',
    startedAt: null,
    startedBy: null,
    completedAt: null,
    completedBy: null,
    cancelledAt: null,
    cancelledBy: null,
    cancellationJustification: null,
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function scopeEntry(): AuditScopeEntry {
  return {
    id: 'scope-1',
    targetType: 'CONTROL',
    target: { id: 'control-1', label: 'CTL-2026-0001 — Revisão de acessos' },
    linkedAt: '2026-01-01T00:00:00.000Z',
    linkedBy: { id: 'user-1', fullName: 'Ana Souza' },
  };
}

describe('AuditEngagementLifecycleActions', () => {
  beforeEach(() => {
    listScopeMock.mockReset();
    startEngagementMock.mockReset();
    completeEngagementMock.mockReset();
    cancelEngagementMock.mockReset();
  });

  it('disables "Iniciar" and proactively names the missing-scope precondition, before any attempt (FR-003, CLAUDE.md §18.11)', async () => {
    listScopeMock.mockResolvedValue([]);
    render(
      <AuditEngagementLifecycleActions
        engagement={buildEngagement()}
        etag='"1"'
        scopeChangeToken={0}
        onChanged={vi.fn()}
      />,
    );

    const startButton = await screen.findByRole('button', { name: 'Iniciar engajamento' });
    expect(startButton).toBeDisabled();
    expect(
      await screen.findByText(
        'É preciso adicionar ao menos um item ao escopo — uma versão de framework, um requisito ou um controle — antes de iniciar este engajamento.',
      ),
    ).toBeInTheDocument();
    expect(startEngagementMock).not.toHaveBeenCalled();
  });

  it('enables "Iniciar" once scope exists, and starts the engagement on confirmation', async () => {
    listScopeMock.mockResolvedValue([scopeEntry()]);
    const onChanged = vi.fn();
    const updated = buildEngagement({ status: 'IN_PROGRESS', version: 2 });
    startEngagementMock.mockResolvedValue({ engagement: updated, etag: '"2"' });

    render(
      <AuditEngagementLifecycleActions
        engagement={buildEngagement()}
        etag='"1"'
        scopeChangeToken={0}
        onChanged={onChanged}
      />,
    );

    const startButton = await screen.findByRole('button', { name: 'Iniciar engajamento' });
    await waitFor(() => expect(startButton).not.toBeDisabled());

    fireEvent.click(startButton);
    fireEvent.click(await screen.findByRole('button', { name: 'Iniciar' }));

    await waitFor(() => expect(startEngagementMock).toHaveBeenCalledWith('engagement-1', '"1"'));
    await waitFor(() =>
      expect(onChanged).toHaveBeenCalledWith({ engagement: updated, etag: '"2"' }),
    );
  });

  it('shows Concluir and Cancelar (never Iniciar) once IN_PROGRESS, and completes on confirmation', async () => {
    const onChanged = vi.fn();
    const updated = buildEngagement({ status: 'COMPLETED', version: 2 });
    completeEngagementMock.mockResolvedValue({ engagement: updated, etag: '"2"' });

    render(
      <AuditEngagementLifecycleActions
        engagement={buildEngagement({ status: 'IN_PROGRESS' })}
        etag='"1"'
        scopeChangeToken={0}
        onChanged={onChanged}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Iniciar engajamento' })).not.toBeInTheDocument();
    expect(listScopeMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Concluir engajamento' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Concluir' }));

    await waitFor(() => expect(completeEngagementMock).toHaveBeenCalledWith('engagement-1', '"1"'));
    await waitFor(() =>
      expect(onChanged).toHaveBeenCalledWith({ engagement: updated, etag: '"2"' }),
    );
  });

  it('requires a written justification before cancelling, and sends it once provided (FR-004a)', async () => {
    const onChanged = vi.fn();
    const updated = buildEngagement({
      status: 'CANCELLED',
      cancellationJustification: 'Escopo definido incorretamente.',
      version: 2,
    });
    cancelEngagementMock.mockResolvedValue({ engagement: updated, etag: '"2"' });

    render(
      <AuditEngagementLifecycleActions
        engagement={buildEngagement({ status: 'IN_PROGRESS' })}
        etag='"1"'
        scopeChangeToken={0}
        onChanged={onChanged}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar engajamento' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar cancelamento' }));

    expect(await screen.findByText('Informe a justificativa do cancelamento.')).toBeInTheDocument();
    expect(cancelEngagementMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Justificativa do cancelamento/), {
      target: { value: 'Escopo definido incorretamente.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cancelamento' }));

    await waitFor(() =>
      expect(cancelEngagementMock).toHaveBeenCalledWith(
        'engagement-1',
        { justification: 'Escopo definido incorretamente.' },
        '"1"',
      ),
    );
    await waitFor(() =>
      expect(onChanged).toHaveBeenCalledWith({ engagement: updated, etag: '"2"' }),
    );
  });

  it('re-reads the scope count and enables start when scopeChangeToken changes (scope added without an engagement version bump)', async () => {
    listScopeMock.mockResolvedValueOnce([]);

    const engagement = buildEngagement({ status: 'PLANNING' });
    const { rerender } = render(
      <AuditEngagementLifecycleActions
        engagement={engagement}
        etag='"1"'
        scopeChangeToken={0}
        onChanged={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Iniciar engajamento' })).toBeDisabled(),
    );

    listScopeMock.mockResolvedValueOnce([scopeEntry()]);
    rerender(
      <AuditEngagementLifecycleActions
        engagement={engagement}
        etag='"1"'
        scopeChangeToken={1}
        onChanged={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Iniciar engajamento' })).toBeEnabled(),
    );
  });

  it('shows an honest "no transition available" message, with no buttons, for a terminal state (COMPLETED)', () => {
    render(
      <AuditEngagementLifecycleActions
        engagement={buildEngagement({ status: 'COMPLETED' })}
        etag='"1"'
        scopeChangeToken={0}
        onChanged={vi.fn()}
      />,
    );

    expect(
      screen.getByText(
        'Nenhuma transição disponível — o ciclo de vida deste engajamento está encerrado.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Iniciar|Concluir|Cancelar/ }),
    ).not.toBeInTheDocument();
  });

  it('shows the same honest terminal message for CANCELLED, never offering a further cancel', () => {
    render(
      <AuditEngagementLifecycleActions
        engagement={buildEngagement({ status: 'CANCELLED' })}
        etag='"1"'
        scopeChangeToken={0}
        onChanged={vi.fn()}
      />,
    );

    expect(
      screen.getByText(
        'Nenhuma transição disponível — o ciclo de vida deste engajamento está encerrado.',
      ),
    ).toBeInTheDocument();
  });
});
