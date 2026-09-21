import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { IncidentLifecycleActions } from './incident-lifecycle-actions';

import type { IncidentDetail } from '../types';

/**
 * Component-mount evidence for `IncidentLifecycleActions` (008-incidents-
 * problems, US1). `../api` is mocked at the network boundary.
 *
 * The central assertion here is the coordinator's own non-negotiable: an
 * illegal transition is never rendered as a disabled/refused button — it is
 * simply absent. A `CLOSED`/`CANCELLED` incident therefore renders nothing
 * from THIS component, and every other status renders EXACTLY the buttons
 * `availableIncidentTransitions` names, never more, never fewer.
 *
 * ## Scope of "renders nothing" (018-incident-detail-experience, Fase 2+3)
 *
 * This component is mounted here in isolation, exactly as it always was —
 * `toBeEmptyDOMElement()` below is true because THIS component still
 * returns `null` under the same two conditions it always has
 * (`!canTransition || options.length === 0`), not because a surrounding
 * card disappears. Since this rodada, the caller
 * (`incident-lifecycle-section.tsx`) embeds this component inside a
 * persistent "Ciclo de vida" card that keeps rendering the read-only track
 * regardless of what this component returns — that composition is this
 * suite's caller's concern, not this one's. The guarantee this file proves
 * is narrower and unchanged: no illegal transition is ever offered, and a
 * caller without `incident:transition` sees no button at all.
 */
const { transitionMock } = vi.hoisted(() => ({
  transitionMock: vi.fn(),
}));

vi.mock('../api', () => ({
  incidentsApi: {
    transition: transitionMock,
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

describe('IncidentLifecycleActions', () => {
  beforeEach(() => {
    transitionMock.mockReset();
  });

  it('renders nothing for a caller without incident:transition (server-mirrored gate)', () => {
    const { container } = render(
      <IncidentLifecycleActions
        incident={buildIncident()}
        canTransition={false}
        onChanged={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for a terminal incident (CLOSED) even with permission', () => {
    const { container } = render(
      <IncidentLifecycleActions
        incident={buildIncident({ status: 'CLOSED' })}
        canTransition
        onChanged={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for a terminal incident (CANCELLED) even with permission', () => {
    const { container } = render(
      <IncidentLifecycleActions
        incident={buildIncident({ status: 'CANCELLED' })}
        canTransition
        onChanged={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('an OPEN incident offers exactly "Iniciar atendimento" and "Cancelar incidente" — never "Resolver"/"Fechar"/"Reabrir"', () => {
    render(
      <IncidentLifecycleActions
        incident={buildIncident({ status: 'OPEN' })}
        canTransition
        onChanged={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Iniciar atendimento' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar incidente' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resolver' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Fechar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reabrir' })).not.toBeInTheDocument();
  });

  it('applies "Iniciar atendimento" immediately, with no confirmation dialog', async () => {
    const onChanged = vi.fn();
    const updated = buildIncident({ status: 'IN_PROGRESS' });
    transitionMock.mockResolvedValue(updated);

    render(
      <IncidentLifecycleActions
        incident={buildIncident({ status: 'OPEN' })}
        canTransition
        onChanged={onChanged}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar atendimento' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(transitionMock).toHaveBeenCalledWith('incident-1', { toStatus: 'IN_PROGRESS' }),
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(updated));
  });

  it('"Cancelar incidente" opens a dialog asking for the required cancellation reason, and refuses to submit empty', async () => {
    render(
      <IncidentLifecycleActions
        incident={buildIncident({ status: 'OPEN' })}
        canTransition
        onChanged={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar incidente' }));
    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByText('Cancelar este incidente?')).toBeInTheDocument();
    expect(
      within(dialog).getByLabelText('Motivo do cancelamento', { exact: false }),
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar incidente' }));

    expect(await within(dialog).findByText('Este campo é obrigatório.')).toBeInTheDocument();
    expect(transitionMock).not.toHaveBeenCalled();
  });

  it('a RESOLVED incident offers "Fechar" (no dialog field, but confirmed) and "Reabrir" (requires reopenReason)', async () => {
    const onChanged = vi.fn();
    const closed = buildIncident({ status: 'CLOSED' });
    transitionMock.mockResolvedValue(closed);

    render(
      <IncidentLifecycleActions
        incident={buildIncident({ status: 'RESOLVED' })}
        canTransition
        onChanged={onChanged}
      />,
    );

    expect(screen.getByRole('button', { name: 'Fechar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reabrir' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Fechar este incidente?')).toBeInTheDocument();
    expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument();

    // The dialog's own "X" close affordance carries the same accessible
    // name ("Fechar") as this transition's confirm button by coincidence —
    // the confirm button is the one inside `dialog-footer`, rendered before
    // the close affordance in DOM order.
    const fecharButtons = within(dialog).getAllByRole('button', { name: 'Fechar' });
    const confirmCloseButton = fecharButtons[0];
    expect(confirmCloseButton).toBeDefined();
    fireEvent.click(confirmCloseButton!);
    await waitFor(() =>
      expect(transitionMock).toHaveBeenCalledWith('incident-1', { toStatus: 'CLOSED' }),
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(closed));
  });
});
