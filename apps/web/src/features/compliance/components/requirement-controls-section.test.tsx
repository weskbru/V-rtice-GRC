import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RequirementControlsSection } from './requirement-controls-section';

import type { RequirementControlLink } from '../types';

/**
 * Component-mount evidence for `RequirementControlsSection` (US2, ADR-020).
 * `../api` is mocked at the network boundary.
 */
const {
  listRequirementControlLinksMock,
  listControlsMock,
  linkRequirementToControlMock,
  unlinkRequirementFromControlMock,
} = vi.hoisted(() => ({
  listRequirementControlLinksMock: vi.fn(),
  listControlsMock: vi.fn(),
  linkRequirementToControlMock: vi.fn(),
  unlinkRequirementFromControlMock: vi.fn(),
}));

vi.mock('../api', () => ({
  complianceApi: {
    listRequirementControlLinks: listRequirementControlLinksMock,
    listControls: listControlsMock,
    linkRequirementToControl: linkRequirementToControlMock,
    unlinkRequirementFromControl: unlinkRequirementFromControlMock,
  },
}));

const linkedBy = { id: 'user-1', fullName: 'Ana Souza' };

function linkFixture(overrides: Partial<RequirementControlLink>): RequirementControlLink {
  return {
    id: 'link-1',
    control: { id: 'control-1', code: 'CTL-001', name: 'Controle de acesso' },
    linkedBy,
    linkedAt: '2026-01-05T00:00:00.000Z',
    unlinkedBy: null,
    unlinkedAt: null,
    ...overrides,
  };
}

describe('RequirementControlsSection', () => {
  beforeEach(() => {
    listRequirementControlLinksMock.mockReset();
    listControlsMock.mockReset();
    linkRequirementToControlMock.mockReset();
    unlinkRequirementFromControlMock.mockReset();
    listControlsMock.mockResolvedValue({ data: [], isPartial: false });
  });

  it('shows the honest empty state when no control is linked', async () => {
    listRequirementControlLinksMock.mockResolvedValue([]);
    render(<RequirementControlsSection requirementId="req-1" canLink={false} />);

    expect(
      await screen.findByText('Nenhum controle vinculado a esta cláusula.'),
    ).toBeInTheDocument();
  });

  it('lists a currently linked control with who linked it and when', async () => {
    listRequirementControlLinksMock.mockResolvedValue([linkFixture({})]);
    render(<RequirementControlsSection requirementId="req-1" canLink={false} />);

    expect(await screen.findByText('Controle de acesso')).toBeInTheDocument();
    expect(screen.getByText('CTL-001')).toBeInTheDocument();
    expect(screen.getByText('Ana Souza')).toBeInTheDocument();
  });

  it('hides the picker and unlink action when the caller lacks compliance:map', async () => {
    listRequirementControlLinksMock.mockResolvedValue([linkFixture({})]);
    render(<RequirementControlsSection requirementId="req-1" canLink={false} />);

    await screen.findByText('Controle de acesso');
    expect(screen.queryByRole('button', { name: 'Desvincular' })).not.toBeInTheDocument();
    // The picker's own trigger accessible name is `pickerAriaLabel`
    // ("Selecionar controle"), deliberately DIFFERENT from the adjacent
    // button's "Vincular controle" — see the identical fix in the e2e
    // specs (Front H).
    expect(screen.queryByRole('combobox', { name: 'Selecionar controle' })).not.toBeInTheDocument();
  });

  it('links a control and refreshes the list', async () => {
    listRequirementControlLinksMock.mockResolvedValue([]);
    listControlsMock.mockResolvedValue({
      data: [{ id: 'control-2', code: 'CTL-002', name: 'Backup diário' }],
      isPartial: false,
    });
    linkRequirementToControlMock.mockResolvedValue(
      linkFixture({
        id: 'link-2',
        control: { id: 'control-2', code: 'CTL-002', name: 'Backup diário' },
      }),
    );

    render(<RequirementControlsSection requirementId="req-1" canLink />);

    await screen.findByText('Nenhum controle vinculado a esta cláusula.');
    // The picker searches server-side as the user types (Front H) — see
    // the identical fix in `risk-controls-section.test.tsx`.
    fireEvent.click(screen.getByRole('combobox', { name: 'Selecionar controle' }));
    fireEvent.change(screen.getByPlaceholderText('Buscar controle por nome ou código'), {
      target: { value: 'backup' },
    });
    fireEvent.click(await screen.findByRole('option', { name: /Backup diário/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Vincular controle' }));

    await waitFor(() =>
      expect(linkRequirementToControlMock).toHaveBeenCalledWith('req-1', {
        controlId: 'control-2',
      }),
    );
  });

  it('surfaces the 422 out-of-scope-or-nonexistent error honestly, never a stack trace', async () => {
    listRequirementControlLinksMock.mockResolvedValue([]);
    listControlsMock.mockResolvedValue({
      data: [{ id: 'control-2', code: 'CTL-002', name: 'Backup diário' }],
      isPartial: false,
    });
    const { ApiError } = await import('@/lib/api-client');
    linkRequirementToControlMock.mockRejectedValue(
      new ApiError({ title: 'Não é possível processar a solicitação', status: 422 }),
    );

    render(<RequirementControlsSection requirementId="req-1" canLink />);

    await screen.findByText('Nenhum controle vinculado a esta cláusula.');
    fireEvent.click(screen.getByRole('combobox', { name: 'Selecionar controle' }));
    fireEvent.change(screen.getByPlaceholderText('Buscar controle por nome ou código'), {
      target: { value: 'backup' },
    });
    fireEvent.click(await screen.findByRole('option', { name: /Backup diário/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Vincular controle' }));

    expect(
      await screen.findByText(
        'Este controle não pôde ser vinculado — ele não existe ou está fora do seu escopo organizacional.',
      ),
    ).toBeInTheDocument();
  });

  it('asks for confirmation before unlinking, and states the link is retained in history, not erased (FR-011)', async () => {
    listRequirementControlLinksMock.mockResolvedValue([linkFixture({})]);
    render(<RequirementControlsSection requirementId="req-1" canLink />);

    fireEvent.click(await screen.findByRole('button', { name: 'Desvincular' }));

    expect(await screen.findByText('Desvincular controle?')).toBeInTheDocument();
    expect(
      screen.getByText(/O vínculo não é apagado: ele continua registrado no histórico/),
    ).toBeInTheDocument();
    expect(unlinkRequirementFromControlMock).not.toHaveBeenCalled();
  });

  it('unlinks after confirmation', async () => {
    listRequirementControlLinksMock.mockResolvedValue([linkFixture({})]);
    unlinkRequirementFromControlMock.mockResolvedValue(undefined);

    render(<RequirementControlsSection requirementId="req-1" canLink />);

    fireEvent.click(await screen.findByRole('button', { name: 'Desvincular' }));
    await screen.findByText('Desvincular controle?');
    fireEvent.click(screen.getByRole('button', { name: 'Desvincular' }));

    await waitFor(() =>
      expect(unlinkRequirementFromControlMock).toHaveBeenCalledWith('req-1', 'link-1'),
    );
  });
});
