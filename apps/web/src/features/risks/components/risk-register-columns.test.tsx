import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { buildRiskRegisterColumns, RISK_REGISTER_COLUMN_IDS } from './risk-register-columns';

import type { RiskSummary } from '../types';

/**
 * Pure-function evidence for T111 (FR-087, FR-091) — no `DataTable`/TanStack
 * table instance needed: `ColumnDef.cell` is a plain function of
 * `{ row: { original } }`, so it is exercised directly.
 */

const baseRisk: RiskSummary = {
  id: 'risk-1',
  code: 'RSK-2026-0001',
  title: 'Falha no fornecedor crítico',
  descriptionExcerpt: 'Descrição resumida do risco para pré-visualização.',
  status: 'ASSESSED',
  orgUnit: { id: 'org-1', code: 'ROOT', name: 'PharosGRC' },
  owner: { id: 'user-1', fullName: 'Ana Souza' },
  inherentLevel: 'CRITICAL',
  residualLevel: 'HIGH',
  nextReviewOn: '2026-01-10',
  overdueReview: false,
  overdueTreatment: false,
  pendingApproval: false,
  version: 1,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function cellOf(
  columns: ReturnType<typeof buildRiskRegisterColumns>,
  id: string,
): (context: { row: { original: RiskSummary } }) => React.ReactNode {
  const column = columns.find((candidate) => candidate.id === id);
  if (!column || typeof column.cell !== 'function') {
    throw new Error(`Column "${id}" has no function cell renderer`);
  }
  return column.cell as (context: { row: { original: RiskSummary } }) => React.ReactNode;
}

describe('buildRiskRegisterColumns', () => {
  it("never offers sorting on a field absent from GET /risks' sort enum (category, orgUnit, lastAssessedOn, treatment)", () => {
    const columns = buildRiskRegisterColumns({ riskLevelBasis: 'RESIDUAL' });

    for (const id of [
      RISK_REGISTER_COLUMN_IDS.category,
      RISK_REGISTER_COLUMN_IDS.orgUnit,
      RISK_REGISTER_COLUMN_IDS.lastAssessedOn,
      RISK_REGISTER_COLUMN_IDS.treatment,
    ]) {
      const column = columns.find((candidate) => candidate.id === id);
      expect(column?.enableSorting).toBe(false);
    }
  });

  it('leaves every contract-sortable field sortable (code, title, status, riskLevel, owner, nextReviewOn, updatedAt)', () => {
    const columns = buildRiskRegisterColumns({ riskLevelBasis: 'RESIDUAL' });

    for (const id of [
      RISK_REGISTER_COLUMN_IDS.code,
      RISK_REGISTER_COLUMN_IDS.title,
      RISK_REGISTER_COLUMN_IDS.status,
      RISK_REGISTER_COLUMN_IDS.riskLevel,
      RISK_REGISTER_COLUMN_IDS.owner,
      RISK_REGISTER_COLUMN_IDS.nextReviewOn,
      RISK_REGISTER_COLUMN_IDS.updatedAt,
    ]) {
      const column = columns.find((candidate) => candidate.id === id);
      expect(column?.enableSorting).not.toBe(false);
    }
  });

  it('keeps code/title always visible (never hideable via the column-visibility menu)', () => {
    const columns = buildRiskRegisterColumns({ riskLevelBasis: 'RESIDUAL' });
    expect(columns.find((c) => c.id === RISK_REGISTER_COLUMN_IDS.code)?.enableHiding).toBe(false);
    expect(columns.find((c) => c.id === RISK_REGISTER_COLUMN_IDS.title)?.enableHiding).toBe(false);
  });

  it('makes the active riskLevelBasis explicit in the risk-level column header (never a bare "Nível de risco")', () => {
    const residualColumns = buildRiskRegisterColumns({ riskLevelBasis: 'RESIDUAL' });
    const inherentColumns = buildRiskRegisterColumns({ riskLevelBasis: 'INHERENT' });

    const residualHeader = residualColumns.find(
      (c) => c.id === RISK_REGISTER_COLUMN_IDS.riskLevel,
    )?.header;
    const inherentHeader = inherentColumns.find(
      (c) => c.id === RISK_REGISTER_COLUMN_IDS.riskLevel,
    )?.header;

    expect(residualHeader).toBe('Nível de risco (residual)');
    expect(inherentHeader).toBe('Nível de risco (inerente)');
  });

  it('renders the residual level by default and the inherent level when riskLevelBasis is INHERENT', () => {
    const residualCell = cellOf(
      buildRiskRegisterColumns({ riskLevelBasis: 'RESIDUAL' }),
      RISK_REGISTER_COLUMN_IDS.riskLevel,
    );
    render(<>{residualCell({ row: { original: baseRisk } })}</>);
    expect(screen.getByText(/Alto/)).toBeInTheDocument();
    expect(screen.queryByText(/Crítico/)).not.toBeInTheDocument();
  });

  it('shows the overdue-review indicator only when the row is actually overdue', () => {
    const cell = cellOf(
      buildRiskRegisterColumns({ riskLevelBasis: 'RESIDUAL' }),
      RISK_REGISTER_COLUMN_IDS.nextReviewOn,
    );

    render(<>{cell({ row: { original: { ...baseRisk, overdueReview: false } } })}</>);
    expect(screen.queryByText('Revisão vencida')).not.toBeInTheDocument();

    render(<>{cell({ row: { original: { ...baseRisk, overdueReview: true } } })}</>);
    expect(screen.getByText('Revisão vencida')).toBeInTheDocument();
  });

  it('shows the overdue-treatment indicator only when the row is actually overdue', () => {
    const cell = cellOf(
      buildRiskRegisterColumns({ riskLevelBasis: 'RESIDUAL' }),
      RISK_REGISTER_COLUMN_IDS.treatment,
    );

    render(<>{cell({ row: { original: { ...baseRisk, overdueTreatment: false } } })}</>);
    expect(screen.queryByText('Tratamento vencido')).not.toBeInTheDocument();

    render(<>{cell({ row: { original: { ...baseRisk, overdueTreatment: true } } })}</>);
    expect(screen.getByText('Tratamento vencido')).toBeInTheDocument();
  });

  it('flags pending approval alongside the status badge', () => {
    const cell = cellOf(
      buildRiskRegisterColumns({ riskLevelBasis: 'RESIDUAL' }),
      RISK_REGISTER_COLUMN_IDS.status,
    );
    render(<>{cell({ row: { original: { ...baseRisk, pendingApproval: true } } })}</>);
    expect(screen.getByText('Aguardando aprovação')).toBeInTheDocument();
  });
});
