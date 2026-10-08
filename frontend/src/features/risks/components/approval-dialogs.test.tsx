import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-client';

import { ApprovalDecisionDialog, RequestApprovalDialog } from './approval-dialogs';

import type { Approval, AvailableRiskTransition } from '../types';

const { requestApprovalMock, decideApprovalMock } = vi.hoisted(() => ({
  requestApprovalMock: vi.fn(),
  decideApprovalMock: vi.fn(),
}));

vi.mock('../api', () => ({
  risksApi: { requestApproval: requestApprovalMock, decideApproval: decideApprovalMock },
}));

const acceptedTransition: AvailableRiskTransition = {
  toStatus: 'ACCEPTED',
  requiredPermission: 'risk:transition',
  requiresApproval: true,
  preconditionsMet: true,
};

function approvalFixture(overrides: Partial<Approval> = {}): Approval {
  return {
    id: 'approval-1',
    requestedTransition: 'UNDER_TREATMENT->ACCEPTED',
    requestedBy: { id: 'user-analyst', fullName: 'Bruno Lima' },
    requestedAt: '2026-01-10T12:00:00.000Z',
    status: 'PENDING',
    decidedBy: null,
    decidedAt: null,
    justification: null,
    ...overrides,
  };
}

describe('RequestApprovalDialog', () => {
  beforeEach(() => {
    requestApprovalMock.mockReset();
  });

  it('names the target status in the title', () => {
    render(
      <RequestApprovalDialog
        open
        onOpenChange={() => undefined}
        riskId="risk-1"
        etag='"3"'
        transition={acceptedTransition}
        onRequested={() => undefined}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'Solicitar aprovação para "Aceito"' }),
    ).toBeInTheDocument();
  });

  it('requests the approval with the entered justification and reports success', async () => {
    requestApprovalMock.mockResolvedValue({
      approval: approvalFixture(),
      etag: '"3"',
    });
    const onRequested = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <RequestApprovalDialog
        open
        onOpenChange={onOpenChange}
        riskId="risk-1"
        etag='"3"'
        transition={acceptedTransition}
        onRequested={onRequested}
      />,
    );

    fireEvent.change(screen.getByLabelText('Justificativa'), {
      target: { value: 'Impacto residual dentro do apetite de risco aprovado.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar aprovação' }));

    await waitFor(() => expect(requestApprovalMock).toHaveBeenCalledTimes(1));
    expect(requestApprovalMock).toHaveBeenCalledWith(
      'risk-1',
      {
        toStatus: 'ACCEPTED',
        justification: 'Impacto residual dentro do apetite de risco aprovado.',
      },
      '"3"',
    );
    await waitFor(() => expect(onRequested).toHaveBeenCalledTimes(1));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('requests without a justification when none was entered (optional per the contract)', async () => {
    requestApprovalMock.mockResolvedValue({ approval: approvalFixture(), etag: '"3"' });

    render(
      <RequestApprovalDialog
        open
        onOpenChange={() => undefined}
        riskId="risk-1"
        etag='"3"'
        transition={acceptedTransition}
        onRequested={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar aprovação' }));

    await waitFor(() => expect(requestApprovalMock).toHaveBeenCalledTimes(1));
    expect(requestApprovalMock).toHaveBeenCalledWith(
      'risk-1',
      { toStatus: 'ACCEPTED', justification: undefined },
      '"3"',
    );
  });

  it('shows the server-localized detail on a 409 conflict', async () => {
    requestApprovalMock.mockRejectedValue(
      new ApiError({
        title: 'Conflito',
        status: 409,
        detail: 'Já existe uma aprovação pendente para este risco.',
      }),
    );

    render(
      <RequestApprovalDialog
        open
        onOpenChange={() => undefined}
        riskId="risk-1"
        etag='"3"'
        transition={acceptedTransition}
        onRequested={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar aprovação' }));

    expect(
      await screen.findByText('Já existe uma aprovação pendente para este risco.'),
    ).toBeInTheDocument();
  });
});

describe('ApprovalDecisionDialog', () => {
  beforeEach(() => {
    decideApprovalMock.mockReset();
  });

  it('states plainly who requested what, and when (governance record, not a bare confirm)', () => {
    render(
      <ApprovalDecisionDialog
        open
        onOpenChange={() => undefined}
        riskId="risk-1"
        etag='"3"'
        approval={approvalFixture()}
        decision="APPROVED"
        onDecided={() => undefined}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Aprovar transição' })).toBeInTheDocument();
    expect(screen.getByText(/Bruno Lima/)).toBeInTheDocument();
    expect(screen.getByText(/Em tratamento → Aceito/)).toBeInTheDocument();
    expect(
      screen.getByText('Esta decisão é registrada permanentemente e não poderá ser desfeita.'),
    ).toBeInTheDocument();
  });

  it('approves without requiring a justification', async () => {
    decideApprovalMock.mockResolvedValue({
      approval: approvalFixture({ status: 'APPROVED' }),
      etag: '"4"',
    });
    const onDecided = vi.fn();

    render(
      <ApprovalDecisionDialog
        open
        onOpenChange={() => undefined}
        riskId="risk-1"
        etag='"3"'
        approval={approvalFixture()}
        decision="APPROVED"
        onDecided={onDecided}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar aprovação' }));

    await waitFor(() => expect(decideApprovalMock).toHaveBeenCalledTimes(1));
    expect(decideApprovalMock).toHaveBeenCalledWith(
      'risk-1',
      'approval-1',
      { decision: 'APPROVED', justification: undefined },
      '"3"',
    );
    await waitFor(() => expect(onDecided).toHaveBeenCalledTimes(1));
  });

  it('refuses to submit a rejection without a justification, and never calls the API (US6 AS7)', () => {
    render(
      <ApprovalDecisionDialog
        open
        onOpenChange={() => undefined}
        riskId="risk-1"
        etag='"3"'
        approval={approvalFixture()}
        decision="REJECTED"
        onDecided={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar rejeição' }));

    expect(screen.getByText('Informe a justificativa da rejeição.')).toBeInTheDocument();
    expect(decideApprovalMock).not.toHaveBeenCalled();
  });

  it('rejects once a justification is entered', async () => {
    decideApprovalMock.mockResolvedValue({
      approval: approvalFixture({ status: 'REJECTED' }),
      etag: '"4"',
    });

    render(
      <ApprovalDecisionDialog
        open
        onOpenChange={() => undefined}
        riskId="risk-1"
        etag='"3"'
        approval={approvalFixture()}
        decision="REJECTED"
        onDecided={() => undefined}
      />,
    );
    fireEvent.change(screen.getByLabelText('Justificativa'), {
      target: { value: 'Tratamento ainda insuficiente para o nível residual apurado.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar rejeição' }));

    await waitFor(() => expect(decideApprovalMock).toHaveBeenCalledTimes(1));
    expect(decideApprovalMock).toHaveBeenCalledWith(
      'risk-1',
      'approval-1',
      {
        decision: 'REJECTED',
        justification: 'Tratamento ainda insuficiente para o nível residual apurado.',
      },
      '"3"',
    );
  });

  it("surfaces the server's own segregation-of-duties refusal verbatim (FR-029a) rather than a generic error", async () => {
    decideApprovalMock.mockRejectedValue(
      new ApiError({
        title: 'Não processável',
        status: 422,
        detail: 'O usuário que solicitou esta transição não pode decidir sua própria solicitação.',
      }),
    );

    render(
      <ApprovalDecisionDialog
        open
        onOpenChange={() => undefined}
        riskId="risk-1"
        etag='"3"'
        approval={approvalFixture()}
        decision="APPROVED"
        onDecided={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar aprovação' }));

    expect(
      await screen.findByText(
        'O usuário que solicitou esta transição não pode decidir sua própria solicitação.',
      ),
    ).toBeInTheDocument();
  });
});
