import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RiskCardGrid } from './risk-card-grid';

import type { RiskSummary } from '../types';

function buildRisk(overrides: Partial<RiskSummary> = {}): RiskSummary {
  return {
    id: 'risk-1',
    code: 'RSK-2026-0001',
    title: 'Falha no fornecedor crítico',
    descriptionExcerpt: null,
    status: 'DRAFT',
    orgUnit: { id: 'org-1', code: 'ROOT', name: 'Vértice GRC' },
    owner: { id: 'user-1', fullName: 'Ana Souza' },
    overdueReview: false,
    overdueTreatment: false,
    pendingApproval: false,
    version: 1,
    updatedAt: '2026-09-04T00:00:00.000Z',
    ...overrides,
  };
}

describe('RiskCardGrid', () => {
  it('renders one list item per risk', () => {
    const list = [
      buildRisk({ id: 'risk-1', code: 'RSK-2026-0001' }),
      buildRisk({ id: 'risk-2', code: 'RSK-2026-0002', title: 'Outro risco' }),
      buildRisk({ id: 'risk-3', code: 'RSK-2026-0003', title: 'Terceiro risco' }),
    ];

    render(
      <RiskCardGrid
        risks={list}
        riskLevelBasis="RESIDUAL"
        isLoading={false}
        emptyContent={<p>vazio</p>}
      />,
    );

    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByRole('link', { name: 'RSK-2026-0001' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'RSK-2026-0002' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'RSK-2026-0003' })).toBeInTheDocument();
  });

  it('renders emptyContent instead of the grid when the list is empty', () => {
    render(
      <RiskCardGrid
        risks={[]}
        riskLevelBasis="RESIDUAL"
        isLoading={false}
        emptyContent={<p>Nenhum risco cadastrado ainda</p>}
      />,
    );

    expect(screen.getByText('Nenhum risco cadastrado ainda')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('renders the error state instead of the grid when error is set, even if risks are present', () => {
    render(
      <RiskCardGrid
        risks={[buildRisk()]}
        riskLevelBasis="RESIDUAL"
        isLoading={false}
        emptyContent={<p>vazio</p>}
        error={{ title: 'Falha ao carregar', detail: 'Tente novamente.' }}
        errorAction={<button type="button">Tentar novamente</button>}
      />,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Falha ao carregar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'RSK-2026-0001' })).not.toBeInTheDocument();
  });

  it('renders a loading placeholder without the real list when isLoading is true', () => {
    render(
      <RiskCardGrid
        risks={[buildRisk()]}
        riskLevelBasis="RESIDUAL"
        isLoading
        emptyContent={<p>vazio</p>}
      />,
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'RSK-2026-0001' })).not.toBeInTheDocument();
  });
});
