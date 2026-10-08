import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProcessCard } from './process-card';

import type { ProcessSummary } from '../types';

const process: ProcessSummary = {
  id: 'process-1',
  code: 'PRC-2026-0001',
  name: 'Aprovação de pagamentos',
  descriptionExcerpt: 'Fluxo corporativo para pagamentos a fornecedores.',
  orgUnit: { id: 'org-1', code: 'ROOT', name: 'PharosGRC' },
  isActive: true,
  updatedAt: '2026-09-04T12:00:00.000Z',
};

describe('ProcessCard', () => {
  it('preserves the direct detail navigation and renders the existing description excerpt', () => {
    render(<ProcessCard process={process} />);

    expect(
      screen.getByRole('link', {
        name: 'Abrir processo PRC-2026-0001 — Aprovação de pagamentos',
      }),
    ).toHaveAttribute('href', '/processes/process-1');
    expect(
      screen.getByText('Fluxo corporativo para pagamentos a fornecedores.'),
    ).toBeInTheDocument();
  });

  it('uses the real situation as the card tone and omits an absent description', () => {
    const { container } = render(
      <ProcessCard process={{ ...process, isActive: false, descriptionExcerpt: null }} />,
    );

    expect(container.querySelector('article')).toHaveAttribute('data-tone', 'neutral');
    expect(
      screen.queryByText('Fluxo corporativo para pagamentos a fornecedores.'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Inativo')).toBeInTheDocument();
  });
});
