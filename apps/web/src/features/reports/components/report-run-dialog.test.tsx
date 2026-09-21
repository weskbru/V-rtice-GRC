import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Component-mount evidence for `ReportRunDialog` (009-indicators-reports, T061) — the FR-026/
 * SC-006 acceptance rule this task exists to verify in a rendered surface: an `available: false`
 * item renders through `MetricCard`'s distinct unavailable treatment, never a zero, and the rest
 * of the run still renders normally alongside it. Also covers the CSV export link building on
 * `reportsApi.buildRunCsvUrl` rather than a fetched blob (`ReportRunDialog`'s own header).
 */
const { runMock, buildRunCsvUrlMock } = vi.hoisted(() => ({
  runMock: vi.fn(),
  buildRunCsvUrlMock: vi.fn(() => '/api/v1/reports/report-1/run?format=csv'),
}));

vi.mock('../api', () => ({
  reportsApi: { run: runMock, buildRunCsvUrl: buildRunCsvUrlMock },
}));

import { AuthProvider } from '@/lib/auth-context';
import { buildTestSession } from '@/lib/test-fixtures/session';

import { ReportRunDialog } from './report-run-dialog';

import type { ReportDefinition } from '../types';

const report: ReportDefinition = {
  id: 'report-1',
  code: 'RPT-2026-0001',
  name: 'Painel executivo',
  description: 'Indicadores para a diretoria.',
  metricKeys: ['CONTROL_INACTIVE_COUNT', 'RISK_TOTAL_BY_LEVEL'],
  isActive: true,
  createdBy: { id: 'user-1', fullName: 'Ada Analyst' },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function renderDialog(): void {
  render(
    <AuthProvider initialSession={buildTestSession({ scope: { global: true, orgUnitIds: [] } })}>
      <ReportRunDialog report={report} open onOpenChange={vi.fn()} />
    </AuthProvider>,
  );
}

beforeEach(() => {
  runMock.mockReset();
  buildRunCsvUrlMock.mockClear();
});

describe('ReportRunDialog', () => {
  it('renders an available single-value item as a dominant number and an unavailable item as a distinct, non-zero state', async () => {
    runMock.mockResolvedValue({
      reportId: 'report-1',
      computedAt: '2026-09-12T14:32:00.000Z',
      items: [
        {
          metricKey: 'CONTROL_INACTIVE_COUNT',
          label: 'Controles inativos',
          available: true,
          scopeApplicability: 'ORGANIZATIONAL_UNIT',
          value: 4,
        },
        {
          metricKey: 'RISK_TOTAL_BY_LEVEL',
          label: 'Riscos por nível',
          available: false,
          scopeApplicability: 'ORGANIZATIONAL_UNIT',
        },
      ],
    });

    renderDialog();

    expect(await screen.findByText('4')).toBeInTheDocument();
    expect(screen.getByText('Sem permissão para ver este item')).toBeInTheDocument();
    // The unavailable item must never render as a bare zero alongside the real value.
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it("labels each item's scope by its OWN scopeApplicability, not one label for the whole run (S-07, A4-F01)", async () => {
    // A run mixes metrics of different scope applicability — an ORGANIZATIONAL_UNIT metric and an
    // ORGANIZATION_WIDE one (COMPLIANCE_PERCENTAGE) side by side — for a caller whose OWN scope is
    // NOT global. Before the fix, a single `reports.run.scopeLabel(scope.global)` line above the
    // grid would show "Sua unidade organizacional" once, misdescribing the ORGANIZATION_WIDE item.
    runMock.mockResolvedValue({
      reportId: 'report-1',
      computedAt: '2026-09-12T14:32:00.000Z',
      items: [
        {
          metricKey: 'CONTROL_INACTIVE_COUNT',
          label: 'Controles inativos',
          available: true,
          scopeApplicability: 'ORGANIZATIONAL_UNIT',
          value: 4,
        },
        {
          metricKey: 'COMPLIANCE_PERCENTAGE',
          label: 'Percentual de conformidade',
          available: true,
          scopeApplicability: 'ORGANIZATION_WIDE',
          value: 87.5,
        },
      ],
    });

    render(
      <AuthProvider initialSession={buildTestSession({ scope: { global: false, orgUnitIds: [] } })}>
        <ReportRunDialog report={report} open onOpenChange={vi.fn()} />
      </AuthProvider>,
    );

    expect(
      await screen.findByText('Escopo: Unidades organizacionais do seu escopo'),
    ).toBeInTheDocument();
    expect(screen.getByText('Escopo: Organização inteira')).toBeInTheDocument();
  });

  it('builds the CSV export link from reportsApi.buildRunCsvUrl, never a fetched blob', async () => {
    runMock.mockResolvedValue({
      reportId: 'report-1',
      computedAt: '2026-09-12T14:32:00.000Z',
      items: [],
    });

    renderDialog();

    await waitFor(() => expect(runMock).toHaveBeenCalledWith('report-1'));
    const exportLink = screen.getByRole('link', { name: /Exportar/ });
    expect(exportLink).toHaveAttribute('href', '/api/v1/reports/report-1/run?format=csv');
  });

  it('shows the report name/description from the already-loaded definition, not a second fetch', () => {
    runMock.mockResolvedValue({
      reportId: 'report-1',
      computedAt: '2026-09-12T14:32:00.000Z',
      items: [],
    });

    renderDialog();

    expect(screen.getByText('Painel executivo')).toBeInTheDocument();
    expect(screen.getByText('Indicadores para a diretoria.')).toBeInTheDocument();
  });
});
