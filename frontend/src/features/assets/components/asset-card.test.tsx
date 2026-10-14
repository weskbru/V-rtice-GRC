import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AssetCard } from './asset-card';

import type { AssetSummary } from '../types';

const asset: AssetSummary = {
  id: 'asset-1',
  code: 'AST-2026-0001',
  name: 'Servidor de aplicação',
  descriptionExcerpt: 'Hospeda serviços corporativos críticos.',
  orgUnit: { id: 'org-1', code: 'ROOT', name: 'Vértice GRC' },
  isActive: true,
  updatedAt: '2026-09-04T12:00:00.000Z',
};

describe('AssetCard', () => {
  it('preserves the direct detail navigation and renders the existing description excerpt', () => {
    render(<AssetCard asset={asset} />);

    expect(
      screen.getByRole('link', { name: 'Abrir ativo AST-2026-0001 — Servidor de aplicação' }),
    ).toHaveAttribute('href', '/assets/asset-1');
    expect(screen.getByText('Hospeda serviços corporativos críticos.')).toBeInTheDocument();
  });

  it('uses the real situation as the card tone and omits an absent description', () => {
    const { container } = render(
      <AssetCard asset={{ ...asset, isActive: false, descriptionExcerpt: null }} />,
    );

    expect(container.querySelector('article')).toHaveAttribute('data-tone', 'neutral');
    expect(screen.queryByText('Hospeda serviços corporativos críticos.')).not.toBeInTheDocument();
    expect(screen.getByText('Inativo')).toBeInTheDocument();
  });
});
