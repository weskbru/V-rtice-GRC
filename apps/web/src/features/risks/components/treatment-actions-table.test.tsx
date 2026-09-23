import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TreatmentActionsTable } from './treatment-actions-table';

import type { RiskTreatmentAction, TreatmentActionSummary, UserRef } from '../types';

const {
  listTreatmentActionsMock,
  searchUsersMock,
  createTreatmentActionMock,
  updateTreatmentActionMock,
} = vi.hoisted(() => ({
  listTreatmentActionsMock: vi.fn(),
  searchUsersMock: vi.fn(),
  createTreatmentActionMock: vi.fn(),
  updateTreatmentActionMock: vi.fn(),
}));

vi.mock('../api', () => ({
  risksApi: {
    listTreatmentActions: listTreatmentActionsMock,
    searchUsers: searchUsersMock,
    createTreatmentAction: createTreatmentActionMock,
    updateTreatmentAction: updateTreatmentActionMock,
  },
}));

const owner: UserRef = { id: 'user-1', fullName: 'Ana Souza' };

function actionFixture(overrides: Partial<RiskTreatmentAction> = {}): RiskTreatmentAction {
  return {
    id: 'action-1',
    treatmentDecisionId: 'decision-1',
    title: 'Implementar controle X',
    description: null,
    responsible: owner,
    dueOn: '2026-12-31',
    status: 'OPEN',
    overdue: false,
    completedAt: null,
    createdAt: '2026-01-10T00:00:00.000Z',
    ...overrides,
  };
}

const zeroSummary: TreatmentActionSummary = { total: 0, open: 0, overdue: 0 };

describe('TreatmentActionsTable', () => {
  beforeEach(() => {
    listTreatmentActionsMock.mockReset();
    searchUsersMock.mockReset();
    createTreatmentActionMock.mockReset();
    updateTreatmentActionMock.mockReset();
    searchUsersMock.mockResolvedValue({ data: [owner], isPartial: false });
  });

  it('shows the honest empty state when no action has been recorded yet', async () => {
    listTreatmentActionsMock.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
    });

    render(
      <TreatmentActionsTable
        riskId="risk-1"
        etag='"1"'
        canTreat={false}
        currentTreatmentId={null}
        summary={zeroSummary}
        onEtagChanged={() => undefined}
        onChanged={() => undefined}
      />,
    );

    expect(
      await screen.findByText('Nenhuma ação de tratamento registrada ainda.'),
    ).toBeInTheDocument();
  });

  it('conveys an overdue action with text, not colour alone (SC-012) — reading the SERVER-computed flag, never recomputing it', async () => {
    listTreatmentActionsMock.mockResolvedValue({
      data: [
        actionFixture({ id: 'a1', title: 'Ação vencida', dueOn: '2020-01-01', overdue: true }),
        actionFixture({ id: 'a2', title: 'Ação futura', dueOn: '2099-01-01', overdue: false }),
      ],
      meta: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
    });

    render(
      <TreatmentActionsTable
        riskId="risk-1"
        etag='"1"'
        canTreat={false}
        currentTreatmentId={null}
        summary={{ total: 2, open: 2, overdue: 1 }}
        onEtagChanged={() => undefined}
        onChanged={() => undefined}
      />,
    );

    await screen.findByText('Ação vencida');
    expect(screen.getAllByText('Vencida')).toHaveLength(1);
    expect(screen.queryByText('Ação futura')?.closest('tr')?.textContent).not.toContain('Vencida');
  });

  it('shows the plan-level summary from data already loaded by the risk detail screen', async () => {
    listTreatmentActionsMock.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
    });

    render(
      <TreatmentActionsTable
        riskId="risk-1"
        etag='"1"'
        canTreat={false}
        currentTreatmentId={null}
        summary={{ total: 3, open: 2, overdue: 1 }}
        onEtagChanged={() => undefined}
        onChanged={() => undefined}
      />,
    );

    expect(await screen.findByText('3 ações no total')).toBeInTheDocument();
    expect(screen.getByText('1 atrasada')).toBeInTheDocument();
  });

  it('hides the add-action control AND the row-actions menu for a caller without risk:treat', async () => {
    listTreatmentActionsMock.mockResolvedValue({
      data: [actionFixture()],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });

    render(
      <TreatmentActionsTable
        riskId="risk-1"
        etag='"1"'
        canTreat={false}
        currentTreatmentId={null}
        summary={{ total: 1, open: 1, overdue: 0 }}
        onEtagChanged={() => undefined}
        onChanged={() => undefined}
      />,
    );

    await screen.findByText('Implementar controle X');
    expect(screen.queryByRole('button', { name: 'Adicionar ação' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ações' })).not.toBeInTheDocument();
  });

  it('links the action title to its own detail page', async () => {
    listTreatmentActionsMock.mockResolvedValue({
      data: [actionFixture()],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });

    render(
      <TreatmentActionsTable
        riskId="risk-1"
        etag='"1"'
        canTreat={false}
        currentTreatmentId={null}
        summary={{ total: 1, open: 1, overdue: 0 }}
        onEtagChanged={() => undefined}
        onChanged={() => undefined}
      />,
    );

    const link = await screen.findByRole('link', { name: 'Implementar controle X' });
    expect(link).toHaveAttribute('href', '/actions/action-1');
  });

  it('creates a new action attached to the current treatment decision, reports the fresh ETag and notifies the caller to refresh the risk', async () => {
    listTreatmentActionsMock.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
    });
    createTreatmentActionMock.mockResolvedValue({
      action: actionFixture({ title: 'Nova ação' }),
      etag: '"2"',
    });
    const onEtagChanged = vi.fn();
    const onChanged = vi.fn();

    render(
      <TreatmentActionsTable
        riskId="risk-1"
        etag='"1"'
        canTreat
        currentTreatmentId="decision-1"
        summary={zeroSummary}
        onEtagChanged={onEtagChanged}
        onChanged={onChanged}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar ação' }));
    fireEvent.change(screen.getByLabelText(/^Título/), { target: { value: 'Nova ação' } });
    fireEvent.click(screen.getByRole('combobox', { name: /^Responsável/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Ana Souza' }));
    fireEvent.change(screen.getByLabelText(/^Prazo/), { target: { value: '2026-12-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar ação' }));

    await waitFor(() => expect(createTreatmentActionMock).toHaveBeenCalledTimes(1));
    expect(createTreatmentActionMock).toHaveBeenCalledWith(
      'risk-1',
      {
        title: 'Nova ação',
        description: null,
        responsibleUserId: 'user-1',
        dueOn: '2026-12-31',
        treatmentDecisionId: 'decision-1',
      },
      '"1"',
    );
    await waitFor(() => expect(onEtagChanged).toHaveBeenCalledWith('"2"'));
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Nova ação')).toBeInTheDocument();
  });

  it('offers only the legal transitions for the action´s current status, and applies a non-reason one through the RISK-owned route with If-Match', async () => {
    listTreatmentActionsMock.mockResolvedValue({
      data: [actionFixture({ status: 'OPEN' })],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
    updateTreatmentActionMock.mockResolvedValue({
      action: actionFixture({ status: 'IN_PROGRESS', overdue: false, completedAt: null }),
      etag: '"2"',
    });
    const onEtagChanged = vi.fn();
    const onChanged = vi.fn();

    render(
      <TreatmentActionsTable
        riskId="risk-1"
        etag='"1"'
        canTreat
        currentTreatmentId={null}
        summary={{ total: 1, open: 1, overdue: 0 }}
        onEtagChanged={onEtagChanged}
        onChanged={onChanged}
      />,
    );

    await screen.findByText('Implementar controle X');
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Ações' }));
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Editar' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Iniciar' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Cancelar' })).toBeInTheDocument();
    expect(within(menu).queryByRole('menuitem', { name: 'Concluir' })).not.toBeInTheDocument();

    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Iniciar' }));

    await waitFor(() => expect(updateTreatmentActionMock).toHaveBeenCalledTimes(1));
    expect(updateTreatmentActionMock).toHaveBeenCalledWith(
      'risk-1',
      'action-1',
      { status: 'IN_PROGRESS' },
      '"1"',
    );
    await waitFor(() => expect(onEtagChanged).toHaveBeenCalledWith('"2"'));
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('routes the COMPLETED -> OPEN transition through the reason dialog and the RISK-owned route, never applying it directly', async () => {
    listTreatmentActionsMock.mockResolvedValue({
      data: [
        actionFixture({
          status: 'COMPLETED',
          completedAt: '2026-02-01T00:00:00.000Z',
        }),
      ],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
    updateTreatmentActionMock.mockResolvedValue({
      action: actionFixture({ status: 'OPEN', completedAt: null, overdue: false }),
      etag: '"2"',
    });

    render(
      <TreatmentActionsTable
        riskId="risk-1"
        etag='"1"'
        canTreat
        currentTreatmentId={null}
        summary={{ total: 1, open: 0, overdue: 0 }}
        onEtagChanged={() => undefined}
        onChanged={() => undefined}
      />,
    );

    await screen.findByText('Implementar controle X');
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Ações' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Reabrir' }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar' }));
    expect(updateTreatmentActionMock).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText(/^Motivo da reabertura/), {
      target: { value: 'Correção incompleta, reabrindo para complementar.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar' }));

    await waitFor(() =>
      expect(updateTreatmentActionMock).toHaveBeenCalledWith(
        'risk-1',
        'action-1',
        { status: 'OPEN', reopenReason: 'Correção incompleta, reabrindo para complementar.' },
        '"1"',
      ),
    );
  });

  it('edits an existing action´s title/responsible/due date through the risk-owned PATCH route', async () => {
    listTreatmentActionsMock.mockResolvedValue({
      data: [actionFixture()],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
    const otherUser: UserRef = { id: 'user-2', fullName: 'Bruno Lima' };
    searchUsersMock.mockResolvedValue({ data: [owner, otherUser], isPartial: false });
    updateTreatmentActionMock.mockResolvedValue({
      action: actionFixture({ title: 'Título revisado', responsible: otherUser }),
      etag: '"3"',
    });
    const onEtagChanged = vi.fn();
    const onChanged = vi.fn();

    render(
      <TreatmentActionsTable
        riskId="risk-1"
        etag='"1"'
        canTreat
        currentTreatmentId={null}
        summary={{ total: 1, open: 1, overdue: 0 }}
        onEtagChanged={onEtagChanged}
        onChanged={onChanged}
      />,
    );

    await screen.findByText('Implementar controle X');
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Ações' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Editar' }));

    const dialog = await screen.findByRole('dialog');
    const titleInput = within(dialog).getByLabelText(/^Título/);
    fireEvent.change(titleInput, { target: { value: 'Título revisado' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(updateTreatmentActionMock).toHaveBeenCalledTimes(1));
    expect(updateTreatmentActionMock).toHaveBeenCalledWith(
      'risk-1',
      'action-1',
      {
        title: 'Título revisado',
        description: null,
        responsibleUserId: 'user-1',
        dueOn: '2026-12-31',
      },
      '"1"',
    );
    await waitFor(() => expect(onEtagChanged).toHaveBeenCalledWith('"3"'));
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Título revisado')).toBeInTheDocument();
  });
});
