import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listPermissionsMock, updateRoleMock, createRoleMock } = vi.hoisted(() => ({
  listPermissionsMock: vi.fn(),
  updateRoleMock: vi.fn(),
  createRoleMock: vi.fn(),
}));

vi.mock('../../api', () => ({
  adminApi: {
    listPermissions: listPermissionsMock,
    updateRole: updateRoleMock,
    createRole: createRoleMock,
  },
}));

import { RoleEditFields } from './role-edit-fields';
import { useRoleEditor } from './use-role-editor';

import type { Permission, Role } from '../../types';

const CATALOG: readonly Permission[] = [
  { identifier: 'risk:view', resource: 'risk', action: 'VIEW', description: 'View risks' },
  { identifier: 'risk:edit', resource: 'risk', action: 'EDIT', description: 'Edit risks' },
  { identifier: 'control:view', resource: 'control', action: 'VIEW', description: 'View controls' },
];

function role(overrides: Partial<Role> = {}): Role {
  return {
    id: 'role-1',
    name: 'Analista de Riscos',
    description: 'Analisa e trata riscos operacionais.',
    isSystem: false,
    assignedUserCount: 0,
    permissions: [CATALOG[0]!],
    ...overrides,
  };
}

function Harness({ target }: { target: Role | null }): React.JSX.Element {
  const editor = useRoleEditor(target, true);
  return <RoleEditFields role={target} editor={editor} formId="test-form" onSubmit={vi.fn()} />;
}

function expandModule(label: string): void {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${label}\\b`) }));
}

beforeEach(() => {
  listPermissionsMock.mockReset();
  updateRoleMock.mockReset();
  createRoleMock.mockReset();
  listPermissionsMock.mockResolvedValue(CATALOG);
});

describe('RoleEditFields — a SYSTEM role is legible and locked (FR-031, migrated)', () => {
  it('locks the name and EVERY permission checkbox, and writes the reason for both', async () => {
    const target = role({
      isSystem: true,
      name: 'Platform Administrator',
      permissions: [CATALOG[0]!, CATALOG[1]!],
    });
    render(<Harness target={target} />);

    const nameField = screen.getByLabelText(/^Nome/);
    expect(nameField).toHaveAttribute('readonly');
    expect(nameField).toHaveValue('Platform Administrator');

    expandModule('Riscos');
    expect(screen.getByText('risk:view')).toBeInTheDocument();
    expect(screen.getByText('risk:edit')).toBeInTheDocument();
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(3);
    for (const checkbox of checkboxes) {
      expect(checkbox).toBeDisabled();
    }

    expect(screen.getByText('Papel do sistema: o nome não pode ser alterado.')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Papel do sistema: o conjunto de permissões não pode ser alterado. As permissões continuam visíveis abaixo.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Este papel é definido pela plataforma. Nome, descrição e permissões são mantidos pelo próprio sistema e não podem ser alterados aqui.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Neste papel, apenas a descrição pode ser editada e salva.'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Somente leitura')).toBeInTheDocument();

    await waitFor(() => expect(listPermissionsMock).not.toHaveBeenCalled());
  });

  it('locks the description too, legibly, with its own reason (F-68)', () => {
    render(<Harness target={role({ isSystem: true, description: 'Descrição semeada.' })} />);
    const description = screen.getByLabelText(/^Descrição/);

    expect(description).toHaveAttribute('readonly');
    expect(description).not.toBeDisabled();
    expect(description).toHaveValue('Descrição semeada.');

    expect(
      screen.getByText(
        'Papel do sistema: a descrição não pode ser alterada. Ela é definida pela plataforma e restaurada a cada atualização do sistema.',
      ),
    ).toBeInTheDocument();

    fireEvent.change(description, { target: { value: 'Tentativa de edição.' } });
    expect(screen.queryByText('A descrição foi alterada.')).not.toBeInTheDocument();
    expect(screen.queryByText('Alterações pendentes')).not.toBeInTheDocument();
  });
});

describe('RoleEditFields — a CUSTOM role is fully editable (migrated)', () => {
  it('leaves the name and every permission checkbox operable, and states no lock reason', async () => {
    render(<Harness target={role({ isSystem: false })} />);

    await screen.findByRole('button', { name: /^Riscos\b/ });
    expandModule('Riscos');

    const nameField = screen.getByLabelText(/^Nome/);
    expect(nameField).not.toBeDisabled();
    expect(nameField).not.toHaveAttribute('readonly');

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(1);
    for (const checkbox of checkboxes) {
      expect(checkbox).not.toBeDisabled();
    }

    expect(
      screen.queryByText('Papel do sistema: o nome não pode ser alterado.'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Somente leitura')).not.toBeInTheDocument();
  });
});

describe('RoleEditFields — the tri-state module selector (FR-028)', () => {
  it('distinguishes none, some and all — in shape AND in words, so the distinction survives greyscale (NFR-004)', async () => {
    render(<Harness target={role({ isSystem: false, permissions: [CATALOG[0]!] })} />);

    const riskToggle = await screen.findByRole('checkbox', {
      name: 'Selecionar todas as permissões de Riscos',
    });
    const controlToggle = screen.getByRole('checkbox', {
      name: 'Selecionar todas as permissões de Controles',
    });

    expect(riskToggle).toHaveAttribute('aria-checked', 'mixed');
    expect(screen.getByText('1 de 2 selecionadas')).toBeInTheDocument();

    expect(controlToggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('Nenhuma selecionada')).toBeInTheDocument();

    fireEvent.click(riskToggle);
    await waitFor(() => expect(riskToggle).toHaveAttribute('aria-checked', 'true'));
    expect(screen.getByText('Todas selecionadas')).toBeInTheDocument();

    fireEvent.click(riskToggle);
    await waitFor(() => expect(riskToggle).toHaveAttribute('aria-checked', 'false'));
  });
});

describe('RoleEditFields — the pending change summary (FR-029, FR-030)', () => {
  it('starts with nothing pending and always states when the change takes effect', async () => {
    render(<Harness target={role({ isSystem: false })} />);
    await screen.findByRole('button', { name: /^Riscos\b/ });

    expect(screen.getByText('Alterações pendentes')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma alteração pendente.')).toBeInTheDocument();
    expect(
      screen.getByText(
        'A alteração no conjunto de permissões passa a valer na próxima requisição de cada usuário afetado — sem necessidade de novo login.',
      ),
    ).toBeInTheDocument();
  });

  it('names what will be ADDED and what will be REMOVED, separately, before anything is saved', async () => {
    render(<Harness target={role({ isSystem: false, permissions: [CATALOG[0]!] })} />);
    await screen.findByRole('button', { name: /^Riscos\b/ });

    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Selecionar todas as permissões de Controles' }),
    );
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Selecionar todas as permissões de Riscos' }),
    );
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Selecionar todas as permissões de Riscos' }),
    );

    await waitFor(() => expect(screen.getByText('1 permissão a acrescentar')).toBeInTheDocument());
    expect(screen.getByText('1 permissão a remover')).toBeInTheDocument();
    expect(screen.queryByText('Nenhuma alteração pendente.')).not.toBeInTheDocument();
  });

  it('names a renamed role with both the old and the new value', async () => {
    render(<Harness target={role({ isSystem: false, name: 'Analista de Riscos' })} />);
    await screen.findByRole('button', { name: /^Riscos\b/ });

    fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: 'Leitor de Riscos' } });

    expect(
      screen.getByText('Nome: de "Analista de Riscos" para "Leitor de Riscos"'),
    ).toBeInTheDocument();
  });
});

const SEARCH_CATALOG: readonly Permission[] = [
  { identifier: 'risk:view', resource: 'risk', action: 'VIEW', description: 'View risks' },
  { identifier: 'risk:edit', resource: 'risk', action: 'EDIT', description: 'Edit risks' },
  {
    identifier: 'control:test',
    resource: 'control',
    action: 'ASSESS',
    description: 'Test the operating effectiveness of a control.',
  },
  {
    identifier: 'finding:view',
    resource: 'finding',
    action: 'VIEW',
    description: 'View audit findings',
  },
];

describe('RoleEditFields — composing a NEW role', () => {
  it('states what a role is and that a created role is always custom, and locks nothing', async () => {
    render(<Harness target={null} />);
    await screen.findByRole('button', { name: /^Riscos\b/ });

    expect(
      screen.getByText(
        'Um papel é um conjunto de permissões. Quem recebe o papel passa a ter todas as permissões marcadas abaixo.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Papéis criados aqui são sempre personalizados/)).toBeInTheDocument();

    expect(screen.queryByText('Somente leitura')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Papel do sistema: o nome não pode ser alterado.'),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Nome/)).not.toHaveAttribute('readonly');

    await waitFor(() => expect(listPermissionsMock).toHaveBeenCalledTimes(1));
  });

  it('starts empty, and offers no pending-change summary against a role that does not exist', async () => {
    render(<Harness target={null} />);
    await screen.findByRole('button', { name: /^Riscos\b/ });

    expect(screen.getByLabelText(/^Nome/)).toHaveValue('');
    expect(screen.getByLabelText(/^Descrição/)).toHaveValue('');
    expect(screen.queryByText('Alterações pendentes')).not.toBeInTheDocument();
    expect(screen.getByText('O que este papel concederá')).toBeInTheDocument();
    expect(
      screen.getByText('Nenhuma permissão selecionada — o papel ainda não concede nada.'),
    ).toBeInTheDocument();
  });

  it('groups the catalogue under its pt-BR module headings (migrated)', async () => {
    listPermissionsMock.mockResolvedValue(SEARCH_CATALOG);
    render(<Harness target={null} />);

    expect(await screen.findByRole('button', { name: /^Riscos\b/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Controles\b/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Auditoria e achados\b/ })).toBeInTheDocument();
  });

  it('counts what the role will grant, in permissions and in modules, as it is composed (migrated)', async () => {
    listPermissionsMock.mockResolvedValue(SEARCH_CATALOG);
    render(<Harness target={null} />);
    await screen.findByRole('button', { name: /^Riscos\b/ });

    expect(
      screen.getByText('Nenhuma permissão selecionada — o papel ainda não concede nada.'),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Selecionar todas as permissões de Controles' }),
    );
    await waitFor(() => expect(screen.getByText('1 permissão selecionada')).toBeInTheDocument());
    expect(screen.getByText('1 permissão')).toBeInTheDocument();
    expect(screen.getByText('em 1 módulo')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Selecionar todas as permissões de Riscos' }),
    );
    await waitFor(() => expect(screen.getByText('3 permissões selecionadas')).toBeInTheDocument());
    expect(screen.getByText('3 permissões')).toBeInTheDocument();
    expect(screen.getByText('em 2 módulos')).toBeInTheDocument();
  });

  it('states each requirement with its state in WORDS, not only in an icon (NFR-004)', async () => {
    listPermissionsMock.mockResolvedValue(SEARCH_CATALOG);
    render(<Harness target={null} />);
    await screen.findByRole('button', { name: /^Riscos\b/ });

    expect(screen.getByText('Pendente: Um nome, de até 100 caracteres')).toBeInTheDocument();
    expect(screen.getByText('Pendente: Uma descrição, de até 500 caracteres')).toBeInTheDocument();
    expect(screen.getByText('Pendente: Ao menos uma permissão selecionada')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: 'Leitor de Riscos' } });
    fireEvent.change(screen.getByLabelText(/^Descrição/), { target: { value: 'Só leitura.' } });
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Selecionar todas as permissões de Riscos' }),
    );

    await waitFor(() =>
      expect(screen.getByText('Atendido: Um nome, de até 100 caracteres')).toBeInTheDocument(),
    );
    expect(screen.getByText('Atendido: Uma descrição, de até 500 caracteres')).toBeInTheDocument();
    expect(screen.getByText('Atendido: Ao menos uma permissão selecionada')).toBeInTheDocument();
    expect(screen.queryByText(/^Pendente: /)).not.toBeInTheDocument();
  });

  it('marks a name past the server limit as still unmet, before the request is made', async () => {
    listPermissionsMock.mockResolvedValue(SEARCH_CATALOG);
    render(<Harness target={null} />);
    await screen.findByRole('button', { name: /^Riscos\b/ });

    fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: 'x'.repeat(101) } });
    await waitFor(() =>
      expect(screen.getByText('Pendente: Um nome, de até 100 caracteres')).toBeInTheDocument(),
    );
  });
});

describe('RoleEditFields — searching the permission tree (migrated from PermissionChecklist)', () => {
  async function renderSearchable(): Promise<HTMLElement> {
    listPermissionsMock.mockResolvedValue(SEARCH_CATALOG);
    render(<Harness target={null} />);
    await screen.findByRole('button', { name: /^Riscos\b/ });
    return screen.getByLabelText('Buscar permissão');
  }

  it('narrows the tree to what matches the raw identifier, and says how many are left', async () => {
    const search = await renderSearchable();
    fireEvent.change(search, { target: { value: 'control:test' } });

    expect(screen.getByRole('button', { name: /^Controles\b/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Riscos\b/ })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^Auditoria e achados\b/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('1 de 4 permissões')).toBeInTheDocument();
  });

  it('matches the pt-BR verb, which appears nowhere in the identifier or the action', async () => {
    const search = await renderSearchable();
    fireEvent.change(search, { target: { value: 'Testar' } });

    expect(screen.getByRole('button', { name: /^Controles\b/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Riscos\b/ })).not.toBeInTheDocument();
  });

  it('matches the pt-BR module label', async () => {
    const search = await renderSearchable();
    fireEvent.change(search, { target: { value: 'Auditoria e achados' } });

    expect(screen.getByRole('button', { name: /^Auditoria e achados\b/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Riscos\b/ })).not.toBeInTheDocument();
  });

  it('says so when nothing matches, and restores the tree when the search is cleared', async () => {
    const search = await renderSearchable();
    fireEvent.change(search, { target: { value: 'inexistente-xyz' } });

    expect(screen.getByText('Nenhuma permissão corresponde à busca.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Riscos\b/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Limpar a busca de permissões' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Riscos\b/ })).toBeInTheDocument(),
    );
    expect(screen.queryByText('Nenhuma permissão corresponde à busca.')).not.toBeInTheDocument();
  });

  it('opens the matching modules, so a result is visible rather than merely counted', async () => {
    const search = await renderSearchable();
    expect(screen.queryByText('control:test')).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'Testar' } });
    await waitFor(() => expect(screen.getByText('control:test')).toBeInTheDocument());
  });

  it('keeps a module toggle meaning the WHOLE module while the search is narrowing it', async () => {
    const search = await renderSearchable();
    fireEvent.change(search, { target: { value: 'risk:edit' } });
    expect(screen.getByText('1 de 4 permissões')).toBeInTheDocument();
    expect(
      screen.getByText(
        'A busca filtra o que aparece aqui. Selecionar um módulo inteiro continua valendo para todas as permissões dele.',
      ),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Selecionar todas as permissões de Riscos' }),
    );

    await waitFor(() => expect(screen.getByText('2 permissões selecionadas')).toBeInTheDocument());
  });
});
