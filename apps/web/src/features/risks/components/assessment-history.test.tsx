import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AssessmentHistory } from './assessment-history';

import type { RiskAssessment } from '../types';

/**
 * Component-mount evidence for T131 (`AssessmentHistory`, FR-066,
 * Constitution VI — audit defensibility). `../api` is mocked at the network
 * boundary.
 */

const { listAssessmentsMock } = vi.hoisted(() => ({ listAssessmentsMock: vi.fn() }));

vi.mock('../api', () => ({
  risksApi: { listAssessments: listAssessmentsMock },
}));

function assessmentFixture(overrides: Partial<RiskAssessment>): RiskAssessment {
  return {
    id: 'assessment-x',
    assessedBy: { id: 'user-1', fullName: 'Ana Souza' },
    assessedOn: '2026-01-15',
    methodologyVersion: { id: 'methodology-v1', versionNumber: 1 },
    inherentProbability: 2,
    inherentImpact: 2,
    inherentScore: 4,
    inherentLevel: 'MEDIUM',
    residualProbability: 1,
    residualImpact: 1,
    residualScore: 1,
    residualLevel: 'LOW',
    controlsConsidered: [],
    rationale: null,
    previousAssessmentId: null,
    levelChange: { previousInherentLevel: null, previousResidualLevel: null, direction: null },
    ...overrides,
  };
}

describe('AssessmentHistory', () => {
  beforeEach(() => {
    listAssessmentsMock.mockReset();
  });

  it('shows the level change and attribution for a reassessment (FR-066)', async () => {
    const older = assessmentFixture({
      id: 'a1',
      assessedBy: { id: 'user-1', fullName: 'Ana Souza' },
      assessedOn: '2026-01-15',
      residualLevel: 'CRITICAL',
    });
    const newer = assessmentFixture({
      id: 'a2',
      assessedBy: { id: 'user-2', fullName: 'Carlos Lima' },
      assessedOn: '2026-03-01',
      residualScore: 6,
      residualLevel: 'HIGH',
      rationale: 'Novos controles aplicados.',
      previousAssessmentId: 'a1',
      levelChange: {
        previousInherentLevel: 'CRITICAL',
        previousResidualLevel: 'CRITICAL',
        direction: 'DECREASED',
      },
    });
    listAssessmentsMock.mockResolvedValueOnce({
      data: [newer, older],
      meta: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
    });

    render(<AssessmentHistory riskId="risk-1" />);

    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row');
    // Header row + two data rows, newest first.
    expect(rows).toHaveLength(3);

    expect(within(rows[1]!).getByText('Carlos Lima')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Caiu de Crítico para Alto.')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Novos controles aplicados.')).toBeInTheDocument();

    expect(within(rows[2]!).getByText('Ana Souza')).toBeInTheDocument();
    expect(
      within(rows[2]!).getByText(
        'Primeira avaliação registrada — sem avaliação anterior para comparar.',
      ),
    ).toBeInTheDocument();
  });

  it('still lists a reassessment that lands on the same level — deliberately not treated as noise', async () => {
    const unchanged = assessmentFixture({
      id: 'a2',
      previousAssessmentId: 'a1',
      residualLevel: 'LOW',
      levelChange: {
        previousInherentLevel: 'MEDIUM',
        previousResidualLevel: 'LOW',
        direction: 'UNCHANGED',
      },
    });
    listAssessmentsMock.mockResolvedValueOnce({
      data: [unchanged],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });

    render(<AssessmentHistory riskId="risk-1" />);

    expect(await screen.findByText('Permaneceu em Baixo.')).toBeInTheDocument();
  });

  it('shows an explicit empty state when no assessment has been recorded yet', async () => {
    listAssessmentsMock.mockResolvedValueOnce({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
    });

    render(<AssessmentHistory riskId="risk-1" />);

    expect(await screen.findByText('Nenhuma avaliação registrada ainda.')).toBeInTheDocument();
  });

  it('loads the next page on demand rather than truncating a long history', async () => {
    listAssessmentsMock.mockResolvedValueOnce({
      data: [assessmentFixture({ id: 'a1' })],
      meta: { page: 1, pageSize: 20, total: 2, totalPages: 2 },
    });
    render(<AssessmentHistory riskId="risk-1" />);
    await screen.findByRole('table');

    listAssessmentsMock.mockResolvedValueOnce({
      data: [assessmentFixture({ id: 'a2' })],
      meta: { page: 2, pageSize: 20, total: 2, totalPages: 2 },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Carregar mais' }));

    await waitFor(() => expect(listAssessmentsMock).toHaveBeenCalledTimes(2));
    expect(listAssessmentsMock).toHaveBeenLastCalledWith('risk-1', 2, 20);
    await waitFor(() =>
      expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(3),
    );
  });

  it('re-fetches from page 1 when refreshToken changes', async () => {
    listAssessmentsMock.mockResolvedValue({
      data: [assessmentFixture({ id: 'a1' })],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
    const { rerender } = render(<AssessmentHistory riskId="risk-1" refreshToken={0} />);
    await screen.findByRole('table');
    expect(listAssessmentsMock).toHaveBeenCalledTimes(1);

    rerender(<AssessmentHistory riskId="risk-1" refreshToken={1} />);
    await waitFor(() => expect(listAssessmentsMock).toHaveBeenCalledTimes(2));
    expect(listAssessmentsMock).toHaveBeenLastCalledWith('risk-1', 1, 20);
  });
});
