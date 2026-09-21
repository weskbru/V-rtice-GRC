import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DashboardAreaCard } from './dashboard-area-card';

/** Component-mount evidence for T199 (FR-050, SC-013) — a planned card must be unmistakable, never confused with a real zero. */
describe('DashboardAreaCard', () => {
  it('renders the server-supplied label and the "Planejado" badge, with no numeric value anywhere', () => {
    render(<DashboardAreaCard label="Gestão de Problemas" />);

    expect(screen.getByText('Gestão de Problemas')).toBeInTheDocument();
    expect(screen.getByText('Planejado')).toBeInTheDocument();
    expect(
      screen.getByText('Módulo planejado — ainda não implementado nesta versão.'),
    ).toBeInTheDocument();
    // No digit anywhere on a planned card — it must never be mistaken for a zero.
    expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument();
  });
});
