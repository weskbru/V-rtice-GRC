import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RiskLifecycleActions } from './risk-lifecycle-actions';

import type { Approval, RiskLifecycleState } from '../types';

const { transitionRiskMock } = vi.hoisted(() => ({
  transitionRiskMock: vi.fn(),
}));

vi.mock('../api', () => ({
  risksApi: {
    transitionRisk: transitionRiskMock,
    requestApproval: vi.fn(),
    decideApproval: vi.fn(),
  },
}));

function approvalFixture(overrides: Partial<Approval> = {}): Approval {
  return {
    id: 'approval-1',
    requestedTransition: 'UNDER_TREATMENT->ACCEPTED',
    requestedBy: { id: 'user-analyst', fullName: 'Bruno Lima' },
    requestedAt: '2026-01-10T12:00:00.000Z',
    status: 'PENDING',
    decidedBy: null,
    decidedAt: null,
    justification: 'Impacto residual dentro do apetite de risco.',
    ...overrides,
  };
}

describe('RiskLifecycleActions', () => {
  beforeEach(() => {
    transitionRiskMock.mockReset();
  });

  it('shows the loading state exactly as handed to it, never fetching on its own', () => {
    render(
      <RiskLifecycleActions
        riskId="risk-1"
        etag='"1"'
        currentUserId="user-1"
        canApprove={false}
        lifecycle={null}
        loading
        loadError={false}
        onChanged={() => undefined}
      />,
    );

    expect(screen.getByText('Carregando transições disponíveis…')).toBeInTheDocument();
  });

  it('shows the load-error state exactly as handed to it', () => {
    render(
      <RiskLifecycleActions
        riskId="risk-1"
        etag='"1"'
        currentUserId="user-1"
        canApprove={false}
        lifecycle={null}
        loading={false}
        loadError
        onChanged={() => undefined}
      />,
    );

    expect(
      screen.getByText('Não foi possível carregar as transições disponíveis.'),
    ).toBeInTheDocument();
  });

  it('shows an honest "no transition available" message rather than an empty card', () => {
    const lifecycle: RiskLifecycleState = {
      status: 'DRAFT',
      pendingApproval: null,
      availableTransitions: [],
      traversedStatuses: ['DRAFT'],
    };

    render(
      <RiskLifecycleActions
        riskId="risk-1"
        etag='"1"'
        currentUserId="user-1"
        canApprove={false}
        lifecycle={lifecycle}
        loading={false}
        loadError={false}
        onChanged={() => undefined}
      />,
    );

    expect(
      screen.getByText('Nenhuma transição está disponível para o seu perfil neste momento.'),
    ).toBeInTheDocument();
  });

  it('offers an immediate transition with a different verb/icon than an approval-gated one (not colour alone)', () => {
    const lifecycle: RiskLifecycleState = {
      status: 'IDENTIFIED',
      pendingApproval: null,
      availableTransitions: [
        {
          toStatus: 'ASSESSED',
          requiredPermission: 'risk:assess',
          requiresApproval: false,
          preconditionsMet: true,
        },
        {
          toStatus: 'ACCEPTED',
          requiredPermission: 'risk:transition',
          requiresApproval: true,
          preconditionsMet: true,
        },
      ],
      traversedStatuses: ['DRAFT', 'IDENTIFIED'],
    };

    render(
      <RiskLifecycleActions
        riskId="risk-1"
        etag='"1"'
        currentUserId="user-1"
        canApprove={false}
        lifecycle={lifecycle}
        loading={false}
        loadError={false}
        onChanged={() => undefined}
      />,
    );

    expect(screen.getByRole('button', { name: 'Aplicar: Avaliado' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Solicitar aprovação: Aceito' })).toBeInTheDocument();

    expect(
      screen.getByText('Disponível para usuários autorizados a avaliar riscos neste escopo.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/risk:assess/)).not.toBeInTheDocument();
    expect(screen.queryByText(/risk:transition/)).not.toBeInTheDocument();

    expect(
      screen.getByText(
        'Disponível para usuários autorizados a conduzir o ciclo de vida do risco neste escopo. Esta transição exige aprovação por outro usuário autorizado.',
      ),
    ).toBeInTheDocument();
  });

  it('shows the unmet preconditions for a transition that is not yet available, rather than only disabling the button', () => {
    const lifecycle: RiskLifecycleState = {
      status: 'IDENTIFIED',
      pendingApproval: null,
      availableTransitions: [
        {
          toStatus: 'ASSESSED',
          requiredPermission: 'risk:assess',
          requiresApproval: false,
          preconditionsMet: false,
          unmetPreconditions: ['É necessário haver ao menos uma avaliação registrada.'],
        },
      ],
      traversedStatuses: ['DRAFT', 'IDENTIFIED'],
    };

    render(
      <RiskLifecycleActions
        riskId="risk-1"
        etag='"1"'
        currentUserId="user-1"
        canApprove={false}
        lifecycle={lifecycle}
        loading={false}
        loadError={false}
        onChanged={() => undefined}
      />,
    );

    expect(screen.getByRole('button', { name: 'Aplicar: Avaliado' })).toBeDisabled();
    expect(
      screen.getByText('É necessário haver ao menos uma avaliação registrada.'),
    ).toBeInTheDocument();
  });

  it('applies an immediate transition and reports it to the caller', async () => {
    const lifecycle: RiskLifecycleState = {
      status: 'IDENTIFIED',
      pendingApproval: null,
      availableTransitions: [
        {
          toStatus: 'ASSESSED',
          requiredPermission: 'risk:assess',
          requiresApproval: false,
          preconditionsMet: true,
        },
      ],
      traversedStatuses: ['DRAFT', 'IDENTIFIED'],
    };
    transitionRiskMock.mockResolvedValue({
      transition: {
        id: 'transition-1',
        fromStatus: 'IDENTIFIED',
        toStatus: 'ASSESSED',
        performedBy: { id: 'user-1', fullName: 'Ana Souza' },
        performedAt: '2026-01-11T00:00:00.000Z',
        justification: null,
        approvalId: null,
      },
      etag: '"2"',
    });
    const onChanged = vi.fn();

    render(
      <RiskLifecycleActions
        riskId="risk-1"
        etag='"1"'
        currentUserId="user-1"
        canApprove={false}
        lifecycle={lifecycle}
        loading={false}
        loadError={false}
        onChanged={onChanged}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar: Avaliado' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar transição' }));

    await waitFor(() => expect(transitionRiskMock).toHaveBeenCalledTimes(1));
    expect(transitionRiskMock).toHaveBeenCalledWith(
      'risk-1',
      { toStatus: 'ASSESSED', justification: undefined },
      '"1"',
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  });

  it('shows the pending approval, who requested it, and hides the decide controls with an explanation when the signed-in user is the requester (FR-029a)', () => {
    const lifecycle: RiskLifecycleState = {
      status: 'UNDER_TREATMENT',
      pendingApproval: approvalFixture({ requestedBy: { id: 'user-1', fullName: 'Ana Souza' } }),
      availableTransitions: [],
      traversedStatuses: ['DRAFT', 'IDENTIFIED', 'ASSESSED', 'UNDER_TREATMENT'],
    };

    render(
      <RiskLifecycleActions
        riskId="risk-1"
        etag='"1"'
        currentUserId="user-1"
        canApprove
        lifecycle={lifecycle}
        loading={false}
        loadError={false}
        onChanged={() => undefined}
      />,
    );

    expect(screen.getByText(/Solicitado por Ana Souza/)).toBeInTheDocument();
    expect(
      screen.getByText(
        'Você fez esta solicitação. Por segregação de funções, a decisão precisa ser tomada por outra pessoa com permissão para aprovar.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aprovar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rejeitar' })).not.toBeInTheDocument();
  });

  it('offers the decide controls to an eligible approver who is not the requester', () => {
    const lifecycle: RiskLifecycleState = {
      status: 'UNDER_TREATMENT',
      pendingApproval: approvalFixture({
        requestedBy: { id: 'user-analyst', fullName: 'Bruno Lima' },
      }),
      availableTransitions: [],
      traversedStatuses: ['DRAFT', 'IDENTIFIED', 'ASSESSED', 'UNDER_TREATMENT'],
    };

    render(
      <RiskLifecycleActions
        riskId="risk-1"
        etag='"1"'
        currentUserId="user-approver"
        canApprove
        lifecycle={lifecycle}
        loading={false}
        loadError={false}
        onChanged={() => undefined}
      />,
    );

    expect(screen.getByRole('button', { name: 'Aprovar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rejeitar' })).toBeInTheDocument();
  });

  it('hides the decide controls entirely for a caller without risk:approve, even for another user’s request', () => {
    const lifecycle: RiskLifecycleState = {
      status: 'UNDER_TREATMENT',
      pendingApproval: approvalFixture({
        requestedBy: { id: 'user-analyst', fullName: 'Bruno Lima' },
      }),
      availableTransitions: [],
      traversedStatuses: ['DRAFT', 'IDENTIFIED', 'ASSESSED', 'UNDER_TREATMENT'],
    };

    render(
      <RiskLifecycleActions
        riskId="risk-1"
        etag='"1"'
        currentUserId="user-approver"
        canApprove={false}
        lifecycle={lifecycle}
        loading={false}
        loadError={false}
        onChanged={() => undefined}
      />,
    );

    expect(screen.getByText(/Solicitado por Bruno Lima/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aprovar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rejeitar' })).not.toBeInTheDocument();
  });
});
