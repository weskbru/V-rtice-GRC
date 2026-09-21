import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

/**
 * Component-mount evidence for `RolePrivilegeBadge`
 * (015-roles-permissions-surface FR-035/FR-036, ADR-021) — the WEB half of
 * scenario 8 in `plan.md` §3.
 *
 * Scenario 8 asks for proof that the "Privilegiado" classification has no
 * effect on authorization. That proof has two halves and they are in
 * different places on purpose:
 *
 * - the SERVER half is the stronger one, and it is the absence of the
 *   concept altogether: `PermissionGuard` has no privilege branch, nothing
 *   in `apps/api` reads such a field, and the API-side guard for it is in
 *   Wave 1's tests. A classified role and an unclassified one produce the
 *   same decision because the server has never heard of the classification.
 * - the WEB half is here, and is about the badge staying a READING AID: it
 *   is computed by `isPrivilegedRole` from permissions the listing already
 *   returned (guarded in `role-privilege.test.ts`), it is presentation only,
 *   and — because a bare word cannot carry that meaning — it says in its own
 *   accessible name what it does and does not mean.
 *
 * NFR-004: the badge never signals by colour alone. It carries a shield
 * glyph, a border of its own, the word "Privilegiado" in text, and a full
 * sentence in its accessible name.
 */

import { RolePrivilegeBadge } from './role-privilege-badge';

describe('RolePrivilegeBadge', () => {
  it('prints the label as text, never as colour alone (NFR-004)', () => {
    render(<RolePrivilegeBadge roleName="Platform Administrator" />);
    expect(screen.getByText('Privilegiado')).toBeInTheDocument();
  });

  it('states what the label MEANS about this specific role, not just the bare word', () => {
    render(<RolePrivilegeBadge roleName="Platform Administrator" />);
    // A screen-reader user hearing only "Privilegiado" would have no way to
    // interpret it; the accessible text names the role and says what the
    // classification is derived from.
    expect(
      screen.getByText('Platform Administrator concede permissões de administração de acesso'),
    ).toBeInTheDocument();
  });

  it('is presentation only: it exposes no control, no input and no interactive role', () => {
    const { container } = render(<RolePrivilegeBadge roleName="Platform Administrator" />);
    // FR-036 — the classification is not persisted, not consulted by any
    // access check, and offers nothing to act on. A badge that could be
    // toggled would be the first step towards someone treating it as a rule.
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(container.querySelector('input')).toBeNull();
    expect(container.querySelector('[contenteditable]')).toBeNull();
  });

  it('names the role it is attached to, so two badges on one screen are not interchangeable', () => {
    render(
      <>
        <RolePrivilegeBadge roleName="Platform Administrator" />
        <RolePrivilegeBadge roleName="Gestor de Acessos" />
      </>,
    );
    expect(
      screen.getByText('Platform Administrator concede permissões de administração de acesso'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Gestor de Acessos concede permissões de administração de acesso'),
    ).toBeInTheDocument();
  });
});
