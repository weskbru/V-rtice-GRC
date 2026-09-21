import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RiskCard } from './risk-card';

import type { RiskSummary } from '../types';

/**
 * Component-mount evidence for the register's card view (CLAUDE.md §18,
 * SC-013) — mirrors `risk-register-columns.test.tsx`'s fixture shape so the
 * two views are exercised against comparable data.
 */
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
  /**
   * Midday UTC on purpose, not midnight. `updatedAt` is a `date-time`, and
   * rendering an instant in the reader's local zone is correct — but
   * `T00:00:00.000Z` lands on the PREVIOUS local day anywhere behind UTC
   * (this repo's own machines run at UTC-3), which would make any assertion
   * on the formatted text pass or fail depending on where the suite runs.
   * Midday keeps the local calendar date stable from UTC-11 to UTC+11.
   */
  updatedAt: '2026-09-04T12:00:00.000Z',
};

describe('RiskCard', () => {
  /**
   * Regression guard, added after a rendered-screen capture caught every
   * card in the register reading "Atualizado em Invalid Date" with this
   * whole suite green.
   *
   * The fixture above was never the problem — it already carried a realistic
   * `date-time`. The problem was that no test asserted the rendered date at
   * all, so a field visible on every single card had zero coverage and a
   * wrong formatter (`formatDateOnly`, which is for `date` fields and
   * produces `NaN` from an ISO timestamp) shipped straight past the suite.
   *
   * Asserting the formatted text — not merely that the label is present —
   * is what makes this fail if the formatter is swapped back.
   */
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
    // F-18: the contract OMITS these fields when not yet assessed, never
    // sends `null` — `residualLevel`/`inherentLevel` are optional now, so
    // "unassessed" is modelled by destructuring them away, not by setting
    // them to a value `exactOptionalPropertyTypes` no longer accepts here.
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
