import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { risks } from '@/lib/messages/risks';

import { RiskAssessmentSection } from './risk-assessment-section';

import type { RiskAssessment, RiskDetail, RiskMethodologyVersion } from '../types';

const { getActiveMethodologyMock, listAssessmentsMock, updateRiskMock } = vi.hoisted(() => ({
  getActiveMethodologyMock: vi.fn(),
  listAssessmentsMock: vi.fn(),
  updateRiskMock: vi.fn(),
}));

vi.mock('../api', () => ({
  risksApi: {
    getActiveMethodology: getActiveMethodologyMock,
    listAssessments: listAssessmentsMock,
    updateRisk: updateRiskMock,
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
    { value: 2, label: 'Grave' },
  ],
  matrix: [
    { probability: 1, impact: 1, score: 1, level: 'LOW' },
    { probability: 1, impact: 2, score: 2, level: 'LOW' },
    { probability: 2, impact: 1, score: 2, level: 'LOW' },
    { probability: 2, impact: 2, score: 4, level: 'HIGH' },
  ],
  levelBands: [
    { level: 'LOW', minScore: 1, maxScore: 3 },
    { level: 'MEDIUM', minScore: 4, maxScore: 6 },
    { level: 'HIGH', minScore: 7, maxScore: 8 },
    { level: 'CRITICAL', minScore: 9, maxScore: 16 },
  ],
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  isActive: true,
  createdBy: { id: 'user-1', fullName: 'Ana Souza' },
};

const assessment: RiskAssessment = {
  id: 'assessment-1',
  assessedBy: { id: 'user-1', fullName: 'Ana Souza' },
  assessedOn: '2026-02-01',
  methodologyVersion: { id: 'methodology-v1', versionNumber: 1 },
  inherentProbability: 2,
  inherentImpact: 2,
  inherentScore: 16,
  inherentLevel: 'CRITICAL',
  residualProbability: 1,
  residualImpact: 1,
  residualScore: 1,
  residualLevel: 'LOW',
  controlsConsidered: [],
  rationale: 'Controles compensatórios reduzem substancialmente a exposição.',
  previousAssessmentId: null,
  levelChange: { previousInherentLevel: null, previousResidualLevel: null, direction: null },
};

const baseRisk: RiskDetail = {
  id: 'risk-1',
  code: 'RSK-2026-0001',
  title: 'Falha no fornecedor crítico',
  descriptionExcerpt: 'Descrição.',
  description: 'Descrição.',
  status: 'IDENTIFIED',
  type: null,
  origin: null,
  orgUnit: { id: 'org-1', code: 'ROOT', name: 'Vértice GRC' },
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

const baseProps = {
  etag: '"1"',
  canAssess: true,
  onAssessed: vi.fn(),
  onReviewSaved: vi.fn(),
  assessmentHistoryRefreshToken: 0,
  onViewCausesConsequences: vi.fn(),
};

describe('RiskAssessmentSection', () => {
  beforeEach(() => {
    getActiveMethodologyMock.mockReset();
    getActiveMethodologyMock.mockResolvedValue(methodology);
    listAssessmentsMock.mockReset();
    listAssessmentsMock.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    });
    updateRiskMock.mockReset();
  });

  it('shows the honest not-yet-assessed state, never a fabricated level (SC-013)', () => {
    render(<RiskAssessmentSection risk={baseRisk} {...baseProps} />);
    expect(screen.getByText('Este risco ainda não foi avaliado')).toBeInTheDocument();
    expect(screen.queryByText(/Baixo|Médio|Alto|Crítico/)).not.toBeInTheDocument();
  });

  it('presents inherent and residual as clearly distinct values, each naming its own basis (ADR-006)', async () => {
    render(
      <RiskAssessmentSection
        risk={{ ...baseRisk, currentAssessment: assessment }}
        {...baseProps}
      />,
    );

    expect(screen.getByText('16')).toBeInTheDocument();
    expect(screen.getByText('Inerente: Crítico')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Residual: Baixo')).toBeInTheDocument();

    expect(screen.getByText('Avaliado por Ana Souza')).toBeInTheDocument();
    expect(
      screen.getByText('Controles compensatórios reduzem substancialmente a exposição.'),
    ).toBeInTheDocument();

    await screen.findByRole('table');
  });

  it('labels each assessment field for assistive tech, sourced from the message catalog (never inlined)', () => {
    render(
      <RiskAssessmentSection
        risk={{ ...baseRisk, currentAssessment: assessment }}
        {...baseProps}
      />,
    );

    expect(screen.getByText(risks.assessment.section.assessedOnFieldLabel)).toHaveClass('sr-only');
    expect(screen.getByText(risks.assessment.section.assessedByFieldLabel)).toHaveClass('sr-only');
    expect(screen.getByText(risks.assessment.section.methodologyFieldLabel)).toHaveClass('sr-only');
  });

  it('never re-fetches the assessment itself — only the methodology, for the in-context matrix', () => {
    render(
      <RiskAssessmentSection
        risk={{ ...baseRisk, currentAssessment: assessment }}
        {...baseProps}
      />,
    );
    expect(getActiveMethodologyMock).toHaveBeenCalledTimes(1);
  });

  it('shows an explicit loading state for the matrix while the methodology request is in flight — never silence', async () => {
    let resolveMethodology!: (value: RiskMethodologyVersion) => void;
    getActiveMethodologyMock.mockReset();
    getActiveMethodologyMock.mockReturnValue(
      new Promise<RiskMethodologyVersion>((resolve) => {
        resolveMethodology = resolve;
      }),
    );

    render(
      <RiskAssessmentSection
        risk={{ ...baseRisk, currentAssessment: assessment }}
        {...baseProps}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent(risks.assessment.section.matrixLoading);

    resolveMethodology(methodology);
    await screen.findByRole('table');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('degrades gracefully when the methodology fails to load, without losing the assessment’s own scores', async () => {
    getActiveMethodologyMock.mockReset();
    getActiveMethodologyMock.mockRejectedValueOnce(new Error('network error'));

    render(
      <RiskAssessmentSection
        risk={{ ...baseRisk, currentAssessment: assessment }}
        {...baseProps}
      />,
    );

    expect(screen.getByText('Inerente: Crítico')).toBeInTheDocument();
    expect(
      await screen.findByText(
        'Não foi possível carregar a matriz de risco para exibir a avaliação em contexto.',
      ),
    ).toBeInTheDocument();
  });

  it('shows a Causas/Consequências summary (first items + count) and jumps to the full section on request', () => {
    const onViewCausesConsequences = vi.fn();
    render(
      <RiskAssessmentSection
        risk={{
          ...baseRisk,
          currentAssessment: assessment,
          causes: [
            { id: 'c1', description: 'Fornecedor único', sortOrder: 0 },
            { id: 'c2', description: 'Falta de contrato', sortOrder: 1 },
            { id: 'c3', description: 'Terceira causa', sortOrder: 2 },
          ],
          consequences: [],
        }}
        {...baseProps}
        onViewCausesConsequences={onViewCausesConsequences}
      />,
    );

    expect(screen.getByText('Fornecedor único')).toBeInTheDocument();
    expect(screen.getByText('Falta de contrato')).toBeInTheDocument();
    expect(screen.queryByText('Terceira causa')).not.toBeInTheDocument();
    expect(screen.getByText('+ 1 outra')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma registrada.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ver Causas e Consequências completas' }));
    expect(onViewCausesConsequences).toHaveBeenCalledTimes(1);
  });

  it('keeps "Registrar nova avaliação"/"Alterar próxima revisão" behind an action, revealing each form only on request', () => {
    render(
      <RiskAssessmentSection
        risk={{ ...baseRisk, currentAssessment: assessment }}
        {...baseProps}
      />,
    );

    expect(screen.queryByText('Nova avaliação')).not.toBeInTheDocument();
    expect(screen.queryByText('Próxima revisão')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: risks.assessment.actions.recordNew }));
    expect(screen.getByText('Nova avaliação')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: risks.assessment.actions.changeNextReview }),
    );
    expect(screen.getByText('Próxima revisão')).toBeInTheDocument();
  });

  it('does not offer "Registrar nova avaliação" without risk:assess — RBAC by omission, never disabling (FR-030)', () => {
    render(
      <RiskAssessmentSection
        risk={{ ...baseRisk, currentAssessment: assessment }}
        {...baseProps}
        canAssess={false}
      />,
    );
    expect(
      screen.queryByRole('button', { name: risks.assessment.actions.recordNew }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: risks.assessment.actions.changeNextReview }),
    ).toBeInTheDocument();
  });

  it('collapses "Alterar próxima revisão" back to its trigger once the save succeeds', async () => {
    updateRiskMock.mockResolvedValueOnce({
      risk: { ...baseRisk, currentAssessment: assessment, nextReviewOn: '2026-06-01' },
      etag: '"2"',
    });
    const onReviewSaved = vi.fn();

    render(
      <RiskAssessmentSection
        risk={{ ...baseRisk, currentAssessment: assessment }}
        {...baseProps}
        onReviewSaved={onReviewSaved}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: risks.assessment.actions.changeNextReview }),
    );
    fireEvent.change(screen.getByLabelText('Nova data de próxima revisão'), {
      target: { value: '2026-06-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(onReviewSaved).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Próxima revisão')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: risks.assessment.actions.changeNextReview }),
    ).toBeInTheDocument();
  });
});
