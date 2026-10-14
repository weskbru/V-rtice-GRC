import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RiskTreatmentSection } from './risk-treatment-section';

import type { RiskDetail, RiskTreatmentDecision } from '../types';

const { listTreatmentsMock, createTreatmentMock } = vi.hoisted(() => ({
  listTreatmentsMock: vi.fn(),
  createTreatmentMock: vi.fn(),
}));

vi.mock('../api', () => ({
  risksApi: { listTreatments: listTreatmentsMock, createTreatment: createTreatmentMock },
}));

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

function decisionFixture(overrides: Partial<RiskTreatmentDecision>): RiskTreatmentDecision {
  return {
    id: 'decision-1',
    strategy: 'MITIGATE',
    description: 'Mitigar via controles adicionais.',
    deadline: '2027-06-30',
    decidedBy: { id: 'user-1', fullName: 'Ana Souza' },
    decidedAt: '2026-01-10T00:00:00.000Z',
    supersededAt: null,
    deadlineOverdue: false,
    ...overrides,
  };
}

describe('RiskTreatmentSection', () => {
  beforeEach(() => {
    listTreatmentsMock.mockReset();
    createTreatmentMock.mockReset();
    listTreatmentsMock.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
    });
  });

  it('shows the honest not-treated state for a risk with no current decision (SC-013)', async () => {
    render(
      <RiskTreatmentSection
        risk={baseRisk}
        etag='"1"'
        canTreat={false}
        onTreated={() => undefined}
      />,
    );

    expect(
      await screen.findByText('Este risco ainda não possui uma decisão de tratamento'),
    ).toBeInTheDocument();
  });

  it('shows the current treatment decision — strategy, description, deadline and attribution', async () => {
    const risk: RiskDetail = { ...baseRisk, currentTreatment: decisionFixture({}) };
    render(
      <RiskTreatmentSection risk={risk} etag='"1"' canTreat={false} onTreated={() => undefined} />,
    );

    expect(await screen.findByText('Mitigar')).toBeInTheDocument();
    expect(screen.getByText('Mitigar via controles adicionais.')).toBeInTheDocument();
    expect(screen.getByText('Decidido por Ana Souza')).toBeInTheDocument();
  });

  it('hides the record-decision form for a caller without risk:treat (FR-071)', async () => {
    render(
      <RiskTreatmentSection
        risk={baseRisk}
        etag='"1"'
        canTreat={false}
        onTreated={() => undefined}
      />,
    );
    await screen.findByText('Este risco ainda não possui uma decisão de tratamento');
    expect(screen.queryByRole('button', { name: 'Registrar decisão' })).not.toBeInTheDocument();
  });

  it('warns that a new decision will supersede the current one BEFORE the user can submit (FR-073)', async () => {
    const risk: RiskDetail = { ...baseRisk, currentTreatment: decisionFixture({}) };
    render(<RiskTreatmentSection risk={risk} etag='"1"' canTreat onTreated={() => undefined} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Registrar nova decisão' }));

    expect(
      screen.getByText(/Registrar esta nova decisão irá substituí-la como decisão vigente/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Este risco já possui uma decisão vigente \(Mitigar\)/),
    ).toBeInTheDocument();
  });

  it('records a new decision, calls onTreated, and collapses the form back to its trigger', async () => {
    createTreatmentMock.mockResolvedValue({
      decision: decisionFixture({ strategy: 'ACCEPT' }),
      etag: '"2"',
    });
    const onTreated = vi.fn();

    render(<RiskTreatmentSection risk={baseRisk} etag='"1"' canTreat onTreated={onTreated} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar nova decisão' }));

    fireEvent.click(screen.getByRole('combobox', { name: /^Estratégia/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Aceitar' }));
    fireEvent.change(screen.getByLabelText(/^Descrição/), {
      target: { value: 'Aceitar o risco dada a baixa exposição.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar decisão' }));

    await waitFor(() => expect(createTreatmentMock).toHaveBeenCalledTimes(1));
    expect(createTreatmentMock).toHaveBeenCalledWith(
      'risk-1',
      {
        strategy: 'ACCEPT',
        description: 'Aceitar o risco dada a baixa exposição.',
        deadline: null,
      },
      '"1"',
    );
    await waitFor(() => expect(onTreated).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('button', { name: 'Registrar decisão' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar nova decisão' })).toBeInTheDocument();
  });

  it('shows an evident "Registrar nova decisão" action inside the empty state itself, for a risk never treated', async () => {
    render(
      <RiskTreatmentSection risk={baseRisk} etag='"1"' canTreat onTreated={() => undefined} />,
    );

    expect(
      await screen.findByText('Este risco ainda não possui uma decisão de tratamento'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar nova decisão' })).toBeInTheDocument();
  });

  it('cancelling the form discards the draft without submitting, and shows the trigger again', async () => {
    const risk: RiskDetail = { ...baseRisk, currentTreatment: decisionFixture({}) };
    render(<RiskTreatmentSection risk={risk} etag='"1"' canTreat onTreated={() => undefined} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Registrar nova decisão' }));
    fireEvent.change(screen.getByLabelText(/^Descrição/), {
      target: { value: 'Rascunho que não deve ser enviado.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(createTreatmentMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Registrar decisão' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar nova decisão' })).toBeInTheDocument();
  });
});
