import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RiskCard } from './risk-card';

import type { RiskSummary } from '../types';

const baseRisk: RiskSummary = {
  id: 'risk-1',
  code: 'RSK-2026-0001',
  title: 'Falha no fornecedor crítico',
  descriptionExcerpt: 'Descrição resumida do risco para pré-visualização.',
  status: 'DRAFT',
  orgUnit: { id: 'org-1', code: 'ROOT', name: 'PharosGRC' },
  owner: { id: 'user-1', fullName: 'Ana Souza' },
  inherentLevel: 'CRITICAL',
  residualLevel: 'LOW',
  nextReviewOn: '2026-01-10',
  overdueReview: false,
  overdueTreatment: false,
  pendingApproval: false,
  version: 1,
  updatedAt: '2026-09-04T12:00:00.000Z',
};

describe('RiskCard', () => {
  it('renders the last update as a calendar date, never "Invalid Date"', () => {
    render(<RiskCard risk={baseRisk} riskLevelBasis="RESIDUAL" />);

    expect(screen.getByText('Atualizado em 04/09/2026')).toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument();
  });

  it('renders the code as a link to the full record', () => {
    render(<RiskCard risk={baseRisk} riskLevelBasis="RESIDUAL" />);

    const link = screen.getByRole('link', { name: 'RSK-2026-0001' });
    expect(link).toHaveAttribute('href', '/risks/risk-1');
  });

  it('renders the title as a link to the same full record, with the "Abrir o risco" accessible name', () => {
    render(<RiskCard risk={baseRisk} riskLevelBasis="RESIDUAL" />);

    const link = screen.getByRole('link', {
      name: 'Abrir o risco RSK-2026-0001: Falha no fornecedor crítico',
    });
    expect(link).toHaveAttribute('href', '/risks/risk-1');
  });

  it('renders "no assessment" text, never a fabricated level, when the relevant level is absent', () => {
    const { residualLevel: _residualLevel, inherentLevel: _inherentLevel, ...rest } = baseRisk;
    const unassessed: RiskSummary = rest;
    render(<RiskCard risk={unassessed} riskLevelBasis="RESIDUAL" />);

    expect(screen.getByText('Sem avaliação')).toBeInTheDocument();
    expect(screen.queryByText(/Residual:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Inerente:/)).not.toBeInTheDocument();
  });

  it('labels the level badge with the active riskLevelBasis (residual vs inherent)', () => {
    const { rerender } = render(<RiskCard risk={baseRisk} riskLevelBasis="RESIDUAL" />);
    expect(screen.getByText('Residual: Baixo')).toBeInTheDocument();
    expect(screen.queryByText(/Inerente:/)).not.toBeInTheDocument();

    rerender(<RiskCard risk={baseRisk} riskLevelBasis="INHERENT" />);
    expect(screen.getByText('Inerente: Crítico')).toBeInTheDocument();
    expect(screen.queryByText(/Residual:/)).not.toBeInTheDocument();
  });

  it('renders "Não definido" for a null category', () => {
    render(<RiskCard risk={baseRisk} riskLevelBasis="RESIDUAL" />);

    expect(screen.getByText('Não definido')).toBeInTheDocument();
  });
});
