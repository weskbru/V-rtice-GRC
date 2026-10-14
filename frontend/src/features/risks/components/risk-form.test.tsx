import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-client';
import { risks } from '@/lib/messages/risks';

import { RiskForm } from './risk-form';

import type { RiskDetail } from '../types';

const { pushMock, backMock, createRiskMock, updateRiskMock, searchUsersMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  backMock: vi.fn(),
  createRiskMock: vi.fn(),
  updateRiskMock: vi.fn(),
  searchUsersMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, back: backMock }),
}));

vi.mock('../api', () => ({
  risksApi: {
    createRisk: createRiskMock,
    updateRisk: updateRiskMock,
    listCategories: vi.fn().mockResolvedValue([]),
    listTypes: vi.fn().mockResolvedValue([]),
    listOrigins: vi.fn().mockResolvedValue([]),
    listOrgUnits: vi.fn().mockResolvedValue([
      { id: 'org-1', code: 'ROOT', name: 'Vértice GRC' },
      { id: 'org-2', code: 'FILIAL', name: 'Unidade Filial' },
    ]),
    searchUsers: searchUsersMock,
  },
}));

const baseRisk: RiskDetail = {
  id: 'risk-1',
  code: 'RSK-2026-0001',
  title: 'Falha no fornecedor crítico',
  descriptionExcerpt: 'Descrição original do risco.',
  description: 'Descrição original do risco.',
  status: 'DRAFT',
  type: null,
  origin: null,
  orgUnit: { id: 'org-1', code: 'ROOT', name: 'Vértice GRC' },
  owner: { id: 'user-1', fullName: 'Ana Souza' },
  overdueReview: false,
  overdueTreatment: false,
  pendingApproval: false,
  version: 3,
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

describe('RiskForm', () => {
  beforeEach(() => {
    pushMock.mockReset();
    backMock.mockReset();
    createRiskMock.mockReset();
    updateRiskMock.mockReset();
    searchUsersMock.mockReset();
    searchUsersMock.mockResolvedValue({
      data: [{ id: 'user-1', fullName: 'Ana Souza' }],
      isPartial: false,
    });
  });

  it('requires title, description, org unit and owner before it may be saved (FR-055)', async () => {
    render(<RiskForm mode="create" onSaved={vi.fn()} />);

    await waitFor(() => expect(screen.getByLabelText(/^Título/)).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Criar risco' }));

    expect(await screen.findByText('Informe o título do risco.')).toBeInTheDocument();
    expect(screen.getByText('Informe a descrição do risco.')).toBeInTheDocument();
    expect(screen.getByText('Selecione a unidade organizacional.')).toBeInTheDocument();
    expect(screen.getByText('Selecione o gestor do risco.')).toBeInTheDocument();
    expect(createRiskMock).not.toHaveBeenCalled();
  });

  describe('T099 — 409 conflict preserves the user’s entered values', () => {
    async function renderEditFormAndTypeNewTitle(): Promise<void> {
      render(<RiskForm mode="edit" risk={baseRisk} etag='"3"' onSaved={vi.fn()} />);
      await waitFor(() => expect(screen.getByLabelText(/^Título/)).not.toBeDisabled());

      fireEvent.change(screen.getByLabelText(/^Título/), {
        target: { value: 'Título editado pelo usuário, ainda não salvo' },
      });
    }

    it('keeps the form’s entered values and shows who changed the record, without discarding or reloading', async () => {
      updateRiskMock.mockRejectedValueOnce(
        new ApiError({
          title: 'Conflito',
          status: 409,
          currentVersion: 5,
          currentStatus: 'IDENTIFIED',
          modifiedAt: '2026-01-02T10:00:00.000Z',
          modifiedBy: { id: 'user-2', fullName: 'Carlos Lima' },
        }),
      );

      await renderEditFormAndTypeNewTitle();
      fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

      expect(
        await screen.findByText('Este risco foi alterado por outra pessoa'),
      ).toBeInTheDocument();
      expect(screen.getByText('Alterado por: Carlos Lima')).toBeInTheDocument();

      expect(screen.getByLabelText(/^Título/)).toHaveValue(
        'Título editado pelo usuário, ainda não salvo',
      );
    });

    it('"Salvar mesmo assim" resubmits the same in-form values against the current version, not a reloaded record', async () => {
      updateRiskMock.mockRejectedValueOnce(
        new ApiError({
          title: 'Conflito',
          status: 409,
          currentVersion: 5,
          currentStatus: 'IDENTIFIED',
        }),
      );
      updateRiskMock.mockResolvedValueOnce({
        risk: { ...baseRisk, title: 'Título editado pelo usuário, ainda não salvo', version: 6 },
        etag: '"6"',
      });
      const onSaved = vi.fn();

      render(<RiskForm mode="edit" risk={baseRisk} etag='"3"' onSaved={onSaved} />);
      await waitFor(() => expect(screen.getByLabelText(/^Título/)).not.toBeDisabled());
      fireEvent.change(screen.getByLabelText(/^Título/), {
        target: { value: 'Título editado pelo usuário, ainda não salvo' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
      await screen.findByText('Este risco foi alterado por outra pessoa');

      fireEvent.click(screen.getByRole('button', { name: 'Salvar mesmo assim com meus dados' }));

      await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
      expect(updateRiskMock).toHaveBeenLastCalledWith(
        'risk-1',
        expect.objectContaining({ title: 'Título editado pelo usuário, ainda não salvo' }),
        '"5"',
      );
      expect(
        screen.queryByText('Este risco foi alterado por outra pessoa'),
      ).not.toBeInTheDocument();
    });
  });

  it('creates a risk and hands the caller the created record before navigating to its detail page', async () => {
    createRiskMock.mockResolvedValueOnce({ risk: { ...baseRisk, id: 'risk-new' }, etag: '"0"' });
    const onSaved = vi.fn();

    render(<RiskForm mode="create" onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByLabelText(/^Título/)).not.toBeDisabled());

    fireEvent.change(screen.getByLabelText(/^Título/), {
      target: { value: 'Novo risco de teste' },
    });
    fireEvent.change(screen.getByLabelText(/^Descrição/), {
      target: { value: 'Descrição do novo risco de teste.' },
    });

    fireEvent.click(screen.getByRole('combobox', { name: /Unidade organizacional/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Vértice GRC' }));
    await waitFor(() => expect(screen.queryByRole('option', { name: 'Vértice GRC' })).toBeNull());

    fireEvent.click(screen.getByRole('combobox', { name: /Gestor do risco/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Ana Souza' }));

    fireEvent.click(screen.getByRole('button', { name: 'Criar risco' }));

    await waitFor(() => expect(createRiskMock).toHaveBeenCalledTimes(1));
    expect(createRiskMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Novo risco de teste',
        description: 'Descrição do novo risco de teste.',
        orgUnitId: 'org-1',
        ownerUserId: 'user-1',
      }),
    );
    const [submittedBody] = createRiskMock.mock.calls[0] as [Record<string, unknown>];
    expect(submittedBody).not.toHaveProperty('inherentScore');
    expect(submittedBody).not.toHaveProperty('inherentLevel');
    expect(submittedBody).not.toHaveProperty('residualScore');
    expect(submittedBody).not.toHaveProperty('residualLevel');
    expect(submittedBody).not.toHaveProperty('status');
    expect(submittedBody).not.toHaveProperty('code');

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(pushMock).toHaveBeenCalledWith('/risks/risk-new');
  });

  describe('owner/responsible pickers use the ASSIGNMENT listing for the form’s selected org unit', () => {
    it('requests the assignment listing for the org unit already selected in the form, not the caller’s browse scope', async () => {
      render(<RiskForm mode="edit" risk={baseRisk} etag='"3"' onSaved={vi.fn()} />);
      await waitFor(() => expect(screen.getByLabelText(/^Título/)).not.toBeDisabled());

      await waitFor(() => expect(searchUsersMock).toHaveBeenCalledWith('', 'org-1'));
      expect(searchUsersMock).not.toHaveBeenCalledWith('', undefined);

      fireEvent.click(screen.getByRole('combobox', { name: /Gestor do risco/ }));
      expect(await screen.findByRole('option', { name: 'Ana Souza' })).toBeInTheDocument();
    });

    it('refetches the assignment listing with the newly selected unit when the org unit changes', async () => {
      render(<RiskForm mode="create" onSaved={vi.fn()} />);
      await waitFor(() => expect(screen.getByLabelText(/^Título/)).not.toBeDisabled());
      expect(searchUsersMock).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('combobox', { name: /Unidade organizacional/ }));
      fireEvent.click(await screen.findByRole('option', { name: 'Vértice GRC' }));
      await waitFor(() => expect(searchUsersMock).toHaveBeenCalledWith('', 'org-1'));

      fireEvent.click(screen.getByRole('combobox', { name: /Unidade organizacional/ }));
      fireEvent.click(await screen.findByRole('option', { name: 'Unidade Filial' }));
      await waitFor(() => expect(searchUsersMock).toHaveBeenCalledWith('', 'org-2'));
    });

    it('disables the owner and responsible pickers with an explanatory message before an org unit is selected — never silently empty, never enabled-but-empty', async () => {
      render(<RiskForm mode="create" onSaved={vi.fn()} />);
      await waitFor(() => expect(screen.getByLabelText(/^Título/)).not.toBeDisabled());

      expect(screen.getByRole('combobox', { name: /Gestor do risco/ })).toBeDisabled();
      expect(screen.getByRole('combobox', { name: /Responsável/ })).toBeDisabled();
      expect(screen.getByText(risks.form.fields.owner.selectOrgUnitFirst)).toBeInTheDocument();
      expect(
        screen.getByText(risks.form.fields.responsible.selectOrgUnitFirst),
      ).toBeInTheDocument();
      expect(searchUsersMock).not.toHaveBeenCalled();
    });

    it('shows an explicit, retryable error — never a silently empty picker — when the assignment listing fails to load', async () => {
      searchUsersMock.mockReset();
      searchUsersMock.mockRejectedValue(new Error('network down'));

      render(<RiskForm mode="edit" risk={baseRisk} etag='"3"' onSaved={vi.fn()} />);
      await waitFor(() => expect(screen.getByLabelText(/^Título/)).not.toBeDisabled());

      expect(await screen.findByText(risks.form.fields.owner.loadError)).toBeInTheDocument();
      expect(screen.getByText(risks.form.fields.responsible.loadError)).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: 'Tentar novamente' }).length).toBeGreaterThan(0);
      fireEvent.click(screen.getByRole('combobox', { name: /Gestor do risco/ }));
      expect(screen.queryByRole('option', { name: 'Ana Souza' })).not.toBeInTheDocument();
    });

    it('clears an already-selected owner that the newly selected unit no longer assigns to, and says so visibly', async () => {
      searchUsersMock.mockReset();
      searchUsersMock
        .mockResolvedValueOnce({
          data: [{ id: 'user-1', fullName: 'Ana Souza' }],
          isPartial: false,
        })
        .mockResolvedValueOnce({
          data: [{ id: 'user-2', fullName: 'Carlos Lima' }],
          isPartial: false,
        })
        .mockResolvedValueOnce({ data: [], isPartial: false })
        .mockResolvedValue({ data: [{ id: 'user-2', fullName: 'Carlos Lima' }], isPartial: false });

      render(<RiskForm mode="edit" risk={baseRisk} etag='"3"' onSaved={vi.fn()} />);
      await waitFor(() => expect(screen.getByLabelText(/^Título/)).not.toBeDisabled());
      await waitFor(() => expect(searchUsersMock).toHaveBeenCalledWith('', 'org-1'));

      fireEvent.click(screen.getByRole('combobox', { name: /Unidade organizacional/ }));
      fireEvent.click(await screen.findByRole('option', { name: 'Unidade Filial' }));
      await waitFor(() => expect(searchUsersMock).toHaveBeenCalledWith('', 'org-2'));
      await waitFor(() => expect(searchUsersMock).toHaveBeenCalledWith('Ana Souza', 'org-2'));

      expect(await screen.findByText(risks.form.fields.owner.clearedNotice)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('combobox', { name: /Gestor do risco/ }));
      expect(await screen.findByRole('option', { name: 'Carlos Lima' })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: 'Ana Souza' })).not.toBeInTheDocument();
    });
  });
});
