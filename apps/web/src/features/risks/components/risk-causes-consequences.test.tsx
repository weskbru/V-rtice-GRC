import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-client';

import { RiskCausesConsequences } from './risk-causes-consequences';

/**
 * Component-mount evidence for the read/edit-cycle redesign of Causas e
 * Consequências (016-risk-detail-experience, Área 4, 2026-09-17, FR-057).
 *
 * `PUT /risks/{riskId}/causes|consequences` replaces the WHOLE collection —
 * there is no per-item endpoint (`replace-risk-statements-request.dto.ts`).
 * The suite below exists specifically to prove the guarantee that design
 * had to invent to make that collective PUT safe: **at most one item, in
 * EITHER list, is ever in edit/creation mode at a time** — so confirming
 * one item can never silently carry a second, half-typed item's draft text
 * into the same request. Before this redesign no test proved this, for a
 * structural reason: the old `useFieldArray` form saved its whole array in
 * one shot, so "one item pending, a second untouched" was never a state
 * that could exist to be protected — this rewrite is what creates the
 * category of state, so it is also what has to prove it is safe.
 */

const { replaceCausesMock, replaceConsequencesMock } = vi.hoisted(() => ({
  replaceCausesMock: vi.fn(),
  replaceConsequencesMock: vi.fn(),
}));

vi.mock('../api', () => ({
  risksApi: {
    replaceCauses: replaceCausesMock,
    replaceConsequences: replaceConsequencesMock,
  },
}));

describe('RiskCausesConsequences', () => {
  beforeEach(() => {
    replaceCausesMock.mockReset();
    replaceConsequencesMock.mockReset();
  });

  it('renders every persisted cause/consequence as read-only text, never as an open input', () => {
    render(
      <RiskCausesConsequences
        riskId="risk-1"
        initialCauses={[
          { id: 'c1', description: 'Fornecedor único', sortOrder: 0 },
          { id: 'c2', description: 'Falta de contrato de contingência', sortOrder: 1 },
        ]}
        initialConsequences={[{ id: 'q1', description: 'Interrupção da produção', sortOrder: 0 }]}
        etag='"1"'
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByText('Fornecedor único')).toBeInTheDocument();
    expect(screen.getByText('Falta de contrato de contingência')).toBeInTheDocument();
    expect(screen.getByText('Interrupção da produção')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Editar causa 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remover causa 1' })).toBeInTheDocument();
  });

  it('opens an existing row pre-filled and labelled "Editando" when Editar is clicked', () => {
    render(
      <RiskCausesConsequences
        riskId="risk-1"
        initialCauses={[{ id: 'c1', description: 'Fornecedor único', sortOrder: 0 }]}
        initialConsequences={[]}
        etag='"1"'
        onSaved={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Editar causa 1' }));

    expect(screen.getByLabelText('Causa 1')).toHaveValue('Fornecedor único');
    expect(screen.getByText('Editando')).toBeInTheDocument();
    // The row is no longer plain read-only text while being edited.
    expect(screen.queryByRole('button', { name: 'Editar causa 1' })).not.toBeInTheDocument();
  });

  it('confirming an edit sends the WHOLE list, with only that one item changed', async () => {
    replaceCausesMock.mockResolvedValueOnce({
      items: [
        { id: 'c1', description: 'Fornecedor único', sortOrder: 0 },
        { id: 'c2', description: 'Segunda causa revisada', sortOrder: 1 },
      ],
      etag: '"2"',
    });
    const onSaved = vi.fn();

    render(
      <RiskCausesConsequences
        riskId="risk-1"
        initialCauses={[
          { id: 'c1', description: 'Fornecedor único', sortOrder: 0 },
          { id: 'c2', description: 'Segunda causa', sortOrder: 1 },
        ]}
        initialConsequences={[]}
        etag='"1"'
        onSaved={onSaved}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Editar causa 2' }));
    fireEvent.change(screen.getByLabelText('Causa 2'), {
      target: { value: 'Segunda causa revisada' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() =>
      expect(replaceCausesMock).toHaveBeenCalledWith(
        'risk-1',
        ['Fornecedor único', 'Segunda causa revisada'],
        '"1"',
      ),
    );
    expect(onSaved).toHaveBeenCalledWith({
      kind: 'cause',
      items: [
        { id: 'c1', description: 'Fornecedor único', sortOrder: 0 },
        { id: 'c2', description: 'Segunda causa revisada', sortOrder: 1 },
      ],
      etag: '"2"',
    });
    // Back to read-only once confirmed.
    expect(await screen.findByRole('button', { name: 'Editar causa 2' })).toBeInTheDocument();
  });

  it('locks every other Editar/Remover and both Adicionar buttons while one item is being edited — the guarantee a collective PUT needs', () => {
    render(
      <RiskCausesConsequences
        riskId="risk-1"
        initialCauses={[
          { id: 'c1', description: 'Primeira causa', sortOrder: 0 },
          { id: 'c2', description: 'Segunda causa', sortOrder: 1 },
        ]}
        initialConsequences={[{ id: 'q1', description: 'Consequência existente', sortOrder: 0 }]}
        etag='"1"'
        onSaved={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Editar causa 1' }));

    // The item being edited is fine; every OTHER row's actions are disabled —
    // structurally, a second item can never become dirty at the same time.
    expect(screen.getByRole('button', { name: 'Remover causa 2' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Editar consequência 1' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remover consequência 1' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Adicionar causa' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Adicionar consequência' })).toBeDisabled();
    expect(
      screen.getByText('Confirme ou cancele a edição em andamento antes de iniciar outra.'),
    ).toBeInTheDocument();

    // Cancelling releases the lock again.
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByRole('button', { name: 'Adicionar consequência' })).not.toBeDisabled();
  });

  it('creating a new item shows an unambiguous "Nova causa" state, distinct from editing, and appends on confirm', async () => {
    replaceCausesMock.mockResolvedValueOnce({
      items: [
        { id: 'c1', description: 'Fornecedor único', sortOrder: 0 },
        { id: 'c2', description: 'Nova causa registrada', sortOrder: 1 },
      ],
      etag: '"2"',
    });

    render(
      <RiskCausesConsequences
        riskId="risk-1"
        initialCauses={[{ id: 'c1', description: 'Fornecedor único', sortOrder: 0 }]}
        initialConsequences={[]}
        etag='"1"'
        onSaved={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar causa' }));
    expect(screen.getByText('Nova causa')).toBeInTheDocument();
    expect(screen.getByLabelText('Causa 2')).toHaveValue('');

    // Blank is rejected client-side, never reaches the API.
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByText('Descreva esta causa ou remova a linha.')).toBeInTheDocument();
    expect(replaceCausesMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Causa 2'), {
      target: { value: 'Nova causa registrada' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() =>
      expect(replaceCausesMock).toHaveBeenCalledWith(
        'risk-1',
        ['Fornecedor único', 'Nova causa registrada'],
        '"1"',
      ),
    );
  });

  it('asks for confirmation before removing a persisted row, then sends the list without it', async () => {
    replaceCausesMock.mockResolvedValueOnce({
      items: [{ id: 'c2', description: 'Segunda causa', sortOrder: 0 }],
      etag: '"2"',
    });

    render(
      <RiskCausesConsequences
        riskId="risk-1"
        initialCauses={[
          { id: 'c1', description: 'Primeira causa', sortOrder: 0 },
          { id: 'c2', description: 'Segunda causa', sortOrder: 1 },
        ]}
        initialConsequences={[]}
        etag='"1"'
        onSaved={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remover causa 1' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Remover causa?')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remover causa 1' }));

    await waitFor(() =>
      expect(replaceCausesMock).toHaveBeenCalledWith('risk-1', ['Segunda causa'], '"1"'),
    );
  });

  it('surfaces a 409 as a conflict banner without discarding the item still being edited', async () => {
    replaceConsequencesMock.mockRejectedValueOnce(new ApiError({ title: 'Conflito', status: 409 }));

    render(
      <RiskCausesConsequences
        riskId="risk-1"
        initialCauses={[]}
        initialConsequences={[{ id: 'q1', description: 'Consequência existente', sortOrder: 0 }]}
        etag='"1"'
        onSaved={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Editar consequência 1' }));
    fireEvent.change(screen.getByLabelText('Consequência 1'), {
      target: { value: 'Consequência editada' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(
      await screen.findByText(
        'Este risco foi alterado por outra pessoa. Recarregue a página para ver a versão atual antes de salvar.',
      ),
    ).toBeInTheDocument();
    // The draft is not discarded — the editor is still open with what the
    // user typed, since the collective PUT did not succeed.
    expect(screen.getByLabelText('Consequência 1')).toHaveValue('Consequência editada');
  });
});
