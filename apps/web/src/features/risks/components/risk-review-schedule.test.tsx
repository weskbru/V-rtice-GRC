import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-client';

import { RiskReviewSchedule } from './risk-review-schedule';

import type { RiskDetail } from '../types';

/**
 * Component-mount evidence for T132 (`RiskReviewSchedule`, FR-070). `../api`
 * is mocked at the network boundary.
 */

const { updateRiskMock } = vi.hoisted(() => ({ updateRiskMock: vi.fn() }));

vi.mock('../api', () => ({
  risksApi: { updateRisk: updateRiskMock },
}));

const baseRisk: RiskDetail = {
  id: 'risk-1',
  code: 'RSK-2026-0001',
  title: 'Falha no fornecedor crítico',
  descriptionExcerpt: 'Descrição.',
  description: 'Descrição.',
  status: 'IDENTIFIED',
  type: null,
  origin: null,
  orgUnit: { id: 'org-1', code: 'ROOT', name: 'PharosGRC' },
  owner: { id: 'user-1', fullName: 'Ana Souza' },
  overdueReview: false,
  overdueTreatment: false,
  pendingApproval: false,
  version: 1,
  updatedAt: '2026-01-01T00:00:00.000Z',
  causes: [],
  consequences: [],
  currentAssessment: null,
  currentTreatment: null,
  controls: [],
  processes: [],
  assets: [],
  treatmentActionSummary: { total: 0, open: 0, overdue: 0 },
  identifiedOn: '2026-01-01',
  archivedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('RiskReviewSchedule', () => {
  beforeEach(() => {
    updateRiskMock.mockReset();
  });

  it('shows "not set" when there is no next review date yet', () => {
    render(<RiskReviewSchedule risk={baseRisk} etag='"1"' onSaved={vi.fn()} />);
    expect(screen.getByText(/Data agendada: Não definida/)).toBeInTheDocument();
  });

  it('formats a date-only next review date as the same calendar day regardless of local timezone (the off-by-one bug this project already fixed once)', () => {
    // `new Date('2026-01-02')` parses as UTC midnight; in any timezone
    // behind UTC, formatting it with `toLocaleDateString()` renders
    // 01/01/2026 instead of 02/01/2026. This component must go through
    // `formatDateOnly` (`../date.ts`), never `new Date(...).toLocaleDateString()`.
    render(
      <RiskReviewSchedule
        risk={{ ...baseRisk, nextReviewOn: '2026-01-02' }}
        etag='"1"'
        onSaved={vi.fn()}
      />,
    );
    expect(screen.getByText(/Data agendada: 02\/01\/2026/)).toBeInTheDocument();
  });

  it('shows the overdue indicator only when the server reports overdueReview — never recomputed locally', () => {
    const { rerender } = render(
      <RiskReviewSchedule
        risk={{ ...baseRisk, nextReviewOn: '2026-01-02', overdueReview: false }}
        etag='"1"'
        onSaved={vi.fn()}
      />,
    );
    expect(screen.queryByText('Revisão vencida')).not.toBeInTheDocument();

    rerender(
      <RiskReviewSchedule
        risk={{ ...baseRisk, nextReviewOn: '2026-01-02', overdueReview: true }}
        etag='"1"'
        onSaved={vi.fn()}
      />,
    );
    expect(screen.getByText('Revisão vencida')).toBeInTheDocument();
  });

  it('saves a new next review date and hands the caller the fresh risk/etag', async () => {
    const updatedRisk: RiskDetail = { ...baseRisk, nextReviewOn: '2026-06-01', version: 2 };
    updateRiskMock.mockResolvedValueOnce({ risk: updatedRisk, etag: '"2"' });
    const onSaved = vi.fn();

    render(<RiskReviewSchedule risk={baseRisk} etag='"1"' onSaved={onSaved} />);

    fireEvent.change(screen.getByLabelText('Nova data de próxima revisão'), {
      target: { value: '2026-06-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(updateRiskMock).toHaveBeenCalledWith('risk-1', { nextReviewOn: '2026-06-01' }, '"1"'),
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ risk: updatedRisk, etag: '"2"' }));
  });

  it('surfaces a 409 as a conflict message rather than silently discarding the edit', async () => {
    updateRiskMock.mockRejectedValueOnce(new ApiError({ title: 'Conflito', status: 409 }));

    render(<RiskReviewSchedule risk={baseRisk} etag='"1"' onSaved={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Nova data de próxima revisão'), {
      target: { value: '2026-06-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(
      await screen.findByText(
        'Este risco foi alterado por outra pessoa. Recarregue a página para ver a versão atual antes de salvar.',
      ),
    ).toBeInTheDocument();
  });
});
