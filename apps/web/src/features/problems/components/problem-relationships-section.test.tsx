import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ProblemIncidentLinksSection,
  ProblemRiskLinksSection,
} from './problem-relationships-section';

import type { ProblemIncidentLinkResponse, ProblemRiskLinkResponse } from '../types';

/**
 * Component-mount evidence for the problem detail's Riscos/Incidentes
 * relationship sections (019-problem-detail-experience, Fase D —
 * progressive disclosure). `../api` is mocked at the network boundary.
 *
 * Central assertions, mirroring
 * `incident-relationships-section.test.tsx`'s own `gateLinkBehindAction`
 * coverage exactly:
 *
 *   - the picker is absent until the caller clicks the intent button, and
 *     appears immediately after;
 *   - the empty state is never silent — the intent trigger renders directly
 *     under the empty-state sentence, for a caller who can link;
 *   - "Incluir vínculos desfeitos" stays reachable in the header regardless
 *     of whether the picker is open.
 */

const { listRiskLinksMock, listRiskOptionsMock, linkRiskMock, unlinkRiskMock } = vi.hoisted(() => ({
  listRiskLinksMock: vi.fn(),
  listRiskOptionsMock: vi.fn(),
  linkRiskMock: vi.fn(),
  unlinkRiskMock: vi.fn(),
}));

const {
  listIncidentLinksMock,
  listIncidentOptionsMock,
  linkToIncidentMock,
  unlinkFromIncidentMock,
} = vi.hoisted(() => ({
  listIncidentLinksMock: vi.fn(),
  listIncidentOptionsMock: vi.fn(),
  linkToIncidentMock: vi.fn(),
  unlinkFromIncidentMock: vi.fn(),
}));

vi.mock('../api', () => ({
  problemsApi: {
    listRiskLinks: listRiskLinksMock,
    listRiskOptions: listRiskOptionsMock,
    linkRisk: linkRiskMock,
    unlinkRisk: unlinkRiskMock,
    listIncidentLinks: listIncidentLinksMock,
    listIncidentOptions: listIncidentOptionsMock,
    linkToIncident: linkToIncidentMock,
    unlinkFromIncident: unlinkFromIncidentMock,
  },
}));

const linkedBy = { id: 'user-1', fullName: 'Ana Souza' };

function riskLinkFixture(
  overrides: Partial<ProblemRiskLinkResponse> = {},
): ProblemRiskLinkResponse {
  return {
    id: 'link-1',
    risk: { id: 'risk-1', code: 'RSK-2026-0001', title: 'Falha no fornecedor crítico' },
    linkedBy,
    linkedAt: '2026-01-05T00:00:00.000Z',
    unlinkedAt: null,
    ...overrides,
  };
}

function incidentLinkFixture(
  overrides: Partial<ProblemIncidentLinkResponse> = {},
): ProblemIncidentLinkResponse {
  return {
    id: 'link-i1',
    incident: {
      id: 'incident-1',
      code: 'INC-2026-0001',
      title: 'Indisponibilidade do portal',
      status: 'OPEN',
    },
    linkedBy,
    linkedAt: '2026-01-05T00:00:00.000Z',
    unlinkedAt: null,
    ...overrides,
  };
}

describe('ProblemRiskLinksSection (representative of the two gated families)', () => {
  beforeEach(() => {
    listRiskLinksMock.mockReset();
    listRiskOptionsMock.mockReset();
    linkRiskMock.mockReset();
    unlinkRiskMock.mockReset();
    listRiskOptionsMock.mockResolvedValue({ data: [], isPartial: false });
  });

  it('shows the empty-state sentence with the intent trigger directly under it — never a silently open picker', async () => {
    listRiskLinksMock.mockResolvedValue([]);
    render(<ProblemRiskLinksSection problemId="problem-1" canLinkPermission />);

    expect(await screen.findByText('Nenhum risco vinculado a este problema.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vincular risco' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Selecionar risco' })).not.toBeInTheDocument();
  });

  it('keeps the picker behind a "Vincular risco" trigger once risks are already linked, and "Cancelar" discards the draft', async () => {
    listRiskLinksMock.mockResolvedValue([riskLinkFixture()]);
    render(<ProblemRiskLinksSection problemId="problem-1" canLinkPermission />);

    await screen.findByText('Falha no fornecedor crítico');
    expect(screen.queryByRole('combobox', { name: 'Selecionar risco' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Vincular risco' }));
    expect(screen.getByRole('combobox', { name: 'Selecionar risco' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('combobox', { name: 'Selecionar risco' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vincular risco' })).toBeInTheDocument();
  });

  it('never shows the intent trigger or the picker for a caller without problem:link', async () => {
    listRiskLinksMock.mockResolvedValue([]);
    render(<ProblemRiskLinksSection problemId="problem-1" canLinkPermission={false} />);

    await screen.findByText('Nenhum risco vinculado a este problema.');
    expect(screen.queryByRole('button', { name: 'Vincular risco' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Selecionar risco' })).not.toBeInTheDocument();
  });

  it('keeps "Incluir vínculos desfeitos" reachable in the header at all times, including while the picker is open', async () => {
    listRiskLinksMock.mockResolvedValue([riskLinkFixture()]);
    render(<ProblemRiskLinksSection problemId="problem-1" canLinkPermission />);

    await screen.findByText('Falha no fornecedor crítico');
    const checkbox = screen.getByRole('checkbox', { name: 'Incluir vínculos desfeitos' });
    expect(checkbox).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Vincular risco' }));
    expect(
      screen.getByRole('checkbox', { name: 'Incluir vínculos desfeitos' }),
    ).toBeInTheDocument();

    fireEvent.click(checkbox);
    await waitFor(() => expect(listRiskLinksMock).toHaveBeenLastCalledWith('problem-1', true));
  });
});

describe('ProblemIncidentLinksSection — same gating, plus its own status column', () => {
  beforeEach(() => {
    listIncidentLinksMock.mockReset();
    listIncidentOptionsMock.mockReset();
    linkToIncidentMock.mockReset();
    unlinkFromIncidentMock.mockReset();
    listIncidentOptionsMock.mockResolvedValue({ data: [], isPartial: false });
  });

  it('gates the incident picker behind "Vincular incidente"', async () => {
    listIncidentLinksMock.mockResolvedValue([incidentLinkFixture()]);
    render(<ProblemIncidentLinksSection problemId="problem-1" canLinkPermission />);

    await screen.findByText('Indisponibilidade do portal');
    expect(
      screen.queryByRole('combobox', { name: 'Selecionar incidente' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Vincular incidente' }));
    expect(screen.getByRole('combobox', { name: 'Selecionar incidente' })).toBeInTheDocument();
  });

  it("still renders the linked incident's own status badge alongside the gated picker", async () => {
    listIncidentLinksMock.mockResolvedValue([
      incidentLinkFixture({
        incident: {
          id: 'incident-1',
          code: 'INC-2026-0001',
          title: 'Indisponibilidade do portal',
          status: 'RESOLVED',
        },
      }),
    ]);
    render(<ProblemIncidentLinksSection problemId="problem-1" canLinkPermission />);

    await screen.findByText('Indisponibilidade do portal');
    expect(screen.getByText('Resolvido')).toBeInTheDocument();
  });
});
