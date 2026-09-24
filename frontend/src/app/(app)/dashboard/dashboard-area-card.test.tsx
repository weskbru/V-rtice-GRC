import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DashboardAreaCard } from './dashboard-area-card';

describe('DashboardAreaCard', () => {
  it('renders the server-supplied label and the "Planejado" badge, with no numeric value anywhere', () => {
    render(<DashboardAreaCard label="Gestão de Problemas" />);

    expect(screen.getByText('Gestão de Problemas')).toBeInTheDocument();
    expect(screen.getByText('Planejado')).toBeInTheDocument();
    expect(
      screen.getByText('Módulo planejado — ainda não implementado nesta versão.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument();
  });
});
