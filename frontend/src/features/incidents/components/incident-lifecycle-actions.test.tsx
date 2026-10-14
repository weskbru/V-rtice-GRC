import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { IncidentLifecycleActions } from './incident-lifecycle-actions';

import type { IncidentDetail } from '../types';

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
    orgUnit: { id: 'org-1', code: 'ROOT', name: 'Vértice GRC' },
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
