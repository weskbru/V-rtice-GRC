import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  IncidentAssetRelationshipsSection,
  IncidentProcessRelationshipsSection,
  IncidentRiskRelationshipsSection,
} from './incident-relationships-section';

import type {
  IncidentAssetLinkResponse,
  IncidentProcessLinkResponse,
  IncidentRiskLinkResponse,
} from '../types';

const { listRiskLinksMock, listRiskOptionsMock, linkRiskMock, unlinkRiskMock } = vi.hoisted(() => ({
  listRiskLinksMock: vi.fn(),
  listRiskOptionsMock: vi.fn(),
  linkRiskMock: vi.fn(),
  unlinkRiskMock: vi.fn(),
}));

const { listAssetLinksMock, listAssetOptionsMock } = vi.hoisted(() => ({
  listAssetLinksMock: vi.fn(),
  listAssetOptionsMock: vi.fn(),
}));

const { listProcessLinksMock, listProcessOptionsMock } = vi.hoisted(() => ({
  listProcessLinksMock: vi.fn(),
  listProcessOptionsMock: vi.fn(),
}));

vi.mock('../api', () => ({
  incidentsApi: {
    listRiskLinks: listRiskLinksMock,
    listRiskOptions: listRiskOptionsMock,
    linkRisk: linkRiskMock,
    unlinkRisk: unlinkRiskMock,
    listAssetLinks: listAssetLinksMock,
    listAssetOptions: listAssetOptionsMock,
    linkAsset: vi.fn(),
    unlinkAsset: vi.fn(),
    listProcessLinks: listProcessLinksMock,
    listProcessOptions: listProcessOptionsMock,
    linkProcess: vi.fn(),
    unlinkProcess: vi.fn(),
  },
}));

const linkedBy = { id: 'user-1', fullName: 'Ana Souza' };

function riskLinkFixture(
  overrides: Partial<IncidentRiskLinkResponse> = {},
): IncidentRiskLinkResponse {
  return {
    id: 'link-1',
    risk: { id: 'risk-1', code: 'RSK-2026-0001', title: 'Falha no fornecedor crítico' },
    linkedBy,
    linkedAt: '2026-01-05T00:00:00.000Z',
    unlinkedAt: null,
    ...overrides,
  };
}

describe('IncidentRiskRelationshipsSection (representative of the three gated families)', () => {
  beforeEach(() => {
    listRiskLinksMock.mockReset();
    listRiskOptionsMock.mockReset();
    linkRiskMock.mockReset();
    unlinkRiskMock.mockReset();
    listRiskOptionsMock.mockResolvedValue({ data: [], isPartial: false });
  });

  it('shows the empty-state sentence with the intent trigger directly under it — never a silently open picker', async () => {
    listRiskLinksMock.mockResolvedValue([]);
    render(<IncidentRiskRelationshipsSection incidentId="incident-1" canLink />);

    expect(await screen.findByText('Nenhum risco vinculado a este incidente.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vincular risco' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Selecionar risco' })).not.toBeInTheDocument();
  });

  it('keeps the picker behind a "Vincular risco" trigger once risks are already linked, and "Cancelar" discards the draft', async () => {
    listRiskLinksMock.mockResolvedValue([riskLinkFixture()]);
    render(<IncidentRiskRelationshipsSection incidentId="incident-1" canLink />);

    await screen.findByText('Falha no fornecedor crítico');
    expect(screen.queryByRole('combobox', { name: 'Selecionar risco' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Vincular risco' }));
    expect(screen.getByRole('combobox', { name: 'Selecionar risco' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('combobox', { name: 'Selecionar risco' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vincular risco' })).toBeInTheDocument();
  });

  it('never shows the intent trigger or the picker for a caller without incident:link', async () => {
    listRiskLinksMock.mockResolvedValue([]);
    render(<IncidentRiskRelationshipsSection incidentId="incident-1" canLink={false} />);

    await screen.findByText('Nenhum risco vinculado a este incidente.');
    expect(screen.queryByRole('button', { name: 'Vincular risco' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Selecionar risco' })).not.toBeInTheDocument();
  });

  it('keeps "Mostrar vínculos desfeitos" reachable in the header at all times, including while the picker is open', async () => {
    listRiskLinksMock.mockResolvedValue([riskLinkFixture()]);
    render(<IncidentRiskRelationshipsSection incidentId="incident-1" canLink />);

    await screen.findByText('Falha no fornecedor crítico');
    const checkbox = screen.getByRole('checkbox', { name: 'Mostrar vínculos desfeitos' });
    expect(checkbox).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Vincular risco' }));
    expect(
      screen.getByRole('checkbox', { name: 'Mostrar vínculos desfeitos' }),
    ).toBeInTheDocument();

    fireEvent.click(checkbox);
    await waitFor(() => expect(listRiskLinksMock).toHaveBeenLastCalledWith('incident-1', true));
  });
});

describe('IncidentAssetRelationshipsSection / IncidentProcessRelationshipsSection — same gating', () => {
  beforeEach(() => {
    listAssetLinksMock.mockReset();
    listAssetOptionsMock.mockReset();
    listProcessLinksMock.mockReset();
    listProcessOptionsMock.mockReset();
    listAssetOptionsMock.mockResolvedValue({ data: [], isPartial: false });
    listProcessOptionsMock.mockResolvedValue({ data: [], isPartial: false });
  });

  it('gates the asset picker behind "Vincular ativo"', async () => {
    const assetLink: IncidentAssetLinkResponse = {
      id: 'link-a1',
      asset: { id: 'asset-1', code: 'AST-001', name: 'Servidor de aplicação' },
      linkedBy,
      linkedAt: '2026-01-05T00:00:00.000Z',
      unlinkedAt: null,
    };
    listAssetLinksMock.mockResolvedValue([assetLink]);
    render(<IncidentAssetRelationshipsSection incidentId="incident-1" canLink />);

    await screen.findByText('Servidor de aplicação');
    expect(screen.queryByRole('combobox', { name: 'Selecionar ativo' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Vincular ativo' }));
    expect(screen.getByRole('combobox', { name: 'Selecionar ativo' })).toBeInTheDocument();
  });

  it('gates the process picker behind "Vincular processo"', async () => {
    const processLink: IncidentProcessLinkResponse = {
      id: 'link-p1',
      process: { id: 'process-1', code: 'PROC-001', name: 'Processo de pagamento' },
      linkedBy,
      linkedAt: '2026-01-05T00:00:00.000Z',
      unlinkedAt: null,
    };
    listProcessLinksMock.mockResolvedValue([processLink]);
    render(<IncidentProcessRelationshipsSection incidentId="incident-1" canLink />);

    await screen.findByText('Processo de pagamento');
    expect(screen.queryByRole('combobox', { name: 'Selecionar processo' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Vincular processo' }));
    expect(screen.getByRole('combobox', { name: 'Selecionar processo' })).toBeInTheDocument();
  });
});
