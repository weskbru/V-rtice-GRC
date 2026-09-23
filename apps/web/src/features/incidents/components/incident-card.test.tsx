import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { IncidentCard } from './incident-card';

import type { IncidentSummary } from '../types';

const baseIncident: IncidentSummary = {
  id: 'incident-1',
  code: 'INC-2026-0001',
  title: 'Indisponibilidade do portal de clientes',
  severity: 'HIGH',
  status: 'IN_PROGRESS',
  orgUnit: { id: 'org-1', code: 'ROOT', name: 'PharosGRC' },
  owner: { id: 'user-1', fullName: 'Ana Souza' },
  reportedOn: '2026-09-10',
  updatedAt: '2026-09-12T12:00:00.000Z',
};

describe('IncidentCard', () => {
  it('renders the code as a link to the full record', () => {
    render(<IncidentCard incident={baseIncident} />);

    const link = screen.getByRole('link', { name: 'INC-2026-0001' });
    expect(link).toHaveAttribute('href', '/incidents/incident-1');
  });

  it('renders severity and status each with a real pt-BR word — never colour alone', () => {
    render(<IncidentCard incident={baseIncident} />);

    expect(screen.getByText('Alta')).toBeInTheDocument();
    expect(screen.getByText('Em andamento')).toBeInTheDocument();
  });

  it('renders the organizational unit, the responsible and the reported date', () => {
    render(<IncidentCard incident={baseIncident} />);

    expect(screen.getByText('PharosGRC')).toBeInTheDocument();
    expect(screen.getByText('Ana Souza')).toBeInTheDocument();
    expect(screen.getByText('10/09/2026')).toBeInTheDocument();
  });

  it('renders the last update as a calendar date, never "Invalid Date"', () => {
    render(<IncidentCard incident={baseIncident} />);

    expect(screen.getByText('Atualizado em 12/09/2026')).toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument();
  });

  it('renders a quiet placeholder, never "Invalid Date" or a blank line, when updatedAt is absent', () => {
    const undated: IncidentSummary = { ...baseIncident, updatedAt: undefined };
    render(<IncidentCard incident={undated} />);

    expect(screen.getByText('Data de atualização não disponível')).toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument();
  });

  it('the whole card opens the record, with the title as the accessible stretched-link name', () => {
    render(<IncidentCard incident={baseIncident} />);

    const links = screen.getAllByRole('link', {
      name: 'Abrir o incidente INC-2026-0001: Indisponibilidade do portal de clientes',
    });
    expect(links[0]).toHaveAttribute('href', '/incidents/incident-1');
  });
});
