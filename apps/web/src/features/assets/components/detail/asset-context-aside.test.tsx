import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AssetContextAside } from './asset-context-aside';

import type { AssetDetail } from '../../types';

const baseAsset: AssetDetail = {
  id: 'asset-1',
  code: 'AST-2026-0001',
  name: 'Servidor de aplicação',
  descriptionExcerpt: null,
  description: null,
  orgUnit: { id: 'org-1', code: 'ROOT', name: 'PharosGRC' },
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-09-12T11:02:00.000Z',
  risks: [
    { id: 'risk-1', code: 'RSK-2026-0001', title: 'Falha no fornecedor crítico' },
    { id: 'risk-2', code: 'RSK-2026-0002', title: 'Outro risco' },
  ],
  controls: [],
};

describe('AssetContextAside', () => {
  it('never renders an "Ações rápidas" heading — Asset has no create/link verb to shortcut to', () => {
    render(<AssetContextAside asset={baseAsset} activeSectionId="overview" />);

    expect(screen.queryByRole('heading', { name: 'Ações rápidas' })).not.toBeInTheDocument();
  });

  it('shows a REAL count for Riscos and Controles — the honest asymmetry', () => {
    render(<AssetContextAside asset={baseAsset} activeSectionId="overview" />);

    expect(screen.getByRole('link', { name: 'Riscos (2)' })).toHaveAttribute(
      'href',
      '/assets/asset-1?section=risks',
    );
    expect(screen.getByRole('link', { name: 'Controles (0)' })).toHaveAttribute(
      'href',
      '/assets/asset-1?section=controls',
    );
  });

  it('shows "Ver" (never a count) for Incidentes — not embedded in AssetDetail', () => {
    render(<AssetContextAside asset={baseAsset} activeSectionId="overview" />);

    const link = screen.getByRole('link', { name: 'Incidentes Ver' });
    expect(link).toHaveAttribute('href', '/assets/asset-1?section=incidents');
    expect(link.textContent).not.toMatch(/\d/);
  });

  it('marks only the row matching activeSectionId as aria-current', () => {
    render(<AssetContextAside asset={baseAsset} activeSectionId="controls" />);

    expect(screen.getByRole('link', { name: 'Controles (0)' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.getByRole('link', { name: 'Riscos (2)' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Incidentes Ver' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('renders "Última atualização" formatted pt-BR, never "Invalid Date"', () => {
    render(<AssetContextAside asset={baseAsset} activeSectionId="overview" />);

    expect(screen.getByRole('heading', { name: 'Última atualização' })).toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();
  });
});
