import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-client';

import { AssessmentForm } from './assessment-form';

import type { RiskMethodologyVersion } from '../types';

const { getActiveMethodologyMock, createAssessmentMock } = vi.hoisted(() => ({
  getActiveMethodologyMock: vi.fn(),
  createAssessmentMock: vi.fn(),
}));

vi.mock('../api', () => ({
  risksApi: {
    getActiveMethodology: getActiveMethodologyMock,
    createAssessment: createAssessmentMock,
  },
}));

const methodology: RiskMethodologyVersion = {
  id: 'methodology-v1',
  methodologyName: 'Padrão',
  versionNumber: 1,
  probabilityScale: [
    { value: 1, label: 'Baixa' },
    { value: 2, label: 'Alta' },
  ],
  impactScale: [
    { value: 1, label: 'Baixo' },
    { value: 2, label: 'Moderado' },
    { value: 3, label: 'Grave' },
  ],
  matrix: [
    { probability: 1, impact: 1, score: 1, level: 'LOW' },
    { probability: 1, impact: 2, score: 2, level: 'LOW' },
    { probability: 1, impact: 3, score: 3, level: 'MEDIUM' },
    { probability: 2, impact: 1, score: 2, level: 'LOW' },
    { probability: 2, impact: 2, score: 4, level: 'MEDIUM' },
    { probability: 2, impact: 3, score: 6, level: 'HIGH' },
  ],
  levelBands: [
    { level: 'LOW', minScore: 1, maxScore: 2 },
    { level: 'MEDIUM', minScore: 3, maxScore: 4 },
    { level: 'HIGH', minScore: 5, maxScore: 9 },
    { level: 'CRITICAL', minScore: 10, maxScore: 99 },
  ],
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  isActive: true,
  createdBy: { id: 'user-1', fullName: 'Ana Souza' },
};

async function selectCell(basisButtonName: string, cellAccessibleName: string): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: basisButtonName }));
  const table = await screen.findByRole('table');
  fireEvent.click(within(table).getByRole('button', { name: cellAccessibleName }));
}

describe('AssessmentForm', () => {
  beforeEach(() => {
    getActiveMethodologyMock.mockReset();
    createAssessmentMock.mockReset();
    getActiveMethodologyMock.mockResolvedValue(methodology);
  });

  it('builds its matrix from the active methodology’s own scales, never a hardcoded 5×5 (FR-061)', async () => {
    render(<AssessmentForm riskId="risk-1" etag='"3"' onAssessed={vi.fn()} />);

    const table = await screen.findByRole('table');
    for (const impact of methodology.impactScale) {
      expect(within(table).getByRole('columnheader', { name: impact.label })).toBeInTheDocument();
    }
    for (const probability of methodology.probabilityScale) {
      expect(within(table).getByRole('rowheader', { name: probability.label })).toBeInTheDocument();
    }
    expect(within(table).queryByRole('columnheader', { name: 'Crítico' })).not.toBeInTheDocument();
  });

  it('never submits a derived score/level field — only factor values, rationale and the pinned methodology version', async () => {
    createAssessmentMock.mockResolvedValueOnce({
      assessment: { id: 'assessment-1' },
      etag: '"4"',
    });
    const onAssessed = vi.fn();

    render(<AssessmentForm riskId="risk-1" etag='"3"' onAssessed={onAssessed} />);
    await screen.findByRole('table');

    await selectCell(
      'Risco inerente',
      'Probabilidade Baixa, Impacto Baixo: pontuação 1, nível Baixo',
    );
    await selectCell(
      'Risco residual',
      'Probabilidade Alta, Impacto Grave: pontuação 6, nível Alto',
    );

    fireEvent.change(screen.getByLabelText('Justificativa'), {
      target: { value: 'Controles reduziram a exposição residual.' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Registrar avaliação' }));

    await waitFor(() => expect(createAssessmentMock).toHaveBeenCalledTimes(1));
    const [, submittedBody] = createAssessmentMock.mock.calls[0] as [
      string,
      Record<string, unknown>,
      string,
    ];

    expect(submittedBody).toEqual({
      inherentProbability: 1,
      inherentImpact: 1,
      residualProbability: 2,
      residualImpact: 3,
      rationale: 'Controles reduziram a exposição residual.',
      methodologyVersionId: 'methodology-v1',
    });
    expect(submittedBody).not.toHaveProperty('inherentScore');
    expect(submittedBody).not.toHaveProperty('inherentLevel');
    expect(submittedBody).not.toHaveProperty('residualScore');
    expect(submittedBody).not.toHaveProperty('residualLevel');

    await waitFor(() => expect(onAssessed).toHaveBeenCalledTimes(1));
  });

  it('requires both an inherent and a residual selection before it may be submitted', async () => {
    render(<AssessmentForm riskId="risk-1" etag='"3"' onAssessed={vi.fn()} />);
    await screen.findByRole('table');

    fireEvent.click(screen.getByRole('button', { name: 'Registrar avaliação' }));

    expect(
      await screen.findByText('Selecione a probabilidade e o impacto do risco inerente.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Selecione a probabilidade e o impacto do risco residual.'),
    ).toBeInTheDocument();
    expect(createAssessmentMock).not.toHaveBeenCalled();
  });

  it('renders the methodology-changed 422 as an explicit, actionable state (US4 AS5, FR-068), not a generic error', async () => {
    createAssessmentMock.mockRejectedValueOnce(
      new ApiError({
        title: 'Não processável',
        status: 422,
        errors: [
          { field: 'methodologyVersionId', message: 'A metodologia informada não é a vigente.' },
        ],
      }),
    );

    render(<AssessmentForm riskId="risk-1" etag='"3"' onAssessed={vi.fn()} />);
    await screen.findByRole('table');

    await selectCell(
      'Risco inerente',
      'Probabilidade Baixa, Impacto Baixo: pontuação 1, nível Baixo',
    );
    await selectCell(
      'Risco residual',
      'Probabilidade Alta, Impacto Baixo: pontuação 2, nível Baixo',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Registrar avaliação' }));

    expect(
      await screen.findByText('A metodologia de avaliação foi atualizada'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Não foi possível registrar a avaliação. Tente novamente.'),
    ).not.toBeInTheDocument();

    getActiveMethodologyMock.mockResolvedValueOnce(methodology);
    fireEvent.click(screen.getByRole('button', { name: 'Recarregar metodologia vigente' }));

    await waitFor(() => expect(getActiveMethodologyMock).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('A metodologia de avaliação foi atualizada')).not.toBeInTheDocument();
  });
});
