import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ControlLinksSection } from './control-links-section';

import type { ControlProcessLink } from '../types';

const {
  listRiskLinksMock,
  listProcessLinksMock,
  listAssetLinksMock,
  listProcessesMock,
  listAssetsMock,
  linkProcessMock,
  unlinkProcessMock,
} = vi.hoisted(() => ({
  listRiskLinksMock: vi.fn(),
  listProcessLinksMock: vi.fn(),
  listAssetLinksMock: vi.fn(),
  listProcessesMock: vi.fn(),
  listAssetsMock: vi.fn(),
  linkProcessMock: vi.fn(),
  unlinkProcessMock: vi.fn(),
}));

vi.mock('../api', () => ({
  controlsApi: {
    listRiskLinks: listRiskLinksMock,
    listProcessLinks: listProcessLinksMock,
    listAssetLinks: listAssetLinksMock,
    listProcesses: listProcessesMock,
    listAssets: listAssetsMock,
    linkProcess: linkProcessMock,
    unlinkProcess: unlinkProcessMock,
    linkAsset: vi.fn(),
    unlinkAsset: vi.fn(),
  },
}));

const linkedBy = { id: 'user-1', fullName: 'Ana Souza' };

function processLinkFixture(overrides: Partial<ControlProcessLink> = {}): ControlProcessLink {
  return {
    id: 'link-1',
    process: { id: 'process-1', code: 'PRC-2026-0001', name: 'Concessão de acesso privilegiado' },
    linkedBy,
    linkedAt: '2026-01-05T00:00:00.000Z',
    unlinkedBy: null,
    unlinkedAt: null,
    ...overrides,
  };
}

describe('ControlLinksSection', () => {
  beforeEach(() => {
    listRiskLinksMock.mockReset();
    listProcessLinksMock.mockReset();
    listAssetLinksMock.mockReset();
    listProcessesMock.mockReset();
    listAssetsMock.mockReset();
    linkProcessMock.mockReset();
    unlinkProcessMock.mockReset();
    listRiskLinksMock.mockResolvedValue([]);
    listAssetLinksMock.mockResolvedValue([]);
    listProcessesMock.mockResolvedValue({ data: [], isPartial: false });
    listAssetsMock.mockResolvedValue({ data: [], isPartial: false });
  });

  it('shows the empty-state sentence with the intent trigger directly under it — never a silently open picker', async () => {
    listProcessLinksMock.mockResolvedValue([]);
    render(<ControlLinksSection controlId="control-1" canLinkRelationships />);

    expect(
      await screen.findByText('Nenhum processo vinculado a este controle.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vincular processo' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Selecionar processo' })).not.toBeInTheDocument();
  });

  it('keeps the picker behind a "Vincular processo" trigger once processes are already linked, and "Cancelar" discards the draft', async () => {
    listProcessLinksMock.mockResolvedValue([processLinkFixture()]);
    render(<ControlLinksSection controlId="control-1" canLinkRelationships />);

    await screen.findByText('Concessão de acesso privilegiado');
    expect(screen.queryByRole('combobox', { name: 'Selecionar processo' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Vincular processo' }));
    expect(screen.getByRole('combobox', { name: 'Selecionar processo' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('combobox', { name: 'Selecionar processo' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vincular processo' })).toBeInTheDocument();
    expect(linkProcessMock).not.toHaveBeenCalled();
  });

  it('never shows the intent trigger or the picker for a caller without link permission', async () => {
    listProcessLinksMock.mockResolvedValue([]);
    render(<ControlLinksSection controlId="control-1" canLinkRelationships={false} />);

    await screen.findByText('Nenhum processo vinculado a este controle.');
    expect(screen.queryByRole('button', { name: 'Vincular processo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Selecionar processo' })).not.toBeInTheDocument();
  });

  it('never offers a picker for Riscos — the link is owned and created only from the risk side (FR-021)', async () => {
    listProcessLinksMock.mockResolvedValue([]);
    render(<ControlLinksSection controlId="control-1" canLinkRelationships />);

    await screen.findByText('Nenhum risco vinculado a este controle.');
    expect(
      screen.getByText(
        'O vínculo entre risco e controle é criado e desfeito a partir do registro do risco.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Vincular risco/ })).not.toBeInTheDocument();
  });
});
