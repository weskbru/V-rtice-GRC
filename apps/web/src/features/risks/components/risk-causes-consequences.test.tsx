import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-client';

import { RiskCausesConsequences } from './risk-causes-consequences';

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

    expect(screen.getByRole('button', { name: 'Remover causa 2' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Editar consequência 1' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remover consequência 1' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Adicionar causa' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Adicionar consequência' })).toBeDisabled();
    expect(
      screen.getByText('Confirme ou cancele a edição em andamento antes de iniciar outra.'),
    ).toBeInTheDocument();

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
    expect(screen.getByLabelText('Consequência 1')).toHaveValue('Consequência editada');
  });
});
