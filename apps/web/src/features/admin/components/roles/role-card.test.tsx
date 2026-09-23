import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RoleCard } from './role-card';

import type { Permission, Role } from '../../types';

function permission(identifier: string, resource: string): Permission {
  return { identifier, resource, action: 'VIEW', description: `Description of ${identifier}` };
}

function role(overrides: Partial<Role> = {}): Role {
  return {
    id: 'role-1',
    name: 'Analista de Riscos',
    description: 'Analisa e trata riscos operacionais.',
    isSystem: false,
    assignedUserCount: 0,
    permissions: [],
    ...overrides,
  };
}

function renderCard(target: Role, selected = false): { onSelect: ReturnType<typeof vi.fn> } {
  const onSelect = vi.fn();
  render(
    <ul>
      <RoleCard role={target} selected={selected} onSelect={onSelect} />
    </ul>,
  );
  return { onSelect };
}

describe('RoleCard — permission and user counts (migrated from RolePermissionOverview)', () => {
  it('names the empty case rather than printing a bare zero', () => {
    renderCard(role({ permissions: [], assignedUserCount: 0 }));
    expect(screen.getByText('Nenhuma permissão')).toBeInTheDocument();
    expect(screen.getByText('Nenhum usuário')).toBeInTheDocument();
  });

  it('counts one permission and one user in the singular', () => {
    renderCard(role({ permissions: [permission('risk:view', 'risk')], assignedUserCount: 1 }));
    expect(screen.getByText('1 permissão')).toBeInTheDocument();
    expect(screen.getByText('1 usuário')).toBeInTheDocument();
  });

  it('counts more than one in the plural', () => {
    renderCard(
      role({
        permissions: [permission('risk:view', 'risk'), permission('risk:edit', 'risk')],
        assignedUserCount: 4,
      }),
    );
    expect(screen.getByText('2 permissões')).toBeInTheDocument();
    expect(screen.getByText('4 usuários')).toBeInTheDocument();
  });
});

describe('RoleCard — module reach (migrated from RolePermissionOverview)', () => {
  it('shows the modules in concentration order and never lets the visible cap hide any from a screen reader', () => {
    const target = role({
      permissions: [
        permission('risk:view', 'risk'),
        permission('finding:view', 'finding'),
        permission('finding:create', 'finding'),
        permission('audit-engagement:view', 'audit-engagement'),
        permission('control:view', 'control'),
        permission('control:edit', 'control'),
        permission('asset:view', 'asset'),
        permission('process:view', 'process'),
      ],
    });
    renderCard(target);

    const card = screen.getByRole('button', { name: /Abrir detalhes do papel/ });

    expect(within(card).getByText('Auditoria e achados')).toBeInTheDocument();
    expect(within(card).getByText('Controles')).toBeInTheDocument();
    expect(within(card).getByText('+2 módulos')).toBeInTheDocument();

    expect(
      within(card).getByText(
        'Módulos alcançados: Auditoria e achados, Controles, Riscos, Ativos, Processos',
      ),
    ).toBeInTheDocument();
  });

  it('says a permissionless role reaches nothing, rather than showing an empty chip strip', () => {
    renderCard(role({ permissions: [] }));
    expect(screen.getByText('Não alcança nenhum módulo')).toBeInTheDocument();
  });

  it('summarises a single hidden module in the singular', () => {
    renderCard(
      role({
        permissions: [
          permission('risk:view', 'risk'),
          permission('control:view', 'control'),
          permission('asset:view', 'asset'),
          permission('process:view', 'process'),
        ],
      }),
    );
    expect(screen.getByText('+1 módulo')).toBeInTheDocument();
  });
});

describe('RoleCard — the card is the control', () => {
  it('exposes one button per role whose accessible name says what activating it does, and reports the selection back', () => {
    const target = role({ name: 'Líder de Auditoria' });
    const { onSelect } = renderCard(target);

    const card = screen.getByRole('button', {
      name: /^Abrir detalhes do papel Líder de Auditoria/,
    });
    fireEvent.click(card);
    expect(onSelect).toHaveBeenCalledWith(target);
  });

  it('marks the selected card with aria-current AND in words, never by colour alone (NFR-004)', () => {
    renderCard(role(), true);
    const card = screen.getByRole('button', { name: /Abrir detalhes do papel/ });

    expect(card).toHaveAttribute('aria-current', 'true');
    expect(within(card).getByText('Papel selecionado')).toBeInTheDocument();
  });

  it('leaves an unselected card without the selection marker', () => {
    renderCard(role(), false);
    const card = screen.getByRole('button', { name: /Abrir detalhes do papel/ });
    expect(card).not.toHaveAttribute('aria-current');
    expect(within(card).queryByText('Papel selecionado')).not.toBeInTheDocument();
  });

  it('shows the role kind in text for BOTH kinds, and the privilege badge only for a privileged role', () => {
    const { unmount } = render(
      <ul>
        <RoleCard
          role={role({ isSystem: true, permissions: [permission('role:administer', 'role')] })}
          selected={false}
          onSelect={vi.fn()}
        />
      </ul>,
    );
    expect(screen.getByText('Sistema')).toBeInTheDocument();
    expect(screen.getByText('Privilegiado')).toBeInTheDocument();
    unmount();

    renderCard(role({ isSystem: false, permissions: [permission('risk:view', 'risk')] }));
    expect(screen.getByText('Personalizado')).toBeInTheDocument();
    expect(screen.queryByText('Privilegiado')).not.toBeInTheDocument();
  });

  it('keeps the stored description whole in the DOM — the clamp is visual only (FR-008)', () => {
    const long =
      'Este papel concede acesso amplo à gestão de riscos corporativos, incluindo a criação, edição, avaliação, tratamento e encerramento de riscos em todas as unidades organizacionais sob sua responsabilidade.';
    renderCard(role({ description: long }));
    expect(screen.getByText(long)).toBeInTheDocument();
  });

  it('names the empty description instead of leaving a blank line', () => {
    renderCard(role({ description: '' }));
    expect(screen.getByText('Sem descrição.')).toBeInTheDocument();
  });
});

describe('RoleCard — the role name the reader sees', () => {
  it('gives a seeded role its pt-BR name, in the heading and in the accessible name', () => {
    renderCard(
      role({
        name: 'Platform Administrator',
        isSystem: true,
        permissions: [permission('role:administer', 'role')],
      }),
    );

    expect(screen.getByText('Administrador da Plataforma')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Abrir detalhes do papel Administrador da Plataforma/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Platform Administrator')).not.toBeInTheDocument();

    expect(
      screen.getByText('Administrador da Plataforma concede permissões de administração de acesso'),
    ).toBeInTheDocument();
  });

  it('prints a custom role exactly as it was typed, with no translation attempted', () => {
    renderCard(role({ name: 'Administrador da Plataforma — Filial SP', isSystem: false }));

    expect(screen.getByText('Administrador da Plataforma — Filial SP')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: /Abrir detalhes do papel Administrador da Plataforma — Filial SP/,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Personalizado')).toBeInTheDocument();
  });
});
