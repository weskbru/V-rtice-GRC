import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ActionLifecycleSection } from './action-lifecycle-section';

import type { Action } from '../../types';

/**
 * Component-mount evidence for the "Ciclo de vida" card
 * (020-action-detail-experience, Fase B). Guarantees this suite exists to
 * prove:
 *
 *   1. The behaviour change this rodada makes deliberately: the card keeps
 *      rendering its read-only track EVEN when `ActionLifecycleActions`
 *      itself renders nothing (`!canTransition` or a terminal status) — see
 *      this component's own header comment.
 *   2. The conditional outcome facts (`completedAt`/`reopenedAt`) render
 *      ONLY when the underlying value is actually present on the action —
 *      never "Não definido" for a fact that has not happened yet.
 *   3. The reopened case the coordinator asked to see proven end to end —
 *      corrected 2026-09-18 to match the REAL server behaviour
 *      (`action-lifecycle-track.ts`'s own header comment has the full
 *      story: `completedAt` is cleared by the reopen transition, confirmed
 *      by reading `TransitionActionUseCase` AND by `action-plan.spec.ts`'s
 *      Fase D E2E test failing against the real API when this suite's own
 *      earlier assumption was wrong). A reopened action therefore renders
 *      ONLY "Reaberta em" — "Concluída em" is correctly ABSENT, because the
 *      live record no longer proves completion.
 */

vi.mock('../../api', () => ({
  actionsApi: {
    transitionAction: vi.fn(() => new Promise(() => undefined)),
  },
}));

function buildAction(overrides: Partial<Action> = {}): Action {
  return {
    id: 'action-1',
    code: 'ACT-2026-0001',
    orgUnit: { id: 'org-1', name: 'PharosGRC' },
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
    // The track renders twice in the DOM (vertical below-`sm`, horizontal
    // `sm`+ — toggled with `hidden`/responsive `display`; jsdom applies no
    // real CSS layout to hide either copy from a query).
    expect(screen.getAllByText('Aberta').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Em andamento').length).toBeGreaterThan(0);
    // But no transition button — the row this component owns is gone.
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
    // The track reads like a fresh OPEN action — current, not completed.
    expect(screen.getAllByText('Atual').length).toBeGreaterThan(0);
    expect(screen.queryByText('Concluído')).not.toBeInTheDocument();
  });
});
