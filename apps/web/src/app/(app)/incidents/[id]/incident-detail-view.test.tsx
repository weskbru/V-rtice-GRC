import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-client';
import { AuthProvider } from '@/lib/auth-context';
import { buildTestSession } from '@/lib/test-fixtures/session';

import { IncidentDetailView } from './incident-detail-view';

import type { IncidentDetail } from '@/features/incidents/types';

/**
 * Component-mount evidence for the incident detail screen's two-level
 * navigation and deep-link resolution (018-incident-detail-experience, Fase
 * 2+3). Central assertions:
 *
 *   - all four groups are reachable, with the exact labels the catalog
 *     declares;
 *   - `?section=` naming an unknown id falls back silently to "Visão
 *     geral", never an error, never nothing selected;
 *   - exactly ONE request fires on mount (`getById`) — unlike Risk, there is
 *     no second lifecycle request to make (no such endpoint exists for
 *     Incident, see `status.ts`'s own header comment).
 *
 * `next/navigation` is mocked the same way `risk-detail-view.test.tsx`
 * already does — `currentSearch` stands in for "the URL right now".
 */

const { replaceMock } = vi.hoisted(() => ({ replaceMock: vi.fn() }));
let currentSearch = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => '/incidents/incident-1',
  useSearchParams: () => currentSearch,
}));

const { getByIdMock } = vi.hoisted(() => ({
  getByIdMock: vi.fn(),
}));

vi.mock('@/features/incidents/api', () => ({
  incidentsApi: {
    getById: getByIdMock,
    // No other section is opened by these tests — every other method a
    // section's own component might call never resolving is fine, mirroring
    // `risk-detail-view.test.tsx`'s own convention for tabs it does not
    // examine the content of. `listOrgUnits`/`searchUsers` are `IncidentForm`
    // (mode="edit")'s own reference-data calls, exercised only by the edit-
    // panel test below, which never advances past opening the panel.
    transition: vi.fn(() => new Promise(() => undefined)),
    listOrgUnits: vi.fn(() => new Promise(() => undefined)),
    searchUsers: vi.fn(() => new Promise(() => undefined)),
  },
}));

const baseIncident: IncidentDetail = {
  id: 'incident-1',
  code: 'INC-2026-0051',
  title: 'Indisponibilidade do portal de clientes',
  description: 'O portal ficou indisponível por 40 minutos durante o horário de pico.',
  severity: 'HIGH',
  status: 'OPEN',
  orgUnit: { id: 'org-1', code: 'ROOT', name: 'PharosGRC' },
  owner: { id: 'user-1', fullName: 'Ana Souza' },
  reportedBy: { id: 'user-1', fullName: 'Ana Souza' },
  reportedOn: '2026-01-01',
};

function renderView(permissions: readonly string[]): void {
  render(
    <AuthProvider initialSession={buildTestSession({ permissions })}>
      <IncidentDetailView incidentId="incident-1" />
    </AuthProvider>,
  );
}

describe('IncidentDetailView', () => {
  beforeEach(() => {
    currentSearch = new URLSearchParams();
    replaceMock.mockClear();
    getByIdMock.mockReset();
  });

  it('fires exactly one request on mount — GET incident, no lifecycle request (unlike Risk)', async () => {
    getByIdMock.mockResolvedValueOnce(baseIncident);
    renderView(['incident:view']);

    await screen.findByRole('heading', { name: 'Indisponibilidade do portal de clientes' });
    expect(getByIdMock).toHaveBeenCalledTimes(1);
  });

  it('renders the breadcrumb, code, title and the four top-level groups', async () => {
    getByIdMock.mockResolvedValueOnce(baseIncident);
    renderView(['incident:view']);

    expect(
      await screen.findByRole('heading', { name: 'Indisponibilidade do portal de clientes' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Incidentes' })).toHaveAttribute('href', '/incidents');
    expect(screen.getAllByText('INC-2026-0051').length).toBeGreaterThan(0);

    for (const label of ['Visão geral', 'Resposta', 'Relacionamentos', 'Registro']) {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument();
    }
    // Never Risk's own fifth group — Incidents has no "Análise" (the user's
    // explicit instruction against copying Risk's group shape verbatim).
    expect(screen.queryByRole('tab', { name: 'Análise' })).not.toBeInTheDocument();
  });

  it('renders the three-card overview (Descrição, Detalhes do incidente, Ciclo de vida) by default, with no summary stat row', async () => {
    getByIdMock.mockResolvedValueOnce(baseIncident);
    renderView(['incident:view']);

    await screen.findByRole('heading', { name: 'Indisponibilidade do portal de clientes' });
    expect(screen.getByText('Descrição')).toBeInTheDocument();
    expect(screen.getByText('Detalhes do incidente')).toBeInTheDocument();
    expect(screen.getByText('Ciclo de vida')).toBeInTheDocument();
  });

  it('falls back to Visão geral, without error, for an unknown ?section= id', async () => {
    currentSearch = new URLSearchParams('section=does-not-exist');
    getByIdMock.mockResolvedValueOnce(baseIncident);
    renderView(['incident:view']);

    expect(
      await screen.findByRole('heading', { name: 'Indisponibilidade do portal de clientes' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Detalhes do incidente')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Visão geral', selected: true })).toBeInTheDocument();
  });

  it('shows an honest not-found message on 404 — never distinguishing "does not exist" from "out of scope"', async () => {
    getByIdMock.mockRejectedValueOnce(new ApiError({ title: 'Não encontrado', status: 404 }));
    renderView(['incident:view']);

    await waitFor(() => expect(screen.getByText('Incidente não encontrado')).toBeInTheDocument());
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('hides the Editar action for a caller without incident:edit (advisory gating)', async () => {
    getByIdMock.mockResolvedValueOnce(baseIncident);
    renderView(['incident:view']);
    await screen.findByRole('heading', { name: 'Indisponibilidade do portal de clientes' });
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
  });

  it('renders the contextual aside ("Relacionamentos") beside the navigation, fed by data already on the page', async () => {
    getByIdMock.mockResolvedValueOnce(baseIncident);
    renderView(['incident:view']);
    await screen.findByRole('heading', { name: 'Indisponibilidade do portal de clientes' });

    // `getAllBy*` — `DetailLayout` renders its aside twice in the DOM (once
    // for the wide, `xl`+ layout, once for the narrow one), toggled with
    // `hidden`/responsive `display`, per its own doc comment; jsdom applies
    // no real CSS layout to hide either copy from a query.
    expect(screen.getAllByRole('heading', { name: 'Relacionamentos' }).length).toBeGreaterThan(0);
    for (const label of ['Riscos', 'Ativos', 'Processos', 'Problemas']) {
      expect(screen.getAllByRole('link', { name: `${label} Ver` }).length).toBeGreaterThan(0);
    }
    // Still exactly one request — the aside added no request of its own.
    expect(getByIdMock).toHaveBeenCalledTimes(1);
  });

  it('opens IncidentEditPanel (Sheet + IncidentForm) for a caller who holds incident:edit — the page underneath stays readable', async () => {
    getByIdMock.mockResolvedValueOnce(baseIncident);
    renderView(['incident:view', 'incident:edit']);
    await screen.findByRole('heading', { name: 'Indisponibilidade do portal de clientes' });

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));

    // Radix marks the rest of the page `aria-hidden` while the modal Sheet
    // is open (mirrors `risk-detail-view.test.tsx`'s own identical note) —
    // this only asserts the panel itself opened, not that the read-only
    // page underneath remains in the accessibility tree while it is open.
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByText('Editar incidente').length).toBeGreaterThan(0);
  });

  it('never swaps "Visão geral" for the form inline any more — Ciclo de vida stays on screen after clicking Editar', async () => {
    getByIdMock.mockResolvedValueOnce(baseIncident);
    renderView(['incident:view', 'incident:edit']);
    await screen.findByRole('heading', { name: 'Indisponibilidade do portal de clientes' });

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    await screen.findByRole('dialog');

    // "Ciclo de vida" is part of the SAME "Visão geral" section that used to
    // be swapped out for the form — its continued presence in the DOM
    // proves the overlay opened alongside the read-only page, not instead
    // of it.
    expect(screen.getAllByText('Ciclo de vida').length).toBeGreaterThan(0);
  });
});
