import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ActionLifecycleSection } from './action-lifecycle-section';

import type { Action } from '../../types';

vi.mock('../../api', () => ({
  actionsApi: {
    transitionAction: vi.fn(() => new Promise(() => undefined)),
  },
}));

function buildAction(overrides: Partial<Action> = {}): Action {
  return {
    id: 'action-1',
    code: 'ACT-2026-0001',
    orgUnit: { id: 'org-1', name: 'Vértice GRC' },
    originType: 'RISK_TREATMENT',
    originId: 'risk-1',
    originLabel: 'RSK-2026-0001 — Falha no fornecedor crítico',
    title: 'Corrigir configuração de firewall',
    description: 'Aplicar a regra revisada no firewall perimetral.',
    responsible: { id: 'user-1', fullName: 'Ana Souza' },
    dueOn: '2026-05-01',
    status: 'OPEN',
    overdue: false,
    completedAt: null,
    reopenedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('ActionLifecycleSection', () => {
  it('keeps rendering the track and the "Ciclo de vida" title when the caller lacks action:edit (no button row)', () => {
    render(
      <ActionLifecycleSection
        action={buildAction({ status: 'OPEN' })}
        canTransition={false}
        onChanged={vi.fn()}
      />,
    );

    expect(screen.getByText('Ciclo de vida')).toBeInTheDocument();
    expect(screen.getAllByText('Aberta').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Em andamento').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Iniciar' })).not.toBeInTheDocument();
  });

  it('keeps rendering the track for a terminal (CANCELLED) action, even with permission — only the button row disappears', () => {
    render(
      <ActionLifecycleSection
        action={buildAction({ status: 'CANCELLED' })}
        canTransition
        onChanged={vi.fn()}
      />,
    );

    expect(screen.getByText('Ciclo de vida')).toBeInTheDocument();
    expect(screen.getAllByText('Cancelada').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders no outcome facts for a fresh OPEN action — neither has happened yet', () => {
    render(
      <ActionLifecycleSection
        action={buildAction({ status: 'OPEN' })}
        canTransition
        onChanged={vi.fn()}
      />,
    );

    expect(screen.queryByText('Concluída em')).not.toBeInTheDocument();
    expect(screen.queryByText('Reaberta em')).not.toBeInTheDocument();
  });

  it('renders only "Concluída em" for a COMPLETED action that was never reopened', () => {
    render(
      <ActionLifecycleSection
        action={buildAction({ status: 'COMPLETED', completedAt: '2026-02-01T10:00:00.000Z' })}
        canTransition
        onChanged={vi.fn()}
      />,
    );

    expect(screen.getByText('Concluída em')).toBeInTheDocument();
    expect(screen.queryByText('Reaberta em')).not.toBeInTheDocument();
  });

  it('on a reopened action, renders ONLY "Reaberta em" — "Concluída em" is correctly absent because the server clears completedAt on reopen', () => {
    render(
      <ActionLifecycleSection
        action={buildAction({
          status: 'OPEN',
          completedAt: null,
          reopenedAt: '2026-02-05T09:00:00.000Z',
        })}
        canTransition
        onChanged={vi.fn()}
      />,
    );

    expect(screen.getByText('Reaberta em')).toBeInTheDocument();
    expect(screen.queryByText('Concluída em')).not.toBeInTheDocument();
    expect(screen.getAllByText('Atual').length).toBeGreaterThan(0);
    expect(screen.queryByText('Concluído')).not.toBeInTheDocument();
  });
});
