import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-client';

import { ActionAuditSection } from './action-audit-section';

import type { AuditEvent } from '../types';

/**
 * `ActionAuditSection` mounted directly (not through a Radix tab click —
 * `action-detail-view.test.tsx`'s own header explains why: Radix's `Tabs`
 * trigger does not respond to a plain `fireEvent.click` in jsdom the way a
 * real pointer interaction does, and `risk-detail-view.test.tsx` documents
 * the same limitation for its own audit tab). Mirrors this component's own
 * doc comment: a `404` (endpoint not live yet) is a DISTINCT case from
 * `empty` (endpoint live, genuinely no events).
 */

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

  /**
   * The creation event — the first entry of EVERY trail — carries two keys
   * no edit event ever does (`create-action.usecase.ts`'s own `newValues`).
   * They had no pt-BR label, so that first entry read half in Portuguese
   * and half in English (CLAUDE.md §11.1). Nothing failed; it was only
   * visible on screen, and only once the endpoint served a real trail.
   *
   * The VALUES stay as the server wrote them — `FINDING` is an enum value,
   * which §11.1 keeps in English on purpose. Only the labels are interface.
   */
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
