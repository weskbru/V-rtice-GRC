import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RiskControlsSection } from './risk-controls-section';

import type { RiskControlLink, RiskDetail, RiskEntityLink } from '../types';

const {
  listControlsMock,
  listProcessesMock,
  listAssetsMock,
  linkControlMock,
  unlinkControlMock,
  linkProcessMock,
  unlinkProcessMock,
  linkAssetMock,
  unlinkAssetMock,
} = vi.hoisted(() => ({
  listControlsMock: vi.fn(),
  listProcessesMock: vi.fn(),
  listAssetsMock: vi.fn(),
  linkControlMock: vi.fn(),
  unlinkControlMock: vi.fn(),
  linkProcessMock: vi.fn(),
  unlinkProcessMock: vi.fn(),
  linkAssetMock: vi.fn(),
  unlinkAssetMock: vi.fn(),
}));

vi.mock('../api', () => ({
  risksApi: {
    listControls: listControlsMock,
    listProcesses: listProcessesMock,
    listAssets: listAssetsMock,
    linkControl: linkControlMock,
    unlinkControl: unlinkControlMock,
    linkProcess: linkProcessMock,
    unlinkProcess: unlinkProcessMock,
    linkAsset: linkAssetMock,
    unlinkAsset: unlinkAssetMock,
  },
}));

const baseRisk: RiskDetail = {
  id: 'risk-1',
  code: 'RSK-2026-0001',
  title: 'Falha no fornecedor crítico',
  descriptionExcerpt: 'Descrição.',
  description: 'Descrição.',
  status: 'IDENTIFIED',
  type: null,
  origin: null,
  orgUnit: { id: 'org-1', code: 'ROOT', name: 'PharosGRC' },
  owner: { id: 'user-1', fullName: 'Ana Souza' },
  overdueReview: false,
  overdueTreatment: false,
  pendingApproval: false,
  version: 1,
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

const linkedBy = { id: 'user-1', fullName: 'Ana Souza' };

function controlLinkFixture(overrides: Partial<RiskControlLink>): RiskControlLink {
  return {
    id: 'link-1',
    control: { id: 'control-1', code: 'CTL-001', name: 'Controle de acesso' },
    linkedBy,
    linkedAt: '2026-01-05T00:00:00.000Z',
    unlinkedBy: null,
    unlinkedAt: null,
    ...overrides,
  };
}

function entityLinkFixture(overrides: Partial<RiskEntityLink>): RiskEntityLink {
  return {
    id: 'link-2',
    entity: { id: 'process-1', code: 'PROC-001', name: 'Processo de pagamento' },
    linkedBy,
    linkedAt: '2026-01-05T00:00:00.000Z',
    unlinkedAt: null,
    ...overrides,
  };
}

describe('RiskControlsSection', () => {
  beforeEach(() => {
    listControlsMock.mockReset();
    listProcessesMock.mockReset();
    listAssetsMock.mockReset();
    linkControlMock.mockReset();
    unlinkControlMock.mockReset();
    linkProcessMock.mockReset();
    unlinkProcessMock.mockReset();
    linkAssetMock.mockReset();
    unlinkAssetMock.mockReset();
    listControlsMock.mockResolvedValue({ data: [], isPartial: false });
    listProcessesMock.mockResolvedValue({ data: [], isPartial: false });
    listAssetsMock.mockResolvedValue({ data: [], isPartial: false });
  });

  it('shows the honest empty state for all three relationship kinds', () => {
    render(
      <RiskControlsSection
        risk={baseRisk}
        etag='"1"'
        canTreatControls={false}
        canEditRelationships={false}
        onChanged={() => undefined}
      />,
    );

    expect(screen.getByText('Nenhum controle vinculado a este risco.')).toBeInTheDocument();
    expect(screen.getByText('Nenhum processo vinculado a este risco.')).toBeInTheDocument();
    expect(screen.getByText('Nenhum ativo vinculado a este risco.')).toBeInTheDocument();
  });

  it('lists a currently linked control with who linked it and when', () => {
    const risk: RiskDetail = { ...baseRisk, controls: [controlLinkFixture({})] };
    render(
      <RiskControlsSection
        risk={risk}
        etag='"1"'
        canTreatControls={false}
        canEditRelationships={false}
        onChanged={() => undefined}
      />,
    );

    expect(screen.getByText('Controle de acesso')).toBeInTheDocument();
    expect(screen.getByText('CTL-001')).toBeInTheDocument();
  });

  it('hides the link/unlink controls for controls when the caller lacks risk:treat, even though processes/assets use risk:edit instead', () => {
    const risk: RiskDetail = { ...baseRisk, controls: [controlLinkFixture({})] };
    render(
      <RiskControlsSection
        risk={risk}
        etag='"1"'
        canTreatControls={false}
        canEditRelationships
        onChanged={() => undefined}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Desvincular' })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Selecionar processo' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Selecionar ativo' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Selecionar controle' })).not.toBeInTheDocument();
  });

  it('links a control and calls onChanged so the caller re-reads the whole risk', async () => {
    listControlsMock.mockResolvedValue({
      data: [
        {
          id: 'control-1',
          code: 'CTL-001',
          name: 'Controle de acesso',
          description: null,
          orgUnitId: null,
          isActive: true,
        },
      ],
      isPartial: false,
    });
    linkControlMock.mockResolvedValue({ link: controlLinkFixture({}), etag: '"2"' });
    const onChanged = vi.fn();

    render(
      <RiskControlsSection
        risk={baseRisk}
        etag='"1"'
        canTreatControls
        canEditRelationships={false}
        onChanged={onChanged}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Vincular controle' }));

    fireEvent.click(screen.getByRole('combobox', { name: 'Selecionar controle' }));
    fireEvent.change(screen.getByPlaceholderText('Buscar controle por nome ou código'), {
      target: { value: 'acesso' },
    });
    fireEvent.click(await screen.findByRole('option', { name: /Controle de acesso/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Vincular controle' }));

    await waitFor(() =>
      expect(linkControlMock).toHaveBeenCalledWith('risk-1', { id: 'control-1' }, '"1"'),
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  });

  it('asks for confirmation before unlinking, and states the link is retained in history, not erased (FR-076, FR-102)', async () => {
    const risk: RiskDetail = { ...baseRisk, controls: [controlLinkFixture({})] };
    render(
      <RiskControlsSection
        risk={risk}
        etag='"1"'
        canTreatControls
        canEditRelationships={false}
        onChanged={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Desvincular' }));

    expect(await screen.findByText('Desvincular controle?')).toBeInTheDocument();
    expect(
      screen.getByText(/O vínculo não é apagado: ele continua registrado no histórico/),
    ).toBeInTheDocument();
    expect(unlinkControlMock).not.toHaveBeenCalled();
  });

  it('unlinks a process after confirmation', async () => {
    const risk: RiskDetail = { ...baseRisk, processes: [entityLinkFixture({})] };
    unlinkProcessMock.mockResolvedValue({ etag: '"2"' });
    const onChanged = vi.fn();

    render(
      <RiskControlsSection
        risk={risk}
        etag='"1"'
        canTreatControls={false}
        canEditRelationships
        onChanged={onChanged}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Desvincular' }));
    await screen.findByText('Desvincular processo?');
    fireEvent.click(screen.getByRole('button', { name: 'Desvincular' }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  });

  it('renders only the requested families, same endpoints and permissions either way', () => {
    const risk: RiskDetail = {
      ...baseRisk,
      controls: [controlLinkFixture({})],
      processes: [entityLinkFixture({})],
    };
    render(
      <RiskControlsSection
        risk={risk}
        etag='"1"'
        canTreatControls
        canEditRelationships
        onChanged={() => undefined}
        families={['controls']}
      />,
    );

    expect(screen.getByText('Controle de acesso')).toBeInTheDocument();
    expect(screen.queryByText('Processo de pagamento')).not.toBeInTheDocument();
    expect(screen.queryByText('Nenhum ativo vinculado a este risco.')).not.toBeInTheDocument();
  });

  it('keeps the picker behind a "Vincular controle" trigger even once controls are already linked, and cancel discards the draft', () => {
    const risk: RiskDetail = { ...baseRisk, controls: [controlLinkFixture({})] };
    render(
      <RiskControlsSection
        risk={risk}
        etag='"1"'
        canTreatControls
        canEditRelationships={false}
        onChanged={() => undefined}
      />,
    );

    expect(screen.queryByRole('combobox', { name: 'Selecionar controle' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Vincular controle' }));
    expect(screen.getByRole('combobox', { name: 'Selecionar controle' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(linkControlMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('combobox', { name: 'Selecionar controle' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vincular controle' })).toBeInTheDocument();
  });

  it('does NOT gate Processos/Ativos behind an action — their picker stays immediately visible', () => {
    render(
      <RiskControlsSection
        risk={baseRisk}
        etag='"1"'
        canTreatControls={false}
        canEditRelationships
        onChanged={() => undefined}
      />,
    );

    expect(screen.getByRole('combobox', { name: 'Selecionar processo' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Selecionar ativo' })).toBeInTheDocument();
  });
});
