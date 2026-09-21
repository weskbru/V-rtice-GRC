import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ControlAssessmentHistory } from './control-assessment-history';

import type { ControlAssessment, Page } from '../types';

/**
 * Component-mount evidence for T048 (US2, FR-016 to FR-020, D-3) — the two
 * segregation-of-duties rules must be explained proactively and the decide
 * controls must be withheld client-side from the assessor and from the
 * control's owner (an advisory courtesy; the server is the sole authority
 * regardless).
 */
const { listAssessmentsMock, requestAttestationMock } = vi.hoisted(() => ({
  listAssessmentsMock: vi.fn(),
  requestAttestationMock: vi.fn(),
}));

vi.mock('../api', () => ({
  controlsApi: {
    listAssessments: listAssessmentsMock,
    requestAttestation: requestAttestationMock,
  },
}));

function assessment(overrides: Partial<ControlAssessment> = {}): ControlAssessment {
  return {
    id: 'assessment-1',
    assessedOn: '2026-08-01',
    assessor: { id: 'assessor-1', fullName: 'Carlos Lima' },
    result: 'EFFECTIVE',
    conclusion: 'Amostragem de 25 acessos revisada, todos aderentes.',
    attestation: null,
    createdAt: '2026-08-01T10:00:00.000Z',
    ...overrides,
  };
}

function page(items: readonly ControlAssessment[]): Page<ControlAssessment> {
  return { data: items, meta: { page: 1, pageSize: 20, total: items.length, totalPages: 1 } };
}

describe('ControlAssessmentHistory', () => {
  it('renders every past assessment, never an edit or delete affordance (FR-010)', async () => {
    listAssessmentsMock.mockResolvedValueOnce(page([assessment()]));
    render(
      <ControlAssessmentHistory
        controlId="control-1"
        controlOwnerId="owner-1"
        currentUserId="viewer-1"
        canTest={false}
        canApprove={false}
      />,
    );

    await waitFor(() => expect(screen.getByText('Carlos Lima')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /excluir/i })).not.toBeInTheDocument();
  });

  it('shows the two segregation rules proactively to a user who can approve', async () => {
    listAssessmentsMock.mockResolvedValueOnce(page([]));
    render(
      <ControlAssessmentHistory
        controlId="control-1"
        controlOwnerId="owner-1"
        currentUserId="approver-1"
        canTest={false}
        canApprove
      />,
    );

    await waitFor(() =>
      expect(screen.getByText('Quem não pode atestar esta verificação')).toBeInTheDocument(),
    );
    expect(screen.getByText('Quem executou a verificação não pode atestá-la.')).toBeInTheDocument();
    expect(
      screen.getByText('O responsável pelo controle não pode atestar verificações desse controle.'),
    ).toBeInTheDocument();
  });

  it('withholds the decide controls from the assessor, even when they hold control:approve', async () => {
    listAssessmentsMock.mockResolvedValueOnce(
      page([
        assessment({
          assessor: { id: 'same-user', fullName: 'Carlos Lima' },
          attestation: {
            id: 'att-1',
            status: 'PENDING',
            requestedBy: { id: 'same-user', fullName: 'Carlos Lima' },
            requestedAt: '2026-08-02T10:00:00.000Z',
            decidedBy: null,
            decidedAt: null,
            justification: null,
          },
        }),
      ]),
    );
    render(
      <ControlAssessmentHistory
        controlId="control-1"
        controlOwnerId="owner-1"
        currentUserId="same-user"
        canTest={false}
        canApprove
      />,
    );

    await waitFor(() => expect(screen.getByText('Pendente de atestação')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Atestar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rejeitar' })).not.toBeInTheDocument();
  });

  it('withholds the decide controls from the control owner, even when they hold control:approve', async () => {
    listAssessmentsMock.mockResolvedValueOnce(
      page([
        assessment({
          assessor: { id: 'assessor-1', fullName: 'Carlos Lima' },
          attestation: {
            id: 'att-1',
            status: 'PENDING',
            requestedBy: { id: 'assessor-1', fullName: 'Carlos Lima' },
            requestedAt: '2026-08-02T10:00:00.000Z',
            decidedBy: null,
            decidedAt: null,
            justification: null,
          },
        }),
      ]),
    );
    render(
      <ControlAssessmentHistory
        controlId="control-1"
        controlOwnerId="owner-1"
        currentUserId="owner-1"
        canTest={false}
        canApprove
      />,
    );

    await waitFor(() => expect(screen.getByText('Pendente de atestação')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Atestar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rejeitar' })).not.toBeInTheDocument();
  });

  it('offers the decide controls to a qualified third-party approver', async () => {
    listAssessmentsMock.mockResolvedValueOnce(
      page([
        assessment({
          assessor: { id: 'assessor-1', fullName: 'Carlos Lima' },
          attestation: {
            id: 'att-1',
            status: 'PENDING',
            requestedBy: { id: 'assessor-1', fullName: 'Carlos Lima' },
            requestedAt: '2026-08-02T10:00:00.000Z',
            decidedBy: null,
            decidedAt: null,
            justification: null,
          },
        }),
      ]),
    );
    render(
      <ControlAssessmentHistory
        controlId="control-1"
        controlOwnerId="owner-1"
        currentUserId="third-party-1"
        canTest={false}
        canApprove
      />,
    );

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Atestar' })).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Rejeitar' })).toBeInTheDocument();
  });

  it('offers "Solicitar atestação" only when there is no attestation yet and the caller holds control:test', async () => {
    listAssessmentsMock.mockResolvedValueOnce(page([assessment({ attestation: null })]));
    render(
      <ControlAssessmentHistory
        controlId="control-1"
        controlOwnerId="owner-1"
        currentUserId="tester-1"
        canTest
        canApprove={false}
      />,
    );

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Solicitar atestação' })).toBeInTheDocument(),
    );
  });

  it('offers "Abrir ação de remediação" for an ineffective result, never for an effective one', async () => {
    listAssessmentsMock.mockResolvedValueOnce(
      page([
        assessment({ id: 'a1', result: 'INEFFECTIVE' }),
        assessment({ id: 'a2', result: 'EFFECTIVE' }),
      ]),
    );
    render(
      <ControlAssessmentHistory
        controlId="control-1"
        controlOwnerId="owner-1"
        currentUserId="viewer-1"
        canTest={false}
        canApprove={false}
      />,
    );

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'Abrir ação de remediação' })).toHaveLength(1),
    );
  });

  it('shows "Nenhuma verificação registrada" when the control has never been assessed', async () => {
    listAssessmentsMock.mockResolvedValueOnce(page([]));
    render(
      <ControlAssessmentHistory
        controlId="control-1"
        controlOwnerId={null}
        currentUserId="viewer-1"
        canTest={false}
        canApprove={false}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByText('Nenhuma verificação registrada para este controle.'),
      ).toBeInTheDocument(),
    );
  });

  it('requests attestation and shows a pending badge afterward', async () => {
    listAssessmentsMock.mockResolvedValueOnce(page([assessment({ attestation: null })]));
    requestAttestationMock.mockResolvedValueOnce({
      id: 'att-1',
      status: 'PENDING',
      requestedBy: { id: 'tester-1', fullName: 'Tester' },
      requestedAt: '2026-08-02T10:00:00.000Z',
      decidedBy: null,
      decidedAt: null,
      justification: null,
    });
    listAssessmentsMock.mockResolvedValueOnce(
      page([
        assessment({
          attestation: {
            id: 'att-1',
            status: 'PENDING',
            requestedBy: { id: 'tester-1', fullName: 'Tester' },
            requestedAt: '2026-08-02T10:00:00.000Z',
            decidedBy: null,
            decidedAt: null,
            justification: null,
          },
        }),
      ]),
    );

    render(
      <ControlAssessmentHistory
        controlId="control-1"
        controlOwnerId="owner-1"
        currentUserId="tester-1"
        canTest
        canApprove={false}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Solicitar atestação' }));

    await waitFor(() =>
      expect(requestAttestationMock).toHaveBeenCalledWith('control-1', 'assessment-1'),
    );
    await waitFor(() => expect(screen.getByText('Pendente de atestação')).toBeInTheDocument());
  });
});
