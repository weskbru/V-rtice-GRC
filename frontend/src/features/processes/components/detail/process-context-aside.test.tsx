import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProcessContextAside } from './process-context-aside';

import type { ProcessDetail } from '../../types';

const baseProcess: ProcessDetail = {
  id: 'process-1',
  code: 'PRC-2026-0001',
  name: 'Processo de aprovação de fornecedores',
  descriptionExcerpt: null,
  description: null,
  orgUnit: { id: 'org-1', code: 'ROOT', name: 'Vértice GRC' },
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-09-12T11:02:00.000Z',
  risks: [
    { id: 'risk-1', code: 'RSK-2026-0001', title: 'Falha no fornecedor crítico' },
    { id: 'risk-2', code: 'RSK-2026-0002', title: 'Outro risco' },
  ],
  controls: [],
};

describe('ProcessContextAside', () => {
  it('never renders an "Ações rápidas" heading — Process has no create/link verb to shortcut to', () => {
    render(<ProcessContextAside process={baseProcess} activeSectionId="overview" />);

    expect(screen.queryByRole('heading', { name: 'Ações rápidas' })).not.toBeInTheDocument();
  });

  it('shows a REAL count for Riscos vinculados and Controles vinculados — the honest asymmetry', () => {
    render(<ProcessContextAside process={baseProcess} activeSectionId="overview" />);

    expect(screen.getByRole('link', { name: 'Riscos vinculados (2)' })).toHaveAttribute(
      'href',
      '/processes/process-1?section=risks',
    );
    expect(screen.getByRole('link', { name: 'Controles vinculados (0)' })).toHaveAttribute(
      'href',
      '/processes/process-1?section=controls',
    );
  });

  it('shows "Ver" (never a count) for Incidentes vinculados — not embedded in ProcessDetail', () => {
    render(<ProcessContextAside process={baseProcess} activeSectionId="overview" />);

    const link = screen.getByRole('link', { name: 'Incidentes vinculados Ver' });
    expect(link).toHaveAttribute('href', '/processes/process-1?section=incidents');
    expect(link.textContent).not.toMatch(/\d/);
  });

  it('marks only the row matching activeSectionId as aria-current', () => {
    render(<ProcessContextAside process={baseProcess} activeSectionId="controls" />);

    expect(screen.getByRole('link', { name: 'Controles vinculados (0)' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.getByRole('link', { name: 'Riscos vinculados (2)' })).not.toHaveAttribute(
      'aria-current',
    );
    expect(screen.getByRole('link', { name: 'Incidentes vinculados Ver' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('renders "Última atualização" formatted pt-BR, never "Invalid Date"', () => {
    render(<ProcessContextAside process={baseProcess} activeSectionId="overview" />);

    expect(screen.getByRole('heading', { name: 'Última atualização' })).toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();
  });
});
