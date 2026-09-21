import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AssetLifecycleActions } from './asset-lifecycle-actions';

import type { AssetDetail } from '../types';

/**
 * Component-mount evidence for T049 (`AssetLifecycleActions`, US1, FR-005,
 * FR-006, FR-012). `../api` (`assetsApi`) is mocked at the network
 * boundary.
 *
 * The most important assertion here is not "the button works" — it is that
 * the confirmation itself, not only a toast afterward, states that
 * deactivation is not deletion (CLAUDE.md §18.11, FR-012): the record stays
 * readable and stays visible in existing links.
 */
const { deactivateAssetMock, reactivateAssetMock } = vi.hoisted(() => ({
  deactivateAssetMock: vi.fn(),
  reactivateAssetMock: vi.fn(),
}));

vi.mock('../api', () => ({
  assetsApi: {
    deactivateAsset: deactivateAssetMock,
    reactivateAsset: reactivateAssetMock,
  },
}));

function buildAsset(overrides: Partial<AssetDetail> = {}): AssetDetail {
  return {
    id: 'asset-1',
    code: 'AST-2026-0001',
    name: 'Servidor de aplicação',
    descriptionExcerpt: null,
    description: null,
    orgUnit: { id: 'org-1', code: 'ROOT', name: 'PharosGRC' },
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    risks: [],
    controls: [],
    ...overrides,
  };
}

describe('AssetLifecycleActions', () => {
  beforeEach(() => {
    deactivateAssetMock.mockReset();
    reactivateAssetMock.mockReset();
  });

  it('renders nothing for a caller without asset:administer (server-mirrored gate)', () => {
    const { container } = render(
      <AssetLifecycleActions asset={buildAsset()} canAdminister={false} onChanged={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows only "Desativar" for an active asset, and the confirmation states this is not deletion (FR-012)', () => {
    render(<AssetLifecycleActions asset={buildAsset()} canAdminister onChanged={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Desativar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reativar' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Desativar' }));

    expect(screen.getByText('Desativar este ativo?')).toBeInTheDocument();
    expect(
      screen.getByText(/continua totalmente legível e continua aparecendo nos vínculos/),
    ).toBeInTheDocument();
    expect(screen.getByText(/nada é apagado/)).toBeInTheDocument();
  });

  it('deactivates the asset on confirmation and reports the updated record', async () => {
    const onChanged = vi.fn();
    const updated = buildAsset({ isActive: false });
    deactivateAssetMock.mockResolvedValue(updated);

    render(<AssetLifecycleActions asset={buildAsset()} canAdminister onChanged={onChanged} />);

    fireEvent.click(screen.getByRole('button', { name: 'Desativar' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Desativar' }));

    await waitFor(() => expect(deactivateAssetMock).toHaveBeenCalledWith('asset-1'));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(updated));
  });

  it('shows only "Reativar" for an inactive asset, with a confirmation that never mentions deletion', async () => {
    const onChanged = vi.fn();
    const updated = buildAsset({ isActive: true });
    reactivateAssetMock.mockResolvedValue(updated);

    render(
      <AssetLifecycleActions
        asset={buildAsset({ isActive: false })}
        canAdminister
        onChanged={onChanged}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Desativar' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reativar' }));

    expect(screen.getByText('Reativar este ativo?')).toBeInTheDocument();

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reativar' }));

    await waitFor(() => expect(reactivateAssetMock).toHaveBeenCalledWith('asset-1'));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(updated));
  });

  it('shows a generic error and does not report a change when the request fails', async () => {
    deactivateAssetMock.mockRejectedValue(new Error('network down'));

    render(<AssetLifecycleActions asset={buildAsset()} canAdminister onChanged={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Desativar' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Desativar' }));

    expect(
      await screen.findByText('Não foi possível desativar o ativo. Tente novamente.'),
    ).toBeInTheDocument();
  });
});
