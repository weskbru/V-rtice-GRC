import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listMeasurementsMock, createMeasurementMock, feedbackSuccessMock, feedbackErrorMock } =
  vi.hoisted(() => ({
    listMeasurementsMock: vi.fn(),
    createMeasurementMock: vi.fn(),
    feedbackSuccessMock: vi.fn(),
    feedbackErrorMock: vi.fn(),
  }));

vi.mock('../api', () => ({
  indicatorsApi: {
    listMeasurements: listMeasurementsMock,
    createMeasurement: createMeasurementMock,
  },
}));
vi.mock('@/components/shell/feedback-provider', () => ({
  feedback: { success: feedbackSuccessMock, error: feedbackErrorMock },
}));

import { ApiError } from '@/lib/api-client';
import { AuthProvider } from '@/lib/auth-context';
import { buildTestSession } from '@/lib/test-fixtures/session';

import { IndicatorHistorySection } from './indicator-history-section';

function renderSection(options: {
  scopeGlobal: boolean;
  canEdit?: boolean;
  hasThreshold?: boolean;
}): void {
  render(
    <AuthProvider
      initialSession={buildTestSession({ scope: { global: options.scopeGlobal, orgUnitIds: [] } })}
    >
      <IndicatorHistorySection
        metricKey="CONTROL_INACTIVE_COUNT"
        metricLabel="Controles inativos"
        hasThreshold={options.hasThreshold ?? true}
        canEdit={options.canEdit ?? false}
      />
    </AuthProvider>,
  );
}

const MEASUREMENT = {
  id: 'msr-1',
  metricKey: 'CONTROL_INACTIVE_COUNT',
  value: 2,
  valueByBucket: null,
  breached: true,
  computedAt: '2026-09-12T14:32:00.000Z',
  computedBy: { id: 'user-1', fullName: 'Ada Analyst' },
};

beforeEach(() => {
  listMeasurementsMock.mockReset();
  createMeasurementMock.mockReset();
  feedbackSuccessMock.mockReset();
  feedbackErrorMock.mockReset();
});

describe('IndicatorHistorySection — scope gate (research.md D-6)', () => {
  it('explains the GLOBAL-scope requirement, as an expected state, without ever calling the API', () => {
    renderSection({ scopeGlobal: false });

    expect(
      screen.getByText('Histórico disponível apenas para escopo organizacional completo'),
    ).toBeInTheDocument();
    expect(listMeasurementsMock).not.toHaveBeenCalled();
  });
});

describe('IndicatorHistorySection — GLOBAL scope', () => {
  it('renders the measurement history table with a breach badge', async () => {
    listMeasurementsMock.mockResolvedValue({
      data: [MEASUREMENT],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });

    renderSection({ scopeGlobal: true, hasThreshold: true });

    await waitFor(() => expect(screen.getAllByText('Limiar rompido')).toHaveLength(2));
    expect(screen.getByText('Ada Analyst')).toBeInTheDocument();
  });

  it('shows a dash, not a badge, for breached when no threshold is configured', async () => {
    listMeasurementsMock.mockResolvedValue({
      data: [MEASUREMENT],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });

    renderSection({ scopeGlobal: true, hasThreshold: false });

    await waitFor(() => expect(listMeasurementsMock).toHaveBeenCalled());
    expect(
      screen.getByText(
        'Este indicador não possui limiar configurado — nenhuma medição pode romper um limiar inexistente.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Limiar rompido')).not.toBeInTheDocument();
  });

  it('shows the empty state when there is no measurement yet', async () => {
    listMeasurementsMock.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
    });

    renderSection({ scopeGlobal: true });

    expect(await screen.findByText('Nenhuma medição registrada')).toBeInTheDocument();
  });

  it('shows an error state with a retry action on load failure', async () => {
    listMeasurementsMock.mockRejectedValue(new ApiError({ title: 'Erro', status: 500 }));

    renderSection({ scopeGlobal: true });

    expect(
      await screen.findByText('Não foi possível carregar o histórico deste indicador.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });

  it('hides "Registrar medição" without indicator:edit, and records + refreshes with it', async () => {
    listMeasurementsMock.mockResolvedValue({
      data: [MEASUREMENT],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });

    renderSection({ scopeGlobal: true, canEdit: false });
    await waitFor(() => expect(listMeasurementsMock).toHaveBeenCalled());
    expect(
      screen.queryByRole('button', { name: 'Registrar medição agora' }),
    ).not.toBeInTheDocument();

    createMeasurementMock.mockResolvedValue(MEASUREMENT);
    renderSection({ scopeGlobal: true, canEdit: true });
    const button = await screen.findByRole('button', { name: 'Registrar medição agora' });
    fireEvent.click(button);

    await waitFor(() =>
      expect(createMeasurementMock).toHaveBeenCalledWith('CONTROL_INACTIVE_COUNT'),
    );
    await waitFor(() => expect(feedbackSuccessMock).toHaveBeenCalled());
  });
});
