import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ControlLifecycleActions } from './control-lifecycle-actions';

import type { AvailableControlTransition } from '../types';

const { transitionControlMock } = vi.hoisted(() => ({
  transitionControlMock: vi.fn(),
}));

vi.mock('../api', () => ({
  controlsApi: {
    transitionControl: transitionControlMock,
  },
}));

describe('ControlLifecycleActions', () => {
  beforeEach(() => {
    transitionControlMock.mockReset();
  });

  it('shows an honest "no transition available" message rather than an empty card, when the server offers none', () => {
    render(
      <ControlLifecycleActions
        controlId="control-1"
        etag='"1"'
        availableTransitions={[]}
        onChanged={vi.fn()}
      />,
    );

    expect(
      screen.getByText('Nenhuma transição está disponível para o seu perfil neste momento.'),
    ).toBeInTheDocument();
  });

  it('renders no button for a transition the server did not include — an illegal move is absent, never disabled', () => {
    const onlyRetirement: AvailableControlTransition[] = [
      {
        toStatus: 'RETIRED',
        requiredPermission: 'control:administer',
        preconditionsMet: true,
      },
    ];

    render(
      <ControlLifecycleActions
        controlId="control-1"
        etag='"1"'
        availableTransitions={onlyRetirement}
        onChanged={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /Aplicar: Descontinuado/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Aplicar: Ativo/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Aplicar: Suspenso/ })).not.toBeInTheDocument();
  });

  it('surfaces an unmet precondition (missing owner) instead of a disabled button with no explanation', () => {
    const missingOwner: AvailableControlTransition[] = [
      {
        toStatus: 'ACTIVE',
        requiredPermission: 'control:edit',
        preconditionsMet: false,
        unmetPreconditions: ['O controle precisa de um responsável definido.'],
      },
    ];

    render(
      <ControlLifecycleActions
        controlId="control-1"
        etag='"1"'
        availableTransitions={missingOwner}
        onChanged={vi.fn()}
      />,
    );

    expect(screen.getByText('Pendências para esta transição:')).toBeInTheDocument();
    expect(screen.getByText('O controle precisa de um responsável definido.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Aplicar: Ativo/ })).toBeDisabled();
  });

  it('requires a justification before retiring a control, and sends it once provided (US1 AS3)', async () => {
    const canRetire: AvailableControlTransition[] = [
      {
        toStatus: 'RETIRED',
        requiredPermission: 'control:administer',
        preconditionsMet: true,
      },
    ];
    transitionControlMock.mockResolvedValueOnce({
      transition: {
        id: 't1',
        fromStatus: 'ACTIVE',
        toStatus: 'RETIRED',
        performedBy: { id: 'user-1', fullName: 'Ana Souza' },
        performedAt: '2026-01-01T00:00:00.000Z',
        justification: 'Substituído pelo novo controle automatizado.',
      },
      etag: '"2"',
    });

    render(
      <ControlLifecycleActions
        controlId="control-1"
        etag='"1"'
        availableTransitions={canRetire}
        onChanged={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Aplicar: Descontinuado/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(
      await screen.findByText(
        'Informe a justificativa da descontinuação. Ela é obrigatória para esta transição.',
      ),
    ).toBeInTheDocument();
    expect(transitionControlMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Justificativa/), {
      target: { value: 'Substituído pelo novo controle automatizado.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() =>
      expect(transitionControlMock).toHaveBeenCalledWith(
        'control-1',
        { toStatus: 'RETIRED', justification: 'Substituído pelo novo controle automatizado.' },
        '"1"',
      ),
    );
  });
});
