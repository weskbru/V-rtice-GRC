import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ComplianceSummaryCard } from './compliance-summary-card';

import type { ComplianceSummary } from '../types';

/**
 * Component-mount evidence for `ComplianceSummaryCard` (US3, FR-020).
 * `../api` is mocked at the network boundary.
 */
const { getFrameworkVersionComplianceSummaryMock } = vi.hoisted(() => ({
  getFrameworkVersionComplianceSummaryMock: vi.fn(),
}));

vi.mock('../api', () => ({
  complianceApi: {
    getFrameworkVersionComplianceSummary: getFrameworkVersionComplianceSummaryMock,
  },
}));

function summaryFixture(overrides: Partial<ComplianceSummary>): ComplianceSummary {
  return {
    frameworkVersion: { id: 'version-1', label: '2022', status: 'DRAFT' },
    totalRequirements: 10,
    applicableRequirementCount: 9,
    counts: { notApplicable: 1, notMet: 2, notProven: 3, partiallyMet: 1, compliant: 3 },
    compliancePercentage: 33.33,
    computedAt: '2026-02-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('ComplianceSummaryCard', () => {
  beforeEach(() => {
    getFrameworkVersionComplianceSummaryMock.mockReset();
  });

  it('shows "nothing to measure yet" — never 0% — when the version has zero requirements', async () => {
    getFrameworkVersionComplianceSummaryMock.mockResolvedValue(
      summaryFixture({
        totalRequirements: 0,
        applicableRequirementCount: 0,
        counts: { notApplicable: 0, notMet: 0, notProven: 0, partiallyMet: 0, compliant: 0 },
        compliancePercentage: null,
      }),
    );

    render(<ComplianceSummaryCard frameworkId="fmk-1" versionId="version-1" />);

    expect(
      await screen.findByText('Esta versão ainda não tem nenhum requisito — não há o que medir.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('renders the calculated percentage and per-state counts', async () => {
    getFrameworkVersionComplianceSummaryMock.mockResolvedValue(summaryFixture({}));

    render(<ComplianceSummaryCard frameworkId="fmk-1" versionId="version-1" />);

    expect(await screen.findByText('33%')).toBeInTheDocument();
    expect(screen.getByText('Total de cláusulas: 10')).toBeInTheDocument();
    expect(screen.getByText(/Não atendido: 2/)).toBeInTheDocument();
    expect(screen.getByText(/Não comprovado: 3/)).toBeInTheDocument();
    expect(screen.getByText(/Conforme: 3/)).toBeInTheDocument();
  });

  it('shows "—" (never 0% or 100%) when there are requirements but none is applicable', async () => {
    getFrameworkVersionComplianceSummaryMock.mockResolvedValue(
      summaryFixture({
        totalRequirements: 2,
        applicableRequirementCount: 0,
        counts: { notApplicable: 2, notMet: 0, notProven: 0, partiallyMet: 0, compliant: 0 },
        compliancePercentage: null,
      }),
    );

    render(<ComplianceSummaryCard frameworkId="fmk-1" versionId="version-1" />);

    expect(await screen.findByText('—')).toBeInTheDocument();
    expect(screen.getByText('Sem cláusula aplicável para medir')).toBeInTheDocument();
  });

  it('calls onLoaded with the fetched summary', async () => {
    const summary = summaryFixture({});
    getFrameworkVersionComplianceSummaryMock.mockResolvedValue(summary);
    const onLoaded = vi.fn();

    render(<ComplianceSummaryCard frameworkId="fmk-1" versionId="version-1" onLoaded={onLoaded} />);

    await screen.findByText('33%');
    expect(onLoaded).toHaveBeenCalledWith(summary);
  });
});
