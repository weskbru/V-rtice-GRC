import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RiskSummaryRow } from './risk-summary-row';

import type { RiskDetail } from '../../types';

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

describe('RiskSummaryRow', () => {
  it('shows "Não avaliado" honestly for both levels when the risk has never been assessed (SC-013)', () => {
    render(<RiskSummaryRow risk={baseRisk} />);
    expect(screen.getAllByText('Não avaliado')).toHaveLength(2);
  });

  it('shows the real inherent/residual level once assessed', () => {
    render(<RiskSummaryRow risk={{ ...baseRisk, inherentLevel: 'HIGH', residualLevel: 'LOW' }} />);
    expect(screen.getByText('Alto')).toBeInTheDocument();
    expect(screen.getByText('Baixo')).toBeInTheDocument();
  });

  it('shows "Não definido" for treatment when there is no current decision, and "Não possui" for action plans', () => {
    render(<RiskSummaryRow risk={baseRisk} />);
    expect(screen.getByText('Não definido')).toBeInTheDocument();
    expect(screen.getByText('Não possui')).toBeInTheDocument();
  });

  it('shows the current treatment strategy and "Prazo vencido" when the deadline has passed', () => {
    const risk: RiskDetail = {
      ...baseRisk,
      currentTreatment: {
        id: 'td-1',
        strategy: 'MITIGATE',
        description: 'Mitigar',
        deadline: '2025-01-01',
        decidedBy: { id: 'user-1', fullName: 'Ana Souza' },
        decidedAt: '2025-01-01T00:00:00.000Z',
        supersededAt: null,
        deadlineOverdue: true,
      },
    };
    render(<RiskSummaryRow risk={risk} />);
    expect(screen.getByText('Mitigar')).toBeInTheDocument();
    expect(screen.getByText('Prazo vencido')).toBeInTheDocument();
  });

  it('shows the real action plan total and its open/overdue breakdown', () => {
    const risk: RiskDetail = {
      ...baseRisk,
      treatmentActionSummary: { total: 5, open: 3, overdue: 2 },
    };
    render(<RiskSummaryRow risk={risk} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3 abertos · 2 em atraso')).toBeInTheDocument();
  });

  it('preserves the treatment deadline and scheduled review date without deriving new values', () => {
    render(
      <RiskSummaryRow
        risk={{
          ...baseRisk,
          nextReviewOn: '2026-12-20',
          currentTreatment: {
            id: 'td-2',
            strategy: 'ACCEPT',
            description: 'Aceitar',
            deadline: '2026-11-10',
            decidedBy: { id: 'user-1', fullName: 'Ana Souza' },
            decidedAt: '2026-01-01T00:00:00.000Z',
            supersededAt: null,
            deadlineOverdue: false,
          },
        }}
      />,
    );
    expect(screen.getByText('10/11/2026')).toBeInTheDocument();
    expect(screen.getByText('20/12/2026')).toBeInTheDocument();
    expect(screen.getByText('Próxima revisão')).toBeInTheDocument();
  });

  it('shows "Não agendada" when there is no next review, and marks an overdue one honestly', () => {
    render(<RiskSummaryRow risk={baseRisk} />);
    expect(screen.getByText('Não agendada')).toBeInTheDocument();

    const overdue: RiskDetail = { ...baseRisk, nextReviewOn: '2025-01-01', overdueReview: true };
    render(<RiskSummaryRow risk={overdue} />);
    expect(screen.getByText('Em atraso')).toBeInTheDocument();
  });

  it('groups all five facts under the three presentation headings', () => {
    render(<RiskSummaryRow risk={baseRisk} />);
    for (const name of ['Exposição ao risco', 'Resposta', 'Governança']) {
      expect(screen.getByRole('heading', { name, level: 2 })).toBeInTheDocument();
    }
    for (const label of [
      'Nível inerente',
      'Nível residual',
      'Tratamento',
      'Planos de ação',
      'Revisão',
      'Antes dos controles',
      'Após os controles',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getAllByText('—')).toHaveLength(2);
    expect(screen.getByText('Não definido')).toBeInTheDocument();
    expect(screen.getByText('Não agendada')).toBeInTheDocument();
  });
});
