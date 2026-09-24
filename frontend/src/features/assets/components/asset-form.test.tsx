import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { assets } from '@/lib/messages/assets';

import { AssetForm } from './asset-form';

import type { AssetDetail } from '../types';

const { pushMock, backMock, createAssetMock, updateAssetMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  backMock: vi.fn(),
  createAssetMock: vi.fn(),
  updateAssetMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, back: backMock }),
}));

vi.mock('../api', () => ({
  assetsApi: {
    createAsset: createAssetMock,
    updateAsset: updateAssetMock,
    listOrgUnits: vi.fn().mockResolvedValue([
      { id: 'org-1', code: 'ROOT', name: 'PharosGRC' },
      { id: 'org-2', code: 'FILIAL', name: 'Unidade Filial' },
    ]),
  },
}));

const baseAsset: AssetDetail = {
  id: 'asset-1',
  code: 'AST-2026-0001',
  name: 'Servidor de aplicação',
  descriptionExcerpt: 'Descrição original.',
  description: 'Descrição original.',
  orgUnit: { id: 'org-1', code: 'ROOT', name: 'PharosGRC' },
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  risks: [],
  controls: [],
};

describe('AssetForm', () => {
  beforeEach(() => {
    pushMock.mockReset();
    backMock.mockReset();
    createAssetMock.mockReset();
    updateAssetMock.mockReset();
  });

  it('requires name and org unit — description stays optional', async () => {
    render(<AssetForm mode="create" onSaved={vi.fn()} />);

    await waitFor(() => expect(screen.getByLabelText(/^Nome/)).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar ativo' }));

    expect(await screen.findByText(assets.form.validation.name.required)).toBeInTheDocument();
    expect(screen.getByText(assets.form.validation.orgUnit.required)).toBeInTheDocument();
    expect(createAssetMock).not.toHaveBeenCalled();
  });

  it('creates an asset without a description, never inventing one', async () => {
    createAssetMock.mockResolvedValueOnce({ ...baseAsset, id: 'asset-new', description: null });
    render(<AssetForm mode="create" onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText(/^Nome/)).not.toBeDisabled());

    fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: 'Novo ativo' } });
    fireEvent.click(screen.getByRole('combobox', { name: /Unidade organizacional/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'PharosGRC' }));

    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar ativo' }));

    await waitFor(() => expect(createAssetMock).toHaveBeenCalledTimes(1));
    expect(createAssetMock).toHaveBeenCalledWith({
      name: 'Novo ativo',
      description: undefined,
      orgUnitId: 'org-1',
    });
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/assets/asset-new'));
  });

  it('never sends an empty-string description on update — the server refuses it (MinLength(1))', async () => {
    updateAssetMock.mockResolvedValueOnce({ ...baseAsset, description: null });
    render(<AssetForm mode="edit" asset={baseAsset} onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText(/^Nome/)).not.toBeDisabled());

    fireEvent.change(screen.getByLabelText(/^Descrição/), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() =>
      expect(updateAssetMock).toHaveBeenCalledWith('asset-1', {
        name: baseAsset.name,
        description: undefined,
        orgUnitId: 'org-1',
      }),
    );
  });

  it('renders the org unit field as required with its own explanatory helper (invariant A1)', async () => {
    render(<AssetForm mode="create" onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText(/^Nome/)).not.toBeDisabled());

    expect(screen.getByText(assets.form.fields.orgUnit.helper)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Unidade organizacional/ })).toBeInTheDocument();
  });

  it('"Cancelar" calls navigate.back() when no onCancel is supplied — the default, unchanged for /assets/new', () => {
    render(<AssetForm mode="create" onSaved={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(backMock).toHaveBeenCalledTimes(1);
  });

  it('"Cancelar" calls the supplied onCancel instead of navigate.back() when one is provided', () => {
    const onCancel = vi.fn();
    render(<AssetForm mode="edit" asset={baseAsset} onSaved={vi.fn()} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(backMock).not.toHaveBeenCalled();
  });
});
