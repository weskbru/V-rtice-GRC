import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AssetEditPanel } from './asset-edit-panel';

import type { AssetDetail } from '../../types';
import type { AssetFormProps } from '../asset-form';

vi.mock('../asset-form', () => ({
  AssetForm: (props: AssetFormProps) => (
    <div data-testid="asset-form-mock">
      <span>mode:{props.mode}</span>
      <span>assetId:{props.asset?.id}</span>
      <button type="button" onClick={() => props.onSaved(props.asset!)}>
        Simular salvar
      </button>
      <button type="button" onClick={() => props.onCancel?.()}>
        Simular cancelar
      </button>
    </div>
  ),
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

describe('AssetEditPanel', () => {
  it('renders the overlay header (title) and AssetForm in mode="edit" for this asset', () => {
    render(<AssetEditPanel asset={baseAsset} onOpenChange={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByText('Editar ativo').length).toBeGreaterThan(0);
    expect(screen.getByText('mode:edit')).toBeInTheDocument();
    expect(screen.getByText('assetId:asset-1')).toBeInTheDocument();
  });

  it('forwards AssetForm.onSaved straight through to its own onSaved prop', () => {
    const onSaved = vi.fn();
    render(<AssetEditPanel asset={baseAsset} onOpenChange={vi.fn()} onSaved={onSaved} />);

    fireEvent.click(screen.getByRole('button', { name: 'Simular salvar' }));
    expect(onSaved).toHaveBeenCalledWith(baseAsset);
  });

  it('calls onOpenChange(false) when the sheet is dismissed', () => {
    const onOpenChange = vi.fn();
    render(<AssetEditPanel asset={baseAsset} onOpenChange={onOpenChange} onSaved={vi.fn()} />);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('wires AssetForm.onCancel to the same onOpenChange(false) the Sheet’s own Escape/backdrop use', () => {
    const onOpenChange = vi.fn();
    render(<AssetEditPanel asset={baseAsset} onOpenChange={onOpenChange} onSaved={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Simular cancelar' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
