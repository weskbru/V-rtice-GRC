import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProblemCorrectiveActions } from './problem-corrective-actions';

import type { UserRef } from '../types';
import type { Action } from '@/features/actions/types';

/**
 * Component-mount evidence for the missing corrective-action affordance
 * (008-incidents-problems follow-up, 2026-09-11, data-model.md P2/P3):
 * before this component existed, `ProblemCloseDialog`'s own precondition
 * (a completed `Action` of `originType: 'PROBLEM'`) could never be
 * satisfied by a real user. `@/features/actions/api` and `../api` are
 * mocked at the network boundary — the same convention
 * `treatment-actions-table.test.tsx` (`features/risks`) establishes.
 */

const { listActionsMock, createActionMock, transitionActionMock } = vi.hoisted(() => ({
  listActionsMock: vi.fn(),
  createActionMock: vi.fn(),
  transitionActionMock: vi.fn(),
}));

vi.mock('@/features/actions/api', () => ({
  actionsApi: {
    listActions: listActionsMock,
    createAction: createActionMock,
    transitionAction: transitionActionMock,
  },
}));

const { searchUsersMock } = vi.hoisted(() => ({ searchUsersMock: vi.fn() }));

vi.mock('../api', () => ({
  problemsApi: { searchUsers: searchUsersMock },
}));

const responsible: UserRef = { id: 'user-1', fullName: 'Ana Souza' };

function actionFixture(overrides: Partial<Action> = {}): Action {
  return {
    id: 'action-1',
    code: 'ACT-2026-0001',
    orgUnit: { id: 'org-1', name: 'Unidade de teste' },
    originType: 'PROBLEM',
    originId: 'problem-1',
    originLabel: 'PRB-2026-0001',
    title: 'Corrigir causa raiz',
    description: null,
    responsible,
    dueOn: '2026-12-31',
    status: 'OPEN',
    overdue: false,
    completedAt: null,
    reopenedAt: null,
    createdAt: '2026-01-10T00:00:00.000Z',
    updatedAt: '2026-01-10T00:00:00.000Z',
    ...overrides,
  };
}

describe('ProblemCorrectiveActions', () => {
  beforeEach(() => {
    listActionsMock.mockReset();
    createActionMock.mockReset();
    transitionActionMock.mockReset();
    searchUsersMock.mockReset();
    searchUsersMock.mockResolvedValue({ data: [responsible], isPartial: false });
  });

  it('shows the honest empty state when no corrective action has been created yet', async () => {
    listActionsMock.mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 });

    render(
      <ProblemCorrectiveActions problemId="problem-1" canCreate={false} canTransition={false} />,
    );

    expect(await screen.findByText('Nenhuma ação corretiva registrada ainda.')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Adicionar ação corretiva' }),
    ).not.toBeInTheDocument();
  });

  it('hides the row-actions menu for a caller without action:edit', async () => {
    listActionsMock.mockResolvedValue({
      items: [actionFixture()],
      page: 1,
      pageSize: 20,
      total: 1,
    });

    render(
      <ProblemCorrectiveActions problemId="problem-1" canCreate={false} canTransition={false} />,
    );

    await screen.findByText('Corrigir causa raiz');
    expect(screen.queryByRole('button', { name: 'Ações' })).not.toBeInTheDocument();
  });

  it('creates a new corrective action with originType PROBLEM and this problem as origin', async () => {
    listActionsMock.mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 });
    createActionMock.mockResolvedValue(actionFixture({ title: 'Nova ação corretiva' }));

    render(<ProblemCorrectiveActions problemId="problem-1" canCreate canTransition={false} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar ação corretiva' }));
    fireEvent.change(screen.getByLabelText(/^Título/), {
      target: { value: 'Nova ação corretiva' },
    });
    fireEvent.click(screen.getByRole('combobox', { name: /^Responsável/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Ana Souza' }));
    fireEvent.change(screen.getByLabelText(/^Prazo/), { target: { value: '2026-12-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar ação' }));

    await waitFor(() => expect(createActionMock).toHaveBeenCalledTimes(1));
    expect(createActionMock).toHaveBeenCalledWith({
      originType: 'PROBLEM',
      originId: 'problem-1',
      title: 'Nova ação corretiva',
      description: undefined,
      responsibleUserId: 'user-1',
      dueOn: '2026-12-31',
    });
  });

  it('refuses to submit the create form without a responsible person or due date', async () => {
    listActionsMock.mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 });

    render(<ProblemCorrectiveActions problemId="problem-1" canCreate canTransition={false} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar ação corretiva' }));
    fireEvent.change(screen.getByLabelText(/^Título/), { target: { value: 'Título qualquer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar ação' }));

    expect(await screen.findByText('Selecione o responsável pela ação.')).toBeInTheDocument();
    expect(screen.getByText('Informe o prazo da ação.')).toBeInTheDocument();
    expect(createActionMock).not.toHaveBeenCalled();
  });

  it('offers only the legal transitions for the action´s current status, and applies a non-reason one immediately', async () => {
    listActionsMock.mockResolvedValue({
      items: [actionFixture({ status: 'OPEN' })],
      page: 1,
      pageSize: 20,
      total: 1,
    });
    transitionActionMock.mockResolvedValue(actionFixture({ status: 'IN_PROGRESS' }));

    render(<ProblemCorrectiveActions problemId="problem-1" canCreate={false} canTransition />);

    await screen.findByText('Corrigir causa raiz');
    // Radix's `DropdownMenuTrigger` opens on `pointerdown` (mouse) / `keydown`
    // (keyboard) — never a plain `click` — so `fireEvent.pointerDown` is
    // required here; a `click` alone leaves the menu closed.
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Ações' }));
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Iniciar' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Cancelar' })).toBeInTheDocument();
    // OPEN never offers "Concluir" or "Reabrir" directly — those exist only
    // from IN_PROGRESS/COMPLETED respectively (`features/actions/status.ts`).
    expect(within(menu).queryByRole('menuitem', { name: 'Concluir' })).not.toBeInTheDocument();

    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Iniciar' }));

    await waitFor(() =>
      expect(transitionActionMock).toHaveBeenCalledWith('action-1', { to: 'IN_PROGRESS' }),
    );
  });

  it('routes the COMPLETED -> OPEN transition through the reason dialog, never applying it directly', async () => {
    listActionsMock.mockResolvedValue({
      items: [actionFixture({ status: 'COMPLETED', completedAt: '2026-02-01T00:00:00.000Z' })],
      page: 1,
      pageSize: 20,
      total: 1,
    });
    transitionActionMock.mockResolvedValue(actionFixture({ status: 'OPEN' }));

    render(<ProblemCorrectiveActions problemId="problem-1" canCreate={false} canTransition />);

    await screen.findByText('Corrigir causa raiz');
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Ações' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Reabrir' }));

    const dialog = await screen.findByRole('dialog');
    // Confirming without a reason must not call the API — the dialog's own
    // client-side courtesy check (never the actual gate, CLAUDE.md §18.9).
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar' }));
    expect(transitionActionMock).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText(/^Motivo da reabertura/), {
      target: { value: 'Correção incompleta, reabrindo para complementar.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar' }));

    await waitFor(() =>
      expect(transitionActionMock).toHaveBeenCalledWith('action-1', {
        to: 'OPEN',
        reason: 'Correção incompleta, reabrindo para complementar.',
      }),
    );
  });
});
