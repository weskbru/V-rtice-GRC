import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FindingCloseDialog } from './finding-close-dialog';

import type { Finding } from '../types';

/**
 * Component-mount evidence for T077 (`FindingCloseDialog`, 005-audit-findings,
 * FR-010). `../api` and `@/features/evidence/api` are mocked at the network
 * boundary, mirroring `findings-panel.test.tsx`'s own pattern. These tests
 * specifically exercise the ADDITIVE evidence requirement this phase
 * introduces on top of the pre-existing Invariant F1/F2 (segregation of
 * duties), which `findings-panel.test.tsx` already covers.
 */

const { closeFindingMock, listBySubjectMock } = vi.hoisted(() => ({
  closeFindingMock: vi.fn(),
  listBySubjectMock: vi.fn(),
}));

vi.mock('../api', () => ({
  findingsApi: { closeFinding: closeFindingMock },
}));

vi.mock('@/features/evidence/api', () => ({
  evidenceApi: { listBySubject: listBySubjectMock },
}));

function findingFixture(overrides: Partial<Finding> = {}): Finding {
  return {
    id: 'finding-1',
    code: 'FND-2026-0001',
    orgUnit: { id: 'org-1', name: 'Unidade de teste' },
    title: 'Segregação de funções não aplicada',
    description: 'A autoavaliação identificou uma não conformidade.',
    recommendation: null,
    category: 'NONCONFORMITY',
    origin: 'INTERNAL_ASSESSMENT',
    severity: 'HIGH',
    priority: 'HIGH',
    owner: { id: 'user-1', fullName: 'Ana Souza' },
    identifiedOn: '2026-02-01',
    status: 'IN_REMEDIATION',
    openActionCount: 0,
    evidenceCount: 0,
    closedAt: null,
    closureJustification: null,
    auditEngagementId: null,
    createdAt: '2026-02-01T10:00:00.000Z',
    updatedAt: '2026-02-01T10:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  closeFindingMock.mockReset();
  listBySubjectMock.mockReset();
});

describe('FindingCloseDialog', () => {
  it('shows the evidence requirement proactively, and disables closing, when no active evidence link exists', async () => {
    listBySubjectMock.mockResolvedValue({ items: [], page: 1, pageSize: 100, total: 0 });

    render(
      <FindingCloseDialog
        finding={findingFixture()}
        onOpenChange={() => undefined}
        onClosed={() => undefined}
      />,
    );

    await waitFor(() => expect(listBySubjectMock).toHaveBeenCalledWith('FINDING', 'finding-1'));

    await screen.findByText('Encerrar um achado agora exige evidência');
    const dialog = screen.getByRole('dialog');
    const confirmButton = within(dialog).getByRole('button', { name: 'Encerrar' });
    expect(confirmButton).toBeDisabled();
    expect(closeFindingMock).not.toHaveBeenCalled();
  });

  it("allows closing once at least one active evidence link exists, regardless of the evidence's own status", async () => {
    listBySubjectMock.mockResolvedValue({
      items: [{ id: 'evidence-1', status: 'ARCHIVED' }],
      page: 1,
      pageSize: 100,
      total: 1,
    });
    closeFindingMock.mockResolvedValue(findingFixture({ status: 'CLOSED' }));

    render(
      <FindingCloseDialog
        finding={findingFixture()}
        onOpenChange={() => undefined}
        onClosed={() => undefined}
      />,
    );

    await waitFor(() => expect(listBySubjectMock).toHaveBeenCalled());
    expect(screen.queryByText('Encerrar um achado agora exige evidência')).not.toBeInTheDocument();

    const dialog = screen.getByRole('dialog');
    const confirmButton = within(dialog).getByRole('button', { name: 'Encerrar' });
    expect(confirmButton).not.toBeDisabled();
  });

  it('distinguishes the segregation-of-duties refusal (403) from the evidence requirement (422)', async () => {
    const { ApiError } = await import('@/lib/api-client');
    listBySubjectMock.mockResolvedValue({
      items: [{ id: 'evidence-1' }],
      page: 1,
      pageSize: 100,
      total: 1,
    });
    closeFindingMock.mockRejectedValue(
      new ApiError({ status: 403, title: 'Proibido', type: 'about:blank' }),
    );

    const { unmount } = render(
      <FindingCloseDialog
        finding={findingFixture()}
        onOpenChange={() => undefined}
        onClosed={() => undefined}
      />,
    );

    await waitFor(() => expect(listBySubjectMock).toHaveBeenCalled());
    const dialog = screen.getByRole('dialog');
    const confirmButton = within(dialog).getByRole('button', { name: 'Encerrar' });
    fireEvent.click(confirmButton);

    await screen.findByText(
      'Quem executou a remediação não pode encerrar o achado. Peça que outra pessoa com permissão de encerramento realize esta ação.',
    );
    unmount();
  });

  it('does not block on a failed evidence check — the server remains the authority', async () => {
    listBySubjectMock.mockRejectedValue(new Error('network error'));

    render(
      <FindingCloseDialog
        finding={findingFixture()}
        onOpenChange={() => undefined}
        onClosed={() => undefined}
      />,
    );

    await waitFor(() => expect(listBySubjectMock).toHaveBeenCalled());
    const dialog = screen.getByRole('dialog');
    const confirmButton = within(dialog).getByRole('button', { name: 'Encerrar' });
    expect(confirmButton).not.toBeDisabled();
  });
});
