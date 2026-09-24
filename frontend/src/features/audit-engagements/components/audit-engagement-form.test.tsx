import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-client';

import { AuditEngagementForm } from './audit-engagement-form';

import type { AuditEngagement } from '../types';

const { pushMock, backMock, createEngagementMock, updateEngagementMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  backMock: vi.fn(),
  createEngagementMock: vi.fn(),
  updateEngagementMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, back: backMock }),
}));

vi.mock('../api', () => ({
  auditEngagementsApi: {
    createEngagement: createEngagementMock,
    updateEngagement: updateEngagementMock,
    listOrgUnits: vi.fn().mockResolvedValue([
      {
        id: 'org-1',
        code: 'ROOT',
        name: 'PharosGRC',
        parentId: null,
        depth: 0,
        status: 'ACTIVE',
      },
    ]),
    searchUsers: vi.fn().mockResolvedValue({
      data: [{ id: 'user-1', fullName: 'Ana Souza' }],
      isPartial: false,
    }),
  },
}));

const baseEngagement: AuditEngagement = {
  id: 'engagement-1',
  code: 'AUD-2026-0001',
  objective: 'Verificar controles de acesso privilegiado',
  periodStart: '2026-01-01',
  periodEnd: '2026-03-31',
  orgUnit: { id: 'org-1', name: 'PharosGRC' },
  leadAuditor: { id: 'user-1', fullName: 'Ana Souza' },
  status: 'PLANNING',
  startedAt: null,
  startedBy: null,
  completedAt: null,
  completedBy: null,
  cancelledAt: null,
  cancelledBy: null,
  cancellationJustification: null,
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('AuditEngagementForm', () => {
  beforeEach(() => {
    pushMock.mockReset();
    backMock.mockReset();
    createEngagementMock.mockReset();
    updateEngagementMock.mockReset();
  });

  it('rejects an empty submission with a field error per required field, never a silent no-op', async () => {
    render(<AuditEngagementForm mode="create" onSaved={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Abrir engajamento' }));

    expect(await screen.findByText('Informe o objetivo do engajamento.')).toBeInTheDocument();
    expect(screen.getByText('Informe o início do período.')).toBeInTheDocument();
    expect(screen.getByText('Informe o fim do período.')).toBeInTheDocument();
    expect(screen.getByText('Selecione a unidade organizacional.')).toBeInTheDocument();
    expect(screen.getByText('Selecione o auditor responsável.')).toBeInTheDocument();
    expect(createEngagementMock).not.toHaveBeenCalled();
  });

  it('rejects a period end earlier than its start', async () => {
    render(<AuditEngagementForm mode="create" onSaved={vi.fn()} />);

    fireEvent.change(await screen.findByLabelText(/^Objetivo/), {
      target: { value: 'Revisar acessos privilegiados' },
    });
    fireEvent.change(screen.getByLabelText(/^Início do período/), {
      target: { value: '2026-06-01' },
    });
    fireEvent.change(screen.getByLabelText(/^Fim do período/), { target: { value: '2026-01-01' } });

    fireEvent.click(screen.getByRole('button', { name: 'Abrir engajamento' }));

    expect(
      await screen.findByText('O fim do período não pode ser anterior ao início.'),
    ).toBeInTheDocument();
    expect(createEngagementMock).not.toHaveBeenCalled();
  });

  it('creates the engagement with the exact request body and navigates to its detail page', async () => {
    createEngagementMock.mockResolvedValue({ engagement: baseEngagement, etag: '"1"' });
    const onSaved = vi.fn();
    render(<AuditEngagementForm mode="create" onSaved={onSaved} />);

    fireEvent.change(await screen.findByLabelText(/^Objetivo/), {
      target: { value: 'Verificar controles de acesso privilegiado' },
    });
    fireEvent.change(screen.getByLabelText(/^Início do período/), {
      target: { value: '2026-01-01' },
    });
    fireEvent.change(screen.getByLabelText(/^Fim do período/), { target: { value: '2026-03-31' } });
    fireEvent.click(screen.getByRole('combobox', { name: /Unidade organizacional/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'PharosGRC' }));
    await waitFor(() =>
      expect(screen.queryByRole('option', { name: 'PharosGRC' })).not.toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('combobox', { name: /Auditor responsável/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Ana Souza' }));

    fireEvent.click(screen.getByRole('button', { name: 'Abrir engajamento' }));

    await waitFor(() =>
      expect(createEngagementMock).toHaveBeenCalledWith({
        objective: 'Verificar controles de acesso privilegiado',
        periodStart: '2026-01-01',
        periodEnd: '2026-03-31',
        orgUnitId: 'org-1',
        leadAuditorUserId: 'user-1',
      }),
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/audits/engagement-1'));
    expect(onSaved).toHaveBeenCalledWith({ engagement: baseEngagement, etag: '"1"' });
  });

  it('always shows the PLANNING-only editability notice on the edit form, before any attempt to save', async () => {
    render(
      <AuditEngagementForm mode="edit" engagement={baseEngagement} etag='"1"' onSaved={vi.fn()} />,
    );

    expect(
      await screen.findByText(
        'Este engajamento só pode ser editado enquanto está em planejamento. Depois de iniciado, seus dados descritivos ficam fixos.',
      ),
    ).toBeInTheDocument();
  });

  it('keeps every typed value and shows who changed the record on a 409 conflict, without discarding or reloading (ADR-013 equivalent)', async () => {
    updateEngagementMock.mockRejectedValueOnce(
      new ApiError({
        title: 'Conflito',
        status: 409,
        currentVersion: 3,
        modifiedBy: { id: 'user-2', fullName: 'Carlos Lima' },
        modifiedAt: '2026-02-01T00:00:00.000Z',
      }),
    );

    render(
      <AuditEngagementForm mode="edit" engagement={baseEngagement} etag='"1"' onSaved={vi.fn()} />,
    );

    fireEvent.change(await screen.findByLabelText(/^Objetivo/), {
      target: { value: 'Objetivo revisado pelo auditor' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(
      await screen.findByText('Este engajamento foi alterado por outra pessoa'),
    ).toBeInTheDocument();
    expect(screen.getByText('Alterado por: Carlos Lima')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Objetivo/)).toHaveValue('Objetivo revisado pelo auditor');
  });

  it('"Salvar mesmo assim" resubmits the same in-form values against the current version from the 409 body', async () => {
    updateEngagementMock.mockRejectedValueOnce(
      new ApiError({ title: 'Conflito', status: 409, currentVersion: 5 }),
    );
    updateEngagementMock.mockResolvedValueOnce({
      engagement: { ...baseEngagement, objective: 'Objetivo revisado pelo auditor', version: 6 },
      etag: '"6"',
    });
    const onSaved = vi.fn();

    render(
      <AuditEngagementForm mode="edit" engagement={baseEngagement} etag='"1"' onSaved={onSaved} />,
    );

    fireEvent.change(await screen.findByLabelText(/^Objetivo/), {
      target: { value: 'Objetivo revisado pelo auditor' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await screen.findByText('Este engajamento foi alterado por outra pessoa');

    fireEvent.click(screen.getByRole('button', { name: 'Salvar mesmo assim com meus dados' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(updateEngagementMock).toHaveBeenLastCalledWith(
      'engagement-1',
      expect.objectContaining({ objective: 'Objetivo revisado pelo auditor' }),
      '"5"',
    );
    expect(
      screen.queryByText('Este engajamento foi alterado por outra pessoa'),
    ).not.toBeInTheDocument();
  });
});
