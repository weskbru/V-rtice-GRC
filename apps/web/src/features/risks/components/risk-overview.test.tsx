import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RiskOverview } from './risk-overview';

import type { RiskDetail } from '../types';

/** Component-mount evidence for T097 (`RiskOverview`, FR-069, SC-013). */

const baseRisk: RiskDetail = {
  id: 'risk-1',
  code: 'RSK-2026-0001',
  title: 'Falha no fornecedor crítico',
  descriptionExcerpt: 'Descrição completa do risco.',
  description: 'Descrição completa do risco.',
  status: 'DRAFT',
  category: { id: 'cat-1', code: 'OPS', name: 'Operacional' },
  type: null,
  origin: null,
  orgUnit: { id: 'org-1', code: 'ROOT', name: 'PharosGRC' },
  owner: { id: 'user-1', fullName: 'Ana Souza' },
  responsible: { id: 'user-2', fullName: 'Carlos Lima' },
  overdueReview: false,
  overdueTreatment: false,
  pendingApproval: false,
  version: 0,
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

describe('RiskOverview', () => {
  it('renders description, classification and ownership fields from the real record, in one merged "Detalhes do risco" card', () => {
    render(<RiskOverview risk={baseRisk} />);
    expect(screen.getByText('Descrição completa do risco.')).toBeInTheDocument();
    expect(screen.getByText('Detalhes do risco')).toBeInTheDocument();
    expect(screen.getByText('Operacional')).toBeInTheDocument();
    expect(screen.getByText('Ana Souza')).toBeInTheDocument();
    expect(screen.getByText('Carlos Lima')).toBeInTheDocument();
  });

  // 016-risk-detail-experience §4.3/§4.5 — inherent/residual level moved to
  // the record's own executive summary row (`RiskSummaryRow`), which keeps
  // SC-013's "never fabricate a level" guarantee now; this section no longer
  // renders either level at all.
  it('no longer renders inherent/residual level — that moved to the executive summary row', () => {
    render(<RiskOverview risk={{ ...baseRisk, inherentLevel: 'HIGH', residualLevel: 'LOW' }} />);
    expect(screen.queryByText(/Inerente/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Residual/)).not.toBeInTheDocument();
  });
});
