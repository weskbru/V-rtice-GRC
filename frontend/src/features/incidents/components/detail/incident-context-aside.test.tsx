import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { IncidentContextAside } from './incident-context-aside';

import type { IncidentDetail } from '../../types';

const baseIncident: IncidentDetail = {
  id: 'incident-1',
  code: 'INC-2026-0001',
  title: 'Indisponibilidade do portal',
  description: 'O portal ficou indisponível por 40 minutos.',
  severity: 'HIGH',
  status: 'OPEN',
  orgUnit: { id: 'org-1', code: 'ROOT', name: 'Vértice GRC' },
  owner: { id: 'user-1', fullName: 'Ana Souza' },
  reportedBy: { id: 'user-1', fullName: 'Ana Souza' },
  reportedOn: '2026-01-01',
};

describe('IncidentContextAside', () => {
  it('renders every enabled quick action as role="link" with a literal href, never a button', () => {
    render(
      <IncidentContextAside
        incident={baseIncident}
        activeSectionId="overview"
        canLink
        canCreateAction
        canCreateEvidence
        canComment
      />,
    );

    const linkRisk = screen.getByRole('link', { name: 'Vincular risco' });
    expect(linkRisk).toHaveAttribute('href', '/incidents/incident-1?section=risks');
    expect(screen.getByRole('link', { name: 'Vincular ativo' })).toHaveAttribute(
      'href',
      '/incidents/incident-1?section=assets',
    );
    expect(screen.getByRole('link', { name: 'Vincular processo' })).toHaveAttribute(
      'href',
      '/incidents/incident-1?section=processes',
    );
    expect(screen.getByRole('link', { name: 'Adicionar ação corretiva' })).toHaveAttribute(
      'href',
      '/incidents/incident-1?section=corrective-actions',
    );
    expect(screen.getByRole('link', { name: 'Adicionar evidência' })).toHaveAttribute(
      'href',
      '/incidents/incident-1?section=evidence',
    );
    expect(screen.getByRole('link', { name: 'Comentar' })).toHaveAttribute(
      'href',
      '/incidents/incident-1?section=comments',
    );

    for (const name of [
      'Vincular risco',
      'Vincular ativo',
      'Vincular processo',
      'Adicionar ação corretiva',
      'Adicionar evidência',
      'Comentar',
    ]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  it('omits every quick action the caller lacks permission for, and the whole block when none apply', () => {
    render(
      <IncidentContextAside
        incident={baseIncident}
        activeSectionId="overview"
        canLink={false}
        canCreateAction={false}
        canCreateEvidence={false}
        canComment={false}
      />,
    );

    expect(screen.queryByRole('heading', { name: 'Ações rápidas' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Vincular risco' })).not.toBeInTheDocument();
  });

  it('renders the four relationship rows with a "Ver" hint and no count of any kind', () => {
    render(
      <IncidentContextAside
        incident={baseIncident}
        activeSectionId="risks"
        canLink={false}
        canCreateAction={false}
        canCreateEvidence={false}
        canComment={false}
      />,
    );

    for (const label of ['Riscos', 'Ativos', 'Processos', 'Problemas']) {
      const link = screen.getByRole('link', { name: `${label} Ver` });
      expect(link).toHaveAttribute(
        'href',
        expect.stringContaining('/incidents/incident-1?section='),
      );
      expect(link.textContent).not.toMatch(/\d/);
    }

    expect(screen.getByRole('link', { name: 'Riscos Ver' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.getByRole('link', { name: 'Ativos Ver' })).not.toHaveAttribute('aria-current');
  });

  it('omits "Última atualização" entirely when updatedAt is absent — never "Invalid Date"', () => {
    render(
      <IncidentContextAside
        incident={baseIncident}
        activeSectionId="overview"
        canLink={false}
        canCreateAction={false}
        canCreateEvidence={false}
        canComment={false}
      />,
    );

    expect(screen.queryByRole('heading', { name: 'Última atualização' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();
  });

  it('renders "Última atualização" formatted pt-BR when updatedAt is present', () => {
    render(
      <IncidentContextAside
        incident={{ ...baseIncident, updatedAt: '2026-09-12T11:02:00.000Z' }}
        activeSectionId="overview"
        canLink={false}
        canCreateAction={false}
        canCreateEvidence={false}
        canComment={false}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Última atualização' })).toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();
  });
});
