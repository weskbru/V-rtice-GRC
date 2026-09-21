import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { IncidentLifecycleSection } from './incident-lifecycle-section';

import type { IncidentDetail } from '../../types';

/**
 * Component-mount evidence for the "Ciclo de vida" card
 * (018-incident-detail-experience, Fase 2+3). Two guarantees this suite
 * exists to prove:
 *
 *   1. The behaviour change this rodada makes deliberately: the card keeps
 *      rendering its read-only track EVEN when `IncidentLifecycleActions`
 *      itself renders nothing (`!canTransition` or a terminal status) — see
 *      this component's own header comment. Before this rodada, the whole
 *      card WAS `IncidentLifecycleActions`, so this exact scenario used to
 *      make the card disappear entirely.
 *   2. The conditional outcome facts (resolution summary, resolved/closed
 *      at/by, cancellation reason) render ONLY when the underlying value is
 *      actually present on the incident — never a "Não definido" for a
 *      fact that has not happened yet.
 */

vi.mock('../../api', () => ({
  incidentsApi: {
    transition: vi.fn(() => new Promise(() => undefined)),
  },
}));

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

describe('IncidentLifecycleSection', () => {
  it('keeps rendering the track and the "Ciclo de vida" title when the caller lacks incident:transition (no button row)', () => {
    render(
      <IncidentLifecycleSection
        incident={buildIncident({ status: 'OPEN' })}
        canTransition={false}
        onChanged={vi.fn()}
      />,
    );

    expect(screen.getByText('Ciclo de vida')).toBeInTheDocument();
    // The track's own node labels are still on screen — `getAllByText`
    // because the track renders twice in the DOM (once for the vertical,
    // below-`sm` layout, once for the horizontal, `sm`+ layout — C1 fix,
    // toggled with `hidden`/responsive `display`, the same dual-render
    // `DetailLayout` itself already documents), and jsdom applies no real
    // CSS layout to hide either copy from a query.
    expect(screen.getAllByText('Aberto').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Em andamento').length).toBeGreaterThan(0);
    // But no transition button — the row this component owns is gone.
    expect(screen.queryByRole('button', { name: 'Iniciar atendimento' })).not.toBeInTheDocument();
  });

  it('keeps rendering the track for a terminal (CLOSED) incident, even with permission — only the button row disappears', () => {
    render(
      <IncidentLifecycleSection
        incident={buildIncident({
          status: 'CLOSED',
          resolvedAt: '2026-01-02T10:00:00.000Z',
          closedAt: '2026-01-03T10:00:00.000Z',
        })}
        canTransition
        onChanged={vi.fn()}
      />,
    );

    expect(screen.getByText('Ciclo de vida')).toBeInTheDocument();
    expect(screen.getAllByText('Fechado').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders no outcome facts for a fresh OPEN incident — none of them have happened yet', () => {
    render(
      <IncidentLifecycleSection
        incident={buildIncident({ status: 'OPEN' })}
        canTransition
        onChanged={vi.fn()}
      />,
    );

    expect(screen.queryByText('Resumo da resolução')).not.toBeInTheDocument();
    expect(screen.queryByText('Resolvido em')).not.toBeInTheDocument();
    expect(screen.queryByText('Motivo do cancelamento')).not.toBeInTheDocument();
  });

  it('renders only the resolution outcome facts that are actually present, for a RESOLVED incident', () => {
    render(
      <IncidentLifecycleSection
        incident={buildIncident({
          status: 'RESOLVED',
          resolutionSummary: 'Serviço restabelecido após reinício do balanceador.',
          resolvedAt: '2026-01-02T10:00:00.000Z',
          resolvedBy: { id: 'user-2', fullName: 'Carla Dias' },
        })}
        canTransition
        onChanged={vi.fn()}
      />,
    );

    expect(screen.getByText('Resumo da resolução')).toBeInTheDocument();
    expect(
      screen.getByText('Serviço restabelecido após reinício do balanceador.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Resolvido em')).toBeInTheDocument();
    expect(screen.getByText('Resolvido por')).toBeInTheDocument();
    expect(screen.getByText('Carla Dias')).toBeInTheDocument();
    // Closure/cancellation facts do not exist yet for a merely-resolved incident.
    expect(screen.queryByText('Fechado em')).not.toBeInTheDocument();
    expect(screen.queryByText('Motivo do cancelamento')).not.toBeInTheDocument();
  });

  it('renders the cancellation reason for a CANCELLED incident, and nothing about resolution/closure', () => {
    render(
      <IncidentLifecycleSection
        incident={buildIncident({
          status: 'CANCELLED',
          cancellationReason: 'Falso alarme confirmado pelo time de plantão.',
        })}
        canTransition
        onChanged={vi.fn()}
      />,
    );

    expect(screen.getByText('Motivo do cancelamento')).toBeInTheDocument();
    expect(screen.getByText('Falso alarme confirmado pelo time de plantão.')).toBeInTheDocument();
    expect(screen.queryByText('Resumo da resolução')).not.toBeInTheDocument();
    expect(screen.queryByText('Fechado em')).not.toBeInTheDocument();
  });
});
