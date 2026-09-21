import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FindingRemediationAction } from './finding-remediation-action';

import type { Finding } from '../types';

/**
 * Component-mount evidence for T077 (`FindingRemediationAction`,
 * 005-audit-findings, US2, FR-009, research.md D-10) — the first, and only
 * missing, direct `OPEN -> IN_REMEDIATION` transition (quickstart.md §4).
 */

const { startRemediationMock, getFindingMock } = vi.hoisted(() => ({
  startRemediationMock: vi.fn(),
  getFindingMock: vi.fn(),
}));

vi.mock('../api', () => ({
  findingsApi: { startRemediation: startRemediationMock, getFinding: getFindingMock },
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
    status: 'OPEN',
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
  startRemediationMock.mockReset();
  getFindingMock.mockReset();
});

describe('FindingRemediationAction', () => {
  it('renders nothing for a finding that is not OPEN', () => {
    const { container } = render(
      <FindingRemediationAction
        finding={findingFixture({ status: 'IN_REMEDIATION' })}
        onRemediated={() => undefined}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('moves an OPEN finding to IN_REMEDIATION after confirming, then reports the refetched finding', async () => {
    startRemediationMock.mockResolvedValue({ id: 'finding-1', status: 'IN_REMEDIATION' });
    getFindingMock.mockResolvedValue(findingFixture({ status: 'IN_REMEDIATION' }));
    const onRemediated = vi.fn();

    render(<FindingRemediationAction finding={findingFixture()} onRemediated={onRemediated} />);

    fireEvent.click(screen.getByRole('button', { name: 'Mover para remediação' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => expect(startRemediationMock).toHaveBeenCalledWith('finding-1'));
    await waitFor(() => expect(getFindingMock).toHaveBeenCalledWith('finding-1'));
    await waitFor(() =>
      expect(onRemediated).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'finding-1', status: 'IN_REMEDIATION' }),
      ),
    );
  });

  it('surfaces the not-OPEN refusal distinctly on a 422 (stale UI / race)', async () => {
    const { ApiError } = await import('@/lib/api-client');
    startRemediationMock.mockRejectedValue(
      new ApiError({ status: 422, title: 'Não processável', type: 'about:blank' }),
    );

    render(<FindingRemediationAction finding={findingFixture()} onRemediated={() => undefined} />);

    fireEvent.click(screen.getByRole('button', { name: 'Mover para remediação' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar' }));

    await screen.findByText('Só é possível mover para remediação um achado que esteja "Aberto".');
  });
});
