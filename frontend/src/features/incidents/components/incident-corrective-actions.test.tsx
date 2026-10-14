import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { IncidentCorrectiveActions } from './incident-corrective-actions';

import type { UserRef } from '../types';
import type { Action } from '@/features/actions/types';

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
  incidentsApi: { searchUsers: searchUsersMock },
}));

const responsible: UserRef = { id: 'user-1', fullName: 'Ana Souza' };

function actionFixture(overrides: Partial<Action> = {}): Action {
  return {
    id: 'action-1',
    code: 'ACT-2026-0001',
    orgUnit: { id: 'org-1', name: 'Unidade de teste' },
    originType: 'INCIDENT',
    originId: 'incident-1',
    originLabel: 'INC-2026-0001',
    title: 'Corrigir causa do incidente',
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

describe('IncidentCorrectiveActions', () => {
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
      <IncidentCorrectiveActions incidentId="incident-1" canCreate={false} canTransition={false} />,
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
      <IncidentCorrectiveActions incidentId="incident-1" canCreate={false} canTransition={false} />,
    );

    await screen.findByText('Corrigir causa do incidente');
    expect(screen.queryByRole('button', { name: 'Ações' })).not.toBeInTheDocument();
  });

  it('creates a new corrective action with originType INCIDENT and this incident as origin', async () => {
    listActionsMock.mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 });
    createActionMock.mockResolvedValue(actionFixture({ title: 'Nova ação corretiva' }));

    render(<IncidentCorrectiveActions incidentId="incident-1" canCreate canTransition={false} />);

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
      originType: 'INCIDENT',
      originId: 'incident-1',
      title: 'Nova ação corretiva',
      description: undefined,
      responsibleUserId: 'user-1',
      dueOn: '2026-12-31',
    });
  });

  it('refuses to submit the create form without a responsible person or due date', async () => {
    listActionsMock.mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 });

    render(<IncidentCorrectiveActions incidentId="incident-1" canCreate canTransition={false} />);

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

    render(<IncidentCorrectiveActions incidentId="incident-1" canCreate={false} canTransition />);

    await screen.findByText('Corrigir causa do incidente');
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Ações' }));
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Iniciar' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Cancelar' })).toBeInTheDocument();
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

    render(<IncidentCorrectiveActions incidentId="incident-1" canCreate={false} canTransition />);

    await screen.findByText('Corrigir causa do incidente');
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Ações' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Reabrir' }));

    const dialog = await screen.findByRole('dialog');
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
