import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Unit and component-mount evidence for `RoleDetailPanel`
 * (015-roles-permissions-surface FR-009 to FR-012, FR-026).
 *
 * ## Migrated coverage (D-07, T049)
 *
 * Two behaviours reach this file from components this phase removes:
 *
 * 1. `deleteBlockedReason` — the four cases `role-admin-columns.test.tsx`
 *    guarded. The rule moved here with the affordance it explains and was
 *    renamed `roleDeleteBlockedReason`; the rule itself did not change, and
 *    neither did its wording, so the assertions are the same four.
 * 2. The restriction NOTES `role-details-dialog.test.tsx` guarded — the
 *    system-role restriction taking precedence over the assigned-users one,
 *    and neither appearing for a deletable custom role. In the dialog they
 *    were prose paragraphs; here the same two facts are stated beside the
 *    "Excluir" control they actually govern (012 §2.5: the restriction is
 *    written out, never merely enforced by a dimmed control).
 *
 * `RoleDetailPanel` in jsdom renders its INLINE (non-modal) mode:
 * `useWideViewport` reads `matchMedia`, whose jsdom stub answers
 * `matches: true`. The overlay mode's focus trap and `Escape` belong to
 * `Sheet` and are covered in the browser (`e2e/admin-roles.spec.ts`), which
 * is the only place they are real.
 */

const { listPermissionsMock, updateRoleMock, listUsersMock } = vi.hoisted(() => ({
  listPermissionsMock: vi.fn(),
  updateRoleMock: vi.fn(),
  listUsersMock: vi.fn(),
}));

vi.mock('../../api', () => ({
  adminApi: {
    listPermissions: listPermissionsMock,
    updateRole: updateRoleMock,
    listUsers: listUsersMock,
  },
}));

import { RoleDetailPanel, roleDeleteBlockedReason } from './role-detail-panel';

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
    permissions: [permission('risk:view', 'risk')],
    ...overrides,
  };
}

function renderPanel(
  target: Role,
  overrides: Partial<{
    canManageRoles: boolean;
    canAdministerUsers: boolean;
    canManageOrgUnits: boolean;
  }> = {},
): { onDelete: ReturnType<typeof vi.fn>; onClose: ReturnType<typeof vi.fn> } {
  const onDelete = vi.fn();
  const onClose = vi.fn();
  render(
    <RoleDetailPanel
      role={target}
      canManageRoles={overrides.canManageRoles ?? true}
      canAdministerUsers={overrides.canAdministerUsers ?? false}
      canManageOrgUnits={overrides.canManageOrgUnits ?? false}
      onClose={onClose}
      onSaved={vi.fn()}
      onDelete={onDelete}
    />,
  );
  return { onDelete, onClose };
}

beforeEach(() => {
  listPermissionsMock.mockReset();
  updateRoleMock.mockReset();
  listUsersMock.mockReset();
  listPermissionsMock.mockResolvedValue([]);
});

/** Migrated verbatim from `role-admin-columns.test.tsx` — same four cases, same expected wording. */
describe('roleDeleteBlockedReason (migrated from deleteBlockedReason)', () => {
  it('returns null for a deletable custom role with no assignments', () => {
    expect(roleDeleteBlockedReason(role({ isSystem: false, assignedUserCount: 0 }))).toBeNull();
  });

  it('names the system-role restriction, taking precedence even when also assigned', () => {
    expect(roleDeleteBlockedReason(role({ isSystem: true, assignedUserCount: 5 }))).toBe(
      'Papel do sistema',
    );
  });

  it('names the assignment count in the singular for exactly one user', () => {
    expect(roleDeleteBlockedReason(role({ isSystem: false, assignedUserCount: 1 }))).toBe(
      'Atribuído a 1 usuário',
    );
  });

  it('names the assignment count in the plural for more than one user', () => {
    expect(roleDeleteBlockedReason(role({ isSystem: false, assignedUserCount: 3 }))).toBe(
      'Atribuído a 3 usuários',
    );
  });
});

describe('RoleDetailPanel — the delete affordance and its stated reasons', () => {
  it('enables "Excluir" for a deletable custom role, states no restriction, and reports the request back', () => {
    const target = role({ isSystem: false, assignedUserCount: 0 });
    const { onDelete } = renderPanel(target);

    const panel = screen.getByRole('complementary', { name: 'Detalhes do papel' });
    const deleteButton = within(panel).getByRole('button', { name: 'Excluir' });
    expect(deleteButton).toBeEnabled();
    expect(within(panel).queryByText('Papel do sistema')).not.toBeInTheDocument();
    expect(within(panel).queryByText(/^Atribuído a/)).not.toBeInTheDocument();

    fireEvent.click(deleteButton);
    expect(onDelete).toHaveBeenCalledWith(target);
  });

  it('disables "Excluir" for a system role, WRITES the reason, and never reports a request', () => {
    const { onDelete } = renderPanel(role({ isSystem: true, assignedUserCount: 5 }));
    const panel = screen.getByRole('complementary', { name: 'Detalhes do papel' });

    const deleteButton = within(panel).getByRole('button', { name: 'Excluir' });
    expect(deleteButton).toBeDisabled();
    // 012 §2.5 — the restriction is explained in words, not only enforced.
    expect(within(panel).getByText('Papel do sistema')).toBeInTheDocument();
    // The system restriction takes precedence: the role is ALSO assigned to
    // five people, and that reason must not appear alongside it.
    expect(within(panel).queryByText('Atribuído a 5 usuários')).not.toBeInTheDocument();

    fireEvent.click(deleteButton);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('disables "Excluir" for a custom role still assigned, and writes the assignment reason', () => {
    renderPanel(role({ isSystem: false, assignedUserCount: 2 }));
    const panel = screen.getByRole('complementary', { name: 'Detalhes do papel' });

    expect(within(panel).getByRole('button', { name: 'Excluir' })).toBeDisabled();
    expect(within(panel).getByText('Atribuído a 2 usuários')).toBeInTheDocument();
  });
});

describe('RoleDetailPanel — authorization gating of the panel actions (FR-026)', () => {
  it('offers neither "Editar papel" nor "Excluir" without role:administer, while the panel stays readable', () => {
    renderPanel(role(), { canManageRoles: false });
    const panel = screen.getByRole('complementary', { name: 'Detalhes do papel' });

    expect(within(panel).queryByRole('button', { name: 'Editar papel' })).not.toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument();

    // Reading is NOT gated: the same rule the removed row menu carried —
    // "Ver detalhes" was always available, "Editar"/"Excluir" were not.
    expect(within(panel).getByText('Analisa e trata riscos operacionais.')).toBeInTheDocument();
    expect(
      within(panel).getByRole('button', { name: 'Ver identificadores técnicos' }),
    ).toBeInTheDocument();
  });

  it('offers both to a caller holding role:administer', () => {
    renderPanel(role(), { canManageRoles: true });
    const panel = screen.getByRole('complementary', { name: 'Detalhes do papel' });

    expect(within(panel).getByRole('button', { name: 'Editar papel' })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Excluir' })).toBeInTheDocument();
  });

  /**
   * F-68 — `role:administer` is what the platform can delegate; owning a
   * SEEDED role is not. So the permission still opens the panel's actions,
   * and the word offered changes with what the server will actually accept.
   */
  it('replaces "Editar papel" with "Ver definição" on a system role, and writes why', () => {
    renderPanel(role({ isSystem: true }), { canManageRoles: true });
    const panel = screen.getByRole('complementary', { name: 'Detalhes do papel' });

    expect(within(panel).queryByRole('button', { name: 'Editar papel' })).not.toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Ver definição' })).toBeInTheDocument();
    expect(
      within(panel).getByText(
        'Nome, descrição e permissões são definidos pela plataforma e não podem ser alterados aqui.',
      ),
    ).toBeInTheDocument();
  });

  it('opens that definition sheet with no save control — only a way back (F-68)', () => {
    renderPanel(role({ isSystem: true }), { canManageRoles: true });
    const panel = screen.getByRole('complementary', { name: 'Detalhes do papel' });

    fireEvent.click(within(panel).getByRole('button', { name: 'Ver definição' }));

    expect(within(panel).getByText('Definição do papel')).toBeInTheDocument();
    expect(
      within(panel).queryByRole('button', { name: 'Salvar alterações' }),
    ).not.toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Voltar' })).toBeInTheDocument();

    // And it goes back to reading without asking anything to be discarded:
    // nothing could have been changed.
    fireEvent.click(within(panel).getByRole('button', { name: 'Voltar' }));
    expect(within(panel).getByRole('button', { name: 'Ver definição' })).toBeInTheDocument();
  });
});

describe('RoleDetailPanel — header', () => {
  it('shows the kind for both kinds and the privilege badge only where it applies (FR-011)', () => {
    const { unmount } = render(
      <RoleDetailPanel
        role={role({
          isSystem: true,
          name: 'Platform Administrator',
          permissions: [permission('user:administer', 'user')],
        })}
        canManageRoles
        canAdministerUsers={false}
        canManageOrgUnits={false}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    const systemPanel = screen.getByRole('complementary', { name: 'Detalhes do papel' });
    expect(within(systemPanel).getByText('Sistema')).toBeInTheDocument();
    // FR-035 — `user:administer` is one of the three access-administration
    // permissions, so this role reads as privileged.
    expect(within(systemPanel).getByText('Privilegiado')).toBeInTheDocument();
    unmount();

    renderPanel(role({ isSystem: false, permissions: [permission('risk:administer', 'risk')] }));
    const customPanel = screen.getByRole('complementary', { name: 'Detalhes do papel' });
    expect(within(customPanel).getByText('Personalizado')).toBeInTheDocument();
    // FR-035 / SC-005 — `risk:administer` administers RISKS, not access.
    // Marking it privileged would empty the signal (spec.md D-01).
    expect(within(customPanel).queryByText('Privilegiado')).not.toBeInTheDocument();
  });

  it('shows the full stored description, never a truncated one (FR-011)', () => {
    const long =
      'Este papel concede acesso amplo à gestão de riscos corporativos, incluindo criação, edição, avaliação, tratamento e encerramento de riscos em todas as unidades organizacionais sob sua responsabilidade.';
    renderPanel(role({ description: long }));
    const panel = screen.getByRole('complementary', { name: 'Detalhes do papel' });
    expect(within(panel).getByText(long)).toBeInTheDocument();
  });

  it('reports the close request back to the caller', () => {
    const { onClose } = renderPanel(role());
    const panel = screen.getByRole('complementary', { name: 'Detalhes do papel' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Fechar detalhes do papel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

/**
 * NFR-006 as it applies to the panel's own editor. `useRoleEditor` is
 * mounted while READING as well — unmounting it would unmount the `Sheet`
 * around it below `xl`, closing the overlay the moment "Editar papel" was
 * pressed — so the catalogue request is gated by its `enabled` flag instead.
 *
 * That gate was unguarded until now: removing `!enabled` from the hook's
 * effect left the whole 015 suite green, because no test opened the panel on
 * a CUSTOM role and then asserted that nothing had been fetched. Written
 * here when the create panel made `enabled` load-bearing in a second place.
 */
describe('RoleDetailPanel — reading costs no catalogue request (NFR-006)', () => {
  it('fetches the permission catalogue only once editing actually starts', async () => {
    renderPanel(role({ isSystem: false }), { canManageRoles: true });
    const panel = screen.getByRole('complementary', { name: 'Detalhes do papel' });

    // Reading a custom role: the whole catalogue is of no use yet.
    await waitFor(() => expect(listPermissionsMock).not.toHaveBeenCalled());

    fireEvent.click(within(panel).getByRole('button', { name: 'Editar papel' }));

    await waitFor(() => expect(listPermissionsMock).toHaveBeenCalledTimes(1));
  });
});

/**
 * ADR-022 — the panel names a role in pt-BR, and keeps the value the server
 * stores one click away instead of one grep away.
 *
 * The traceability half is the point of this block: a screen that shows only
 * "Administrador da Plataforma" leaves an administrator unable to name the
 * role they are reading when they open an API response, an audit entry or a
 * runbook. It rides the SAME control that reveals `risk:view` beside each
 * permission (FR-016) — one technical-disclosure mode for the panel, not two.
 */
describe('RoleDetailPanel — the role name, and the stored name behind it', () => {
  it('heads the panel with the pt-BR name of a seeded role', () => {
    renderPanel(role({ name: 'Compliance Manager', isSystem: true }));
    const panel = screen.getByRole('complementary', { name: 'Detalhes do papel' });

    expect(
      within(panel).getByRole('heading', { name: 'Gestor de Compliance' }),
    ).toBeInTheDocument();
  });

  it('reveals the stored Role.name with "Ver identificadores técnicos", and hides it again', () => {
    renderPanel(role({ name: 'Compliance Manager', isSystem: true }));
    const panel = screen.getByRole('complementary', { name: 'Detalhes do papel' });

    // Closed by default: the identifier is available on demand, never by
    // default (FR-016, and the same rule applied to the name).
    expect(within(panel).queryByText('Compliance Manager')).not.toBeInTheDocument();

    fireEvent.click(within(panel).getByRole('button', { name: 'Ver identificadores técnicos' }));

    expect(within(panel).getByText('Nome técnico:')).toBeInTheDocument();
    expect(within(panel).getByText('Compliance Manager')).toBeInTheDocument();
    // The heading did not change: the label is not replaced by the identifier.
    expect(
      within(panel).getByRole('heading', { name: 'Gestor de Compliance' }),
    ).toBeInTheDocument();

    fireEvent.click(
      within(panel).getByRole('button', { name: 'Ocultar identificadores técnicos' }),
    );
    expect(within(panel).queryByText('Compliance Manager')).not.toBeInTheDocument();
  });

  it('heads the panel with a custom role name exactly as stored, and says so when asked', () => {
    renderPanel(role({ name: 'Equipe de Resposta — Filial SP', isSystem: false }));
    const panel = screen.getByRole('complementary', { name: 'Detalhes do papel' });

    expect(
      within(panel).getByRole('heading', { name: 'Equipe de Resposta — Filial SP' }),
    ).toBeInTheDocument();

    fireEvent.click(within(panel).getByRole('button', { name: 'Ver identificadores técnicos' }));

    // Shown for a custom role too: seeing the label and the stored value
    // agree is itself the answer to "is this a translation?".
    expect(within(panel).getByText('Nome técnico:')).toBeInTheDocument();
    expect(
      within(panel).getAllByText('Equipe de Resposta — Filial SP').length,
    ).toBeGreaterThanOrEqual(2);
  });
});
