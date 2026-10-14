import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  ProcessLinkedControlsSection,
  ProcessLinkedRisksSection,
} from './process-linked-entities-section';

describe('ProcessLinkedRisksSection', () => {
  it('shows the empty message when no risk is linked', () => {
    render(<ProcessLinkedRisksSection risks={[]} />);
    expect(screen.getByText('Nenhum risco vinculado a este processo.')).toBeInTheDocument();
  });

  it('renders each linked risk as a link to its own detail page', () => {
    render(
      <ProcessLinkedRisksSection
        risks={[{ id: 'risk-1', code: 'RSK-2026-0001', title: 'Falha de energia' }]}
      />,
    );

    const link = screen.getByRole('link', { name: 'RSK-2026-0001' });
    expect(link).toHaveAttribute('href', '/risks/risk-1');
    expect(screen.getByText('Falha de energia')).toBeInTheDocument();
  });
});

describe('ProcessLinkedControlsSection', () => {
  it('shows the empty message when no control is linked', () => {
    render(<ProcessLinkedControlsSection controls={[]} />);
    expect(screen.getByText('Nenhum controle vinculado a este processo.')).toBeInTheDocument();
  });

  it('renders each linked control as a link to its own detail page', () => {
    render(
      <ProcessLinkedControlsSection
        controls={[{ id: 'control-1', code: 'CTL-2026-0001', name: 'Revisão de acessos' }]}
      />,
    );

    const link = screen.getByRole('link', { name: 'CTL-2026-0001' });
    expect(link).toHaveAttribute('href', '/controls/control-1');
    expect(screen.getByText('Revisão de acessos')).toBeInTheDocument();
  });
});
