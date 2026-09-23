import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-client';
import { AuthProvider } from '@/lib/auth-context';
import { buildTestSession } from '@/lib/test-fixtures/session';

import { IncidentDetailView } from './incident-detail-view';

import type { IncidentDetail } from '@/features/incidents/types';

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

    expect(screen.getAllByRole('heading', { name: 'Relacionamentos' }).length).toBeGreaterThan(0);
    for (const label of ['Riscos', 'Ativos', 'Processos', 'Problemas']) {
      expect(screen.getAllByRole('link', { name: `${label} Ver` }).length).toBeGreaterThan(0);
    }
    expect(getByIdMock).toHaveBeenCalledTimes(1);
  });

  it('opens IncidentEditPanel (Sheet + IncidentForm) for a caller who holds incident:edit — the page underneath stays readable', async () => {
    getByIdMock.mockResolvedValueOnce(baseIncident);
    renderView(['incident:view', 'incident:edit']);
    await screen.findByRole('heading', { name: 'Indisponibilidade do portal de clientes' });

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByText('Editar incidente').length).toBeGreaterThan(0);
  });

  it('never swaps "Visão geral" for the form inline any more — Ciclo de vida stays on screen after clicking Editar', async () => {
    getByIdMock.mockResolvedValueOnce(baseIncident);
    renderView(['incident:view', 'incident:edit']);
    await screen.findByRole('heading', { name: 'Indisponibilidade do portal de clientes' });

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    await screen.findByRole('dialog');

    expect(screen.getAllByText('Ciclo de vida').length).toBeGreaterThan(0);
  });
});
