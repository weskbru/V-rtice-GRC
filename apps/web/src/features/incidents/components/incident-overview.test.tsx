import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { IncidentOverview } from './incident-overview';

import type { IncidentDetail } from '../types';

/**
 * Component-mount evidence for the "Visão geral" section's first two cards
 * (018-incident-detail-experience, Fase 2+3 — replaces the flat, card-less
 * `<dl>` this component used to be). Two things this suite exists to prove:
 *
 *   - "Descrição" and "Detalhes do incidente" both render as real cards
 *     with real headings, each of the six attributes anchored by its own
 *     icon-carrying `DetailField`;
 *   - "Registrado em" (`createdAt`) renders ONLY when the fact is present —
 *     the SAME conditional discipline the original flat `<dl>` already
 *     had, now inside the "Detalhes do incidente" card instead of a
 *     separate, un-carded block.
 *
 * The lifecycle outcome facts (resolution/closure/cancellation) are NOT
 * this component's concern any more — `incident-lifecycle-section.test.tsx`
 * covers those.
 */

function buildIncident(overrides: Partial<IncidentDetail> = {}): IncidentDetail {
  return {
    id: 'incident-1',
    code: 'INC-2026-0001',
    title: 'Indisponibilidade do portal',
    description: 'O portal ficou indisponível por 40 minutos.',
    severity: 'HIGH',
    status: 'OPEN',
    orgUnit: { id: 'org-1', code: 'ROOT', name: 'PharosGRC' },
    owner: { id: 'user-1', fullName: 'Ana Souza' },
    reportedBy: { id: 'user-1', fullName: 'Ana Souza' },
    reportedOn: '2026-01-01',
    ...overrides,
  };
}

describe('IncidentOverview', () => {
  it('renders the Descrição and Detalhes do incidente cards, with all six attributes', () => {
    render(
      <IncidentOverview incident={buildIncident({ createdAt: '2026-01-01T08:00:00.000Z' })} />,
    );

    expect(screen.getByText('Descrição')).toBeInTheDocument();
    expect(screen.getByText('O portal ficou indisponível por 40 minutos.')).toBeInTheDocument();

    expect(screen.getByText('Detalhes do incidente')).toBeInTheDocument();
    expect(screen.getByText('Severidade')).toBeInTheDocument();
    expect(screen.getByText('Alta')).toBeInTheDocument();
    expect(screen.getByText('Unidade organizacional')).toBeInTheDocument();
    expect(screen.getByText('PharosGRC')).toBeInTheDocument();
    expect(screen.getByText('Responsável')).toBeInTheDocument();
    expect(screen.getAllByText('Ana Souza').length).toBeGreaterThan(0);
    expect(screen.getByText('Reportado em')).toBeInTheDocument();
    expect(screen.getByText('Reportado por')).toBeInTheDocument();
  });

  it('renders "Registrado em" only when createdAt is present', () => {
    const { rerender } = render(
      <IncidentOverview incident={buildIncident({ createdAt: undefined })} />,
    );
    expect(screen.queryByText('Registrado em')).not.toBeInTheDocument();

    rerender(
      <IncidentOverview incident={buildIncident({ createdAt: '2026-01-01T08:00:00.000Z' })} />,
    );
    expect(screen.getByText('Registrado em')).toBeInTheDocument();
  });

  it('never renders the resolution/closure/cancellation outcome facts — those moved to Ciclo de vida', () => {
    render(
      <IncidentOverview
        incident={buildIncident({
          status: 'RESOLVED',
          resolutionSummary: 'Resolvido.',
          resolvedAt: '2026-01-02T10:00:00.000Z',
        })}
      />,
    );

    expect(screen.queryByText('Resumo da resolução')).not.toBeInTheDocument();
    expect(screen.queryByText('Resolvido em')).not.toBeInTheDocument();
  });
});
