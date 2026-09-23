import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-client';

import { ActionAuditSection } from './action-audit-section';

import type { AuditEvent } from '../types';

const { listActionAuditEventsMock } = vi.hoisted(() => ({ listActionAuditEventsMock: vi.fn() }));

vi.mock('../api', () => ({
  actionsApi: { listActionAuditEvents: listActionAuditEventsMock },
}));

const baseEvent: AuditEvent = {
  id: 'audit-1',
  occurredAt: '2026-01-02T10:00:00.000Z',
  actor: { id: 'user-1', fullName: 'Ana Souza' },
  actorLabel: 'Ana Souza',
  action: 'action.updated',
  entityType: 'ACTION',
  entityId: 'action-1',
  previousValues: { title: 'Título antigo' },
  newValues: { title: 'Título novo' },
  outcome: 'SUCCESS',
  ipAddress: '10.0.0.1',
  userAgent: 'Mozilla/5.0',
  correlationId: 'corr-1',
};

beforeEach(() => {
  listActionAuditEventsMock.mockReset();
});

describe('ActionAuditSection', () => {
  it('shows a loading state before the first page resolves', () => {
    listActionAuditEventsMock.mockReturnValue(new Promise(() => undefined));
    render(<ActionAuditSection actionId="action-1" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows the empty message when the trail genuinely has no events', async () => {
    listActionAuditEventsMock.mockResolvedValueOnce({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
    });
    render(<ActionAuditSection actionId="action-1" />);

    expect(
      await screen.findByText('Nenhum evento de auditoria registrado ainda.'),
    ).toBeInTheDocument();
  });

  it('renders a loaded event with its outcome, action and changed fields', async () => {
    listActionAuditEventsMock.mockResolvedValueOnce({
      data: [baseEvent],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
    render(<ActionAuditSection actionId="action-1" />);

    expect(await screen.findByText('action.updated')).toBeInTheDocument();
    expect(screen.getByText('Sucesso')).toBeInTheDocument();
    expect(screen.getByText('Título:')).toBeInTheDocument();
    expect(screen.getByText('Título antigo')).toBeInTheDocument();
    expect(screen.getByText('Título novo')).toBeInTheDocument();
  });

  it('labels the creation event´s origin fields in pt-BR, values untouched', async () => {
    listActionAuditEventsMock.mockResolvedValueOnce({
      data: [
        {
          ...baseEvent,
          action: 'action.created',
          previousValues: null,
          newValues: { originType: 'FINDING', originId: 'finding-1' },
        },
      ],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
    render(<ActionAuditSection actionId="action-1" />);

    expect(await screen.findByText('Tipo de origem:')).toBeInTheDocument();
    expect(screen.getByText('Origem:')).toBeInTheDocument();
    expect(screen.queryByText('originType:')).not.toBeInTheDocument();
    expect(screen.queryByText('originId:')).not.toBeInTheDocument();
    expect(screen.getByText('FINDING')).toBeInTheDocument();
  });

  it('shows a distinct forbidden message on a 403 (stale client-side audit:view snapshot)', async () => {
    listActionAuditEventsMock.mockRejectedValueOnce(
      new ApiError({ title: 'Proibido', status: 403 }),
    );
    render(<ActionAuditSection actionId="action-1" />);

    await waitFor(() =>
      expect(screen.getByText('Sem permissão para ver a trilha de auditoria')).toBeInTheDocument(),
    );
  });

  it('shows the generic load-error message on a 404 (route not live yet) — never a false "no events"', async () => {
    listActionAuditEventsMock.mockRejectedValueOnce(
      new ApiError({ title: 'Não encontrado', status: 404 }),
    );
    render(<ActionAuditSection actionId="action-1" />);

    await waitFor(() =>
      expect(
        screen.getByText('Não foi possível carregar a trilha de auditoria.'),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByText('Nenhum evento de auditoria registrado ainda.'),
    ).not.toBeInTheDocument();
  });

  it('shows a "load more" control only when a further page exists', async () => {
    listActionAuditEventsMock.mockResolvedValueOnce({
      data: [baseEvent],
      meta: { page: 1, pageSize: 20, total: 40, totalPages: 2 },
    });
    render(<ActionAuditSection actionId="action-1" />);

    expect(await screen.findByRole('button', { name: 'Carregar mais' })).toBeInTheDocument();
  });
});
