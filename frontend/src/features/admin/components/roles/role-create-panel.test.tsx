import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listPermissionsMock, createRoleMock } = vi.hoisted(() => ({
  listPermissionsMock: vi.fn(),
  createRoleMock: vi.fn(),
}));

vi.mock('../../api', () => ({
  adminApi: { listPermissions: listPermissionsMock, createRole: createRoleMock },
}));

import { ApiError } from '@/lib/api-client';

import { RoleCreatePanel } from './role-create-panel';

import type { Permission, Role } from '../../types';

const CATALOG: readonly Permission[] = [
  { identifier: 'risk:view', resource: 'risk', action: 'VIEW', description: 'View risks' },
  { identifier: 'risk:edit', resource: 'risk', action: 'EDIT', description: 'Edit risks' },
  { identifier: 'control:view', resource: 'control', action: 'VIEW', description: 'View controls' },
];

const CREATED: Role = {
  id: 'role-new',
  name: 'Leitor de Riscos',
  description: 'Só leitura de riscos.',
  isSystem: false,
  assignedUserCount: 0,
  permissions: [CATALOG[0]!],
};

function apiError(status: number): ApiError {
  return new ApiError({
    type: 'https://pharosgrc.local/problems/test',
    title: 'Test',
    status,
    detail: 'Test',
  });
}

function renderPanel() {
  const onClose = vi.fn();
  const onCreated = vi.fn();
  render(<RoleCreatePanel onClose={onClose} onCreated={onCreated} />);
  return { onClose, onCreated };
}

async function compose(): Promise<void> {
  await screen.findByRole('button', { name: /^Riscos\b/ });
  fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: 'Leitor de Riscos' } });
  fireEvent.change(screen.getByLabelText(/^Descrição/), {
    target: { value: 'Só leitura de riscos.' },
  });
  fireEvent.click(
    screen.getByRole('checkbox', { name: 'Selecionar todas as permissões de Controles' }),
  );
}

beforeEach(() => {
  listPermissionsMock.mockReset();
  createRoleMock.mockReset();
  listPermissionsMock.mockResolvedValue(CATALOG);
});

describe('RoleCreatePanel — the shell', () => {
  it('names the panel, fetches the catalogue once, and shows the live counts in the fixed header', async () => {
    renderPanel();

    expect(screen.getByRole('complementary', { name: 'Novo papel' })).toBeInTheDocument();
    await waitFor(() => expect(listPermissionsMock).toHaveBeenCalledTimes(1));

    const header = screen.getByRole('complementary', { name: 'Novo papel' });
    expect(header).toHaveTextContent('Permissões');
    expect(header).toHaveTextContent('Módulos');

    fireEvent.click(
      await screen.findByRole('checkbox', { name: 'Selecionar todas as permissões de Riscos' }),
    );
    await waitFor(() => expect(screen.getByText('2 permissões selecionadas')).toBeInTheDocument());
  });

  it('offers "Criar papel" as the primary action, in the footer, reaching the form by id', async () => {
    renderPanel();
    await screen.findByRole('button', { name: /^Riscos\b/ });

    const submit = screen.getByRole('button', { name: 'Criar papel' });
    expect(submit).toHaveAttribute('type', 'submit');
    expect(submit).toHaveAttribute('form');
  });
});

describe('RoleCreatePanel — submitting', () => {
  it('sends name, description and the selected identifiers, then hands the created role back', async () => {
    createRoleMock.mockResolvedValue(CREATED);
    const { onCreated } = renderPanel();
    await compose();

    fireEvent.click(screen.getByRole('button', { name: 'Criar papel' }));

    await waitFor(() => expect(createRoleMock).toHaveBeenCalledTimes(1));
    expect(createRoleMock).toHaveBeenCalledWith({
      name: 'Leitor de Riscos',
      description: 'Só leitura de riscos.',
      permissionIdentifiers: ['control:view'],
    });
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(CREATED));
  });

  it('refuses to submit — and never reaches the API — while a requirement is unmet', async () => {
    renderPanel();
    await screen.findByRole('button', { name: /^Riscos\b/ });

    fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: 'Papel vazio' } });
    fireEvent.change(screen.getByLabelText(/^Descrição/), { target: { value: 'Nada.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar papel' }));

    await waitFor(() =>
      expect(screen.getByText('Selecione ao menos uma permissão.')).toBeInTheDocument(),
    );
    expect(createRoleMock).not.toHaveBeenCalled();
  });

  it('names the server limit on a too-long name before the request is made', async () => {
    renderPanel();
    await screen.findByRole('button', { name: /^Riscos\b/ });

    fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: 'x'.repeat(101) } });
    fireEvent.change(screen.getByLabelText(/^Descrição/), { target: { value: 'Descrição.' } });
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Selecionar todas as permissões de Riscos' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Criar papel' }));

    await waitFor(() =>
      expect(
        screen.getByText('O nome do papel deve ter no máximo 100 caracteres.'),
      ).toBeInTheDocument(),
    );
    expect(createRoleMock).not.toHaveBeenCalled();
  });

  it('reports a duplicate name as a name conflict, and keeps what was composed', async () => {
    createRoleMock.mockRejectedValue(apiError(409));
    const { onCreated } = renderPanel();
    await compose();

    fireEvent.click(screen.getByRole('button', { name: 'Criar papel' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Já existe um papel com esse nome.'),
    );
    expect(onCreated).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/^Nome/)).toHaveValue('Leitor de Riscos');
  });

  it('never blames the system-role rule for a 422 on a role that does not exist yet', async () => {
    createRoleMock.mockRejectedValue(apiError(422));
    renderPanel();
    await compose();

    fireEvent.click(screen.getByRole('button', { name: 'Criar papel' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Revise os campos: o servidor recusou os dados informados.',
      ),
    );
    expect(screen.queryByText(/Papéis do sistema não podem/)).not.toBeInTheDocument();
  });

  it('disables the controls while the request is in flight (migrated from PermissionChecklist)', async () => {
    let resolveCreate: ((role: Role) => void) | undefined;
    createRoleMock.mockReturnValue(
      new Promise<Role>((resolve) => {
        resolveCreate = resolve;
      }),
    );
    renderPanel();
    await compose();

    fireEvent.click(screen.getByRole('button', { name: 'Criar papel' }));

    await waitFor(() => expect(screen.getByRole('button', { name: /Criando…/ })).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(screen.getByLabelText(/^Nome/)).toBeDisabled();
    expect(screen.getByLabelText('Buscar permissão')).toBeDisabled();
    for (const checkbox of screen.getAllByRole('checkbox')) {
      expect(checkbox).toBeDisabled();
    }

    resolveCreate?.(CREATED);
    await waitFor(() => expect(screen.queryByRole('button', { name: /Criando…/ })).toBeNull());
  });
});

describe('RoleCreatePanel — leaving without creating', () => {
  it('closes straight away when nothing has been composed', async () => {
    const { onClose } = renderPanel();
    await screen.findByRole('button', { name: /^Riscos\b/ });

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Descartar o novo papel?')).not.toBeInTheDocument();
  });

  it('asks before discarding composed work, and persists nothing either way', async () => {
    const { onClose } = renderPanel();
    await compose();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.getByText('Descartar o novo papel?')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(createRoleMock).not.toHaveBeenCalled();
  });

  it('keeps the composition when the discard is declined', async () => {
    const { onClose } = renderPanel();
    await compose();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar preenchendo' }));

    await waitFor(() => expect(screen.queryByText('Descartar o novo papel?')).toBeNull());
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/^Nome/)).toHaveValue('Leitor de Riscos');
  });
});

describe('RoleCreatePanel — corrections measured on screen', () => {
  it('drops a field error as soon as that field is corrected, instead of contradicting the form', async () => {
    renderPanel();
    await screen.findByRole('button', { name: /^Riscos\b/ });

    fireEvent.click(screen.getByRole('button', { name: 'Criar papel' }));
    await waitFor(() =>
      expect(screen.getByText('Selecione ao menos uma permissão.')).toBeInTheDocument(),
    );
    expect(screen.getByText('Informe o nome do papel.')).toBeInTheDocument();
    expect(screen.getByText('Informe uma descrição do papel.')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Selecionar todas as permissões de Riscos' }),
    );
    await waitFor(() => expect(screen.queryByText('Selecione ao menos uma permissão.')).toBeNull());

    fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: 'Leitor' } });
    await waitFor(() => expect(screen.queryByText('Informe o nome do papel.')).toBeNull());

    fireEvent.change(screen.getByLabelText(/^Descrição/), { target: { value: 'Leitura.' } });
    await waitFor(() => expect(screen.queryByText('Informe uma descrição do papel.')).toBeNull());
  });

  it('names the draft in the heading rather than repeating the panel label', async () => {
    renderPanel();
    await screen.findByRole('button', { name: /^Riscos\b/ });

    expect(screen.getByRole('heading', { name: 'Sem nome ainda' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: 'Leitor de Riscos' } });
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Leitor de Riscos' })).toBeInTheDocument(),
    );
    expect(screen.queryByRole('heading', { name: 'Sem nome ainda' })).toBeNull();
  });

  it('renders exactly one clear control in the permission search', async () => {
    renderPanel();
    await screen.findByRole('button', { name: /^Riscos\b/ });

    const search = screen.getByLabelText('Buscar permissão');
    expect(search).toHaveAttribute('type', 'text');

    fireEvent.change(search, { target: { value: 'risk' } });
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'Limpar a busca de permissões' })).toHaveLength(
        1,
      ),
    );
  });
});
