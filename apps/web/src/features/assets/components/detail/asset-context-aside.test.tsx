import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AssetContextAside } from './asset-context-aside';

import type { AssetDetail } from '../../types';

/**
 * Component-mount evidence for the contextual aside
 * (022-asset-detail-experience, Fase C). Rendered at the default (wide,
 * jsdom `matchMedia` stub) viewport, so every block is the plain,
 * always-expanded `<section>` — mirrors `control-context-aside.test.tsx`'s
 * own convention for not duplicating narrow-mode coverage here.
 *
 * Central assertions this suite exists to prove:
 *
 *   - no "Ações rápidas" heading EVER renders — `Asset`'s three
 *     relationship tabs are read-only by design, so this aside never builds
 *     a quick-action candidate list at all (this file's own header
 *     comment);
 *   - "Riscos"/"Controles" carry a REAL count (`AssetDetail.risks`/
 *     `.controls` arrive already embedded) — the "assimetria honesta" the
 *     coordinator asked for;
 *   - "Incidentes" carries a "Ver" hint and NO count, since it is not
 *     embedded in `AssetDetail` at all;
 *   - `aria-current` tracks `activeSectionId` for whichever of the three
 *     rows matches it.
 */

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

    // Accessible name concatenates label + hint with an explicit space —
    // mirrors `ControlContextAside`'s/`RiskRelationshipsAside`'s own fix
    // for the same JSX-whitespace defect class.
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
    // No exact-string assertion on the formatted timestamp — mirrors
    // `control-context-aside.test.tsx`'s own restraint: the LOCAL timezone
    // of whatever machine runs this suite is not this test's business, only
    // that the date renders validly.
    render(<AssetContextAside asset={baseAsset} activeSectionId="overview" />);

    expect(screen.getByRole('heading', { name: 'Última atualização' })).toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();
  });
});
