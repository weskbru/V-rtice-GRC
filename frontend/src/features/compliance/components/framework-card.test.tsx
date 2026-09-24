import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FrameworkCard } from './framework-card';

import type { Framework } from '../types';

const baseFramework: Framework = {
  id: 'framework-1',
  code: 'FRM-2026-0001',
  name: 'ISO/IEC 27001:2022',
  description: 'Norma internacional de gestão de segurança da informação.',
  origin: 'EXTERNAL_STANDARD',
  version: 1,
  createdAt: '2026-09-01T12:00:00.000Z',
  updatedAt: '2026-09-12T12:00:00.000Z',
};

describe('FrameworkCard', () => {
  it('uses the neutral register treatment because origin is not a lifecycle status', () => {
    const { container } = render(<FrameworkCard framework={baseFramework} />);

    expect(container.querySelector('article')).toHaveAttribute('data-tone', 'neutral');
  });

  it('renders the code as a link to the full record', () => {
    render(<FrameworkCard framework={baseFramework} />);

    const link = screen.getByRole('link', { name: 'FRM-2026-0001' });
    expect(link).toHaveAttribute('href', '/compliance/framework-1');
  });

  it('renders the description and the origin label — the two real fields this domain adds', () => {
    render(<FrameworkCard framework={baseFramework} />);

    expect(
      screen.getByText('Norma internacional de gestão de segurança da informação.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Norma externa')).toBeInTheDocument();
  });

  it('renders the internal-policy origin distinctly from the external-standard one', () => {
    const internal: Framework = { ...baseFramework, origin: 'INTERNAL_POLICY' };
    render(<FrameworkCard framework={internal} />);

    expect(screen.getByText('Política interna')).toBeInTheDocument();
    expect(screen.queryByText('Norma externa')).not.toBeInTheDocument();
  });

  it('renders the last update as a calendar date, never "Invalid Date"', () => {
    render(<FrameworkCard framework={baseFramework} />);

    expect(screen.getByText('Atualizado em 12/09/2026')).toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument();
  });

  it('the whole card opens the record, with the name as the accessible stretched-link name', () => {
    render(<FrameworkCard framework={baseFramework} />);

    const link = screen.getByRole('link', {
      name: 'Abrir o framework FRM-2026-0001: ISO/IEC 27001:2022',
    });
    expect(link).toHaveAttribute('href', '/compliance/framework-1');
  });

  it('never renders a status badge — Framework carries no lifecycle status of its own', () => {
    render(<FrameworkCard framework={baseFramework} />);

    expect(screen.queryByText('Rascunho')).not.toBeInTheDocument();
    expect(screen.queryByText('Publicada')).not.toBeInTheDocument();
  });
});
