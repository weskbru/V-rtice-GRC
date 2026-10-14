import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { processes } from '@/lib/messages/processes';

import { ProcessForm } from './process-form';

import type { ProcessDetail } from '../types';

const { pushMock, backMock, createProcessMock, updateProcessMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  backMock: vi.fn(),
  createProcessMock: vi.fn(),
  updateProcessMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, back: backMock }),
}));

vi.mock('../api', () => ({
  processesApi: {
    createProcess: createProcessMock,
    updateProcess: updateProcessMock,
    listOrgUnits: vi.fn().mockResolvedValue([
      { id: 'org-1', code: 'ROOT', name: 'Vértice GRC' },
      { id: 'org-2', code: 'FILIAL', name: 'Unidade Filial' },
    ]),
  },
}));

const baseProcess: ProcessDetail = {
  id: 'process-1',
  code: 'PRC-2026-0001',
  name: 'Aprovação de despesas',
  descriptionExcerpt: 'Descrição original.',
  description: 'Descrição original.',
  orgUnit: { id: 'org-1', code: 'ROOT', name: 'Vértice GRC' },
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  risks: [],
  controls: [],
};

describe('ProcessForm', () => {
  beforeEach(() => {
    pushMock.mockReset();
    backMock.mockReset();
    createProcessMock.mockReset();
    updateProcessMock.mockReset();
  });

  it('requires name and org unit — description stays optional', async () => {
    render(<ProcessForm mode="create" onSaved={vi.fn()} />);

    await waitFor(() => expect(screen.getByLabelText(/^Nome/)).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar processo' }));

    expect(await screen.findByText(processes.form.validation.name.required)).toBeInTheDocument();
    expect(screen.getByText(processes.form.validation.orgUnit.required)).toBeInTheDocument();
    expect(createProcessMock).not.toHaveBeenCalled();
  });

  it('creates a process without a description, never inventing one', async () => {
    createProcessMock.mockResolvedValueOnce({
      ...baseProcess,
      id: 'process-new',
      description: null,
    });
    render(<ProcessForm mode="create" onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText(/^Nome/)).not.toBeDisabled());

    fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: 'Novo processo' } });
    fireEvent.click(screen.getByRole('combobox', { name: /Unidade organizacional/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Vértice GRC' }));

    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar processo' }));

    await waitFor(() => expect(createProcessMock).toHaveBeenCalledTimes(1));
    expect(createProcessMock).toHaveBeenCalledWith({
      name: 'Novo processo',
      description: undefined,
      orgUnitId: 'org-1',
    });
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/processes/process-new'));
  });

  it('never sends an empty-string description on update — the server refuses it (MinLength(1))', async () => {
    updateProcessMock.mockResolvedValueOnce({ ...baseProcess, description: null });
    render(<ProcessForm mode="edit" process={baseProcess} onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText(/^Nome/)).not.toBeDisabled());

    fireEvent.change(screen.getByLabelText(/^Descrição/), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() =>
      expect(updateProcessMock).toHaveBeenCalledWith('process-1', {
        name: baseProcess.name,
        description: undefined,
        orgUnitId: 'org-1',
      }),
    );
  });

  it('renders the org unit field as required with its own explanatory helper (invariant A1)', async () => {
    render(<ProcessForm mode="create" onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText(/^Nome/)).not.toBeDisabled());

    expect(screen.getByText(processes.form.fields.orgUnit.helper)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Unidade organizacional/ })).toBeInTheDocument();
  });
});
