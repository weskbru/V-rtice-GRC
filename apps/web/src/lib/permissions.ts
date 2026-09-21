/**
 * PharosGRC frontend — advisory UI permission gating (T078).
 *
 * ============================================================================
 * THIS HOOK IS NOT A SECURITY BOUNDARY. IT NEVER WAS AND NEVER WILL BE.
 * ============================================================================
 *
 * Per ADR-003 and FR-026, every authorization decision in PharosGRC is made
 * exactly once, on the server, by the single `PermissionGuard` — regardless
 * of what this hook returns, regardless of whether a caller even bothers to
 * call it. `usePermissions()` exists purely so the interface can be a good
 * citizen and not dangle a "New risk" button in front of someone whose click
 * will just 403 — a courtesy, per FR-042 ("MUST NOT rely on hidden entries
 * as the access control"). Hiding or disabling a control with this hook:
 *
 *   - MUST NOT be paired with skipping the equivalent server-side check —
 *     there is no equivalent client-side check to skip; the server's guard
 *     is independent and unconditional.
 *   - MUST NOT be treated as evidence of anything in a security review —
 *     SC-006 is verified by calling the endpoint directly, bypassing the UI
 *     entirely, precisely because this hook proves nothing about what the
 *     server will accept.
 *   - Can be wrong in the user's favor for a moment (e.g. a permission
 *     revoked seconds ago, before the next `GET /auth/session` refresh) —
 *     that is acceptable ONLY because the server re-checks independently on
 *     every request (FR-028); it would not be acceptable otherwise.
 *
 * If you are about to use `hasPermission` to decide whether an action is
 * *allowed* rather than whether a control should be *shown*, stop — that
 * decision belongs in the API handler, not here.
 */
import { useMemo } from 'react';

import { useAuth } from './auth-context';

/**
 * A `resource:action` permission identifier (ADR-003 — e.g. `risk:view`,
 * `risk:approve`, `user:administer`). This is a structural check only (it
 * catches an identifier with no colon, not a typo in a real one) — the
 * platform's actual permission set is seeded server-side and not yet
 * generated into `@pharos/api-types` (T205 will replace this with that
 * generated union once it exists).
 */
export type PermissionId = `${string}:${string}`;

export interface UsePermissionsResult {
  /** The effective permission set exactly as returned by `GET /auth/session` — advisory, see module doc comment above. */
  readonly permissions: readonly string[];
  // Declared as arrow-function-typed properties, not method shorthand: these
  // are plain closures (see the object literal below), and destructuring
  // them (as callers of this hook routinely do) must not trip
  // `@typescript-eslint/unbound-method`, which method shorthand syntax would.
  readonly hasPermission: (permission: PermissionId) => boolean;
  readonly hasAnyPermission: (permissions: readonly PermissionId[]) => boolean;
  readonly hasAllPermissions: (permissions: readonly PermissionId[]) => boolean;
}

/**
 * Advisory-only UI gating hook (FR-042). See the module-level warning above
 * before using this for anything beyond "should this control render".
 */
export function usePermissions(): UsePermissionsResult {
  const { permissions } = useAuth();

  return useMemo(() => {
    const set = new Set(permissions);
    return {
      permissions,
      hasPermission: (permission) => set.has(permission),
      hasAnyPermission: (candidates) => candidates.some((permission) => set.has(permission)),
      hasAllPermissions: (candidates) => candidates.every((permission) => set.has(permission)),
    };
  }, [permissions]);
}
