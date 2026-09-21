import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProblemLifecycleActions } from './problem-lifecycle-actions';

import type { ProblemDetail } from '../types';

/**
 * Component-mount evidence for `ProblemLifecycleActions`
 * (019-problem-detail-experience, Fase B) — written when this component lost
 * its own `Card` wrapper and its "Nenhuma transição disponível" sentence
 * (both moved to/retired by `ProblemLifecycleSection`, its new caller).
 * `../api` is mocked at the network boundary.
 *
 * The central assertion, unchanged from before this phase and NOT weakened
 * by it (the coordinator's explicit instruction): an illegal transition is
 * never rendered as a disabled/refused button — it is simply absent. A
 * `CLOSED`/`CANCELLED` problem, or a caller without `problem:transition`,
 * therefore renders nothing from THIS component, and every other status
 * renders EXACTLY the buttons `availableProblemTransitions` names, never
 * more, never fewer.
 *
 * ## Scope of "renders nothing" (Fase B)
 *
 * This component is mounted here in isolation, exactly as it always was —
 * `toBeEmptyDOMElement()` below is true because THIS component still
 * returns `null` under the same two conditions it always effectively had
 * (`!canTransition || availableTransitions.length === 0`), not because a
 * surrounding card disappears. Since this phase, the caller
 * (`components/detail/problem-lifecycle-section.tsx`) embeds this component
 * inside a persistent "Ciclo de vida" card that keeps rendering the
 * read-only track regardless of what this component returns — that
 * composition is that suite's own concern, not this one's.
 */
const { transitionMock } = vi.hoisted(() => ({
  transitionMock: vi.fn(),
}));

vi.mock('../api', () => ({
  problemsApi: {
    transition: transitionMock,
  },
}));

function buildProblem(overrides: Partial<ProblemDetail> = {}): ProblemDetail {
  return {
    id: 'problem-1',
    code: 'PRB-2026-0001',
    title: 'Falhas recorrentes de autenticação',
    description: 'Investigação da causa raiz das falhas recorrentes.',
    severity: 'HIGH',
    status: 'OPEN',
    orgUnit: { id: 'org-1', code: 'ORG-1', name: 'Unidade de teste' },
    owner: { id: 'user-1', fullName: 'Ana Souza' },
    identifiedOn: '2026-02-01',
    ...overrides,
  };
}

describe('ProblemLifecycleActions', () => {
  beforeEach(() => {
    transitionMock.mockReset();
  });

  it('renders nothing for a caller without problem:transition (server-mirrored gate)', () => {
    const { container } = render(
      <ProblemLifecycleActions
        problem={buildProblem()}
        canTransition={false}
        onChanged={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for a terminal problem (CLOSED) even with permission', () => {
    const { container } = render(
      <ProblemLifecycleActions
        problem={buildProblem({ status: 'CLOSED' })}
        canTransition
        onChanged={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for a terminal problem (CANCELLED) even with permission', () => {
    const { container } = render(
      <ProblemLifecycleActions
        problem={buildProblem({ status: 'CANCELLED' })}
        canTransition
        onChanged={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('an OPEN problem offers exactly "Iniciar análise" and "Cancelar problema" — never "Resolver"/"Fechar"/"Reabrir"', () => {
    render(
      <ProblemLifecycleActions
        problem={buildProblem({ status: 'OPEN' })}
        canTransition
        onChanged={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Iniciar análise' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar problema' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resolver' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Fechar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reabrir' })).not.toBeInTheDocument();
  });

  it('an IN_ANALYSIS problem offers exactly "Resolver" and "Cancelar problema"', () => {
    render(
      <ProblemLifecycleActions
        problem={buildProblem({ status: 'IN_ANALYSIS' })}
        canTransition
        onChanged={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Resolver' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar problema' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Iniciar análise' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Fechar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reabrir' })).not.toBeInTheDocument();
  });

  it('a RESOLVED problem offers exactly "Fechar" and "Reabrir"', () => {
    render(
      <ProblemLifecycleActions
        problem={buildProblem({ status: 'RESOLVED' })}
        canTransition
        onChanged={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Fechar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reabrir' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resolver' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar problema' })).not.toBeInTheDocument();
  });

  it('"Cancelar problema" opens a dialog asking for the required cancellation reason, and refuses to submit empty', async () => {
    render(
      <ProblemLifecycleActions
        problem={buildProblem({ status: 'OPEN' })}
        canTransition
        onChanged={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar problema' }));
    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByText('Cancelar este problema?')).toBeInTheDocument();
    expect(
      within(dialog).getByLabelText('Motivo do cancelamento', { exact: false }),
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar' }));

    expect(
      await within(dialog).findByText('Informe o motivo do cancelamento.'),
    ).toBeInTheDocument();
    expect(transitionMock).not.toHaveBeenCalled();
  });

  it('"Iniciar análise" opens a dialog with no required field, and confirms via the generic "Confirmar" action', async () => {
    const onChanged = vi.fn();
    const updated = buildProblem({ status: 'IN_ANALYSIS' });
    transitionMock.mockResolvedValue(updated);

    render(
      <ProblemLifecycleActions
        problem={buildProblem({ status: 'OPEN' })}
        canTransition
        onChanged={onChanged}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar análise' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Iniciar análise deste problema?')).toBeInTheDocument();
    expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar' }));
    await waitFor(() =>
      expect(transitionMock).toHaveBeenCalledWith('problem-1', {
        toStatus: 'IN_ANALYSIS',
        rootCause: undefined,
        cancellationReason: undefined,
        reopenReason: undefined,
      }),
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(updated));
  });
});
