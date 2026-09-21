/**
 * 005-audit-findings — structural seed guard in the same shape as
 * `finding-link-permission-pairing.spec.ts` and
 * `control-link-permission-pairing.spec.ts` (see the former's header for
 * the full "why a seed-level guard, not only a runtime check" account this
 * file does not repeat), covering a pairing neither of them expresses:
 * **a role that may WRITE to a resource must be able to READ it.**
 *
 * ## The concrete defect this exists because of
 *
 * The seeded **"Audit Lead"** role shipped in `f9e5e5b` holding
 * `audit-engagement:{create,edit,scope,transition}` and
 * `finding:{create,close,remediate,link}` — and NEITHER
 * `audit-engagement:view` NOR `finding:view`. As seeded it could open an
 * engagement and then never read it back: `GET /audits`,
 * `GET /audits/{auditId}`, `GET /audits/{auditId}/findings` and
 * `POST /audits/{auditId}/findings` all refuse it (the last one folds the
 * missing `audit-engagement:view` into a `404`, so the failure does not
 * even name a permission), and the shell's "Auditoria" navigation entry —
 * gated on `audit-engagement:view` — never appeared for it at all. The
 * role's own seeded description promises the opposite: "Conduz
 * engajamentos de auditoria de ponta a ponta".
 *
 * It went unnoticed because every contract and integration test in this
 * module builds its own fixture role with exactly the permissions the case
 * under test needs, so no test ever exercised the SEEDED role's actual
 * permission set. The runtime authorization code was correct throughout —
 * the defect was only ever in the seed, which is precisely why the guard
 * belongs here rather than in a use case.
 *
 * ## Why the assertion is "write implies read", not a fixed list
 *
 * Asserting the literal expected permission array of one named role would
 * pass against the correct seed and against a future role with the same
 * mistake (CLAUDE.md §18.8's own "a test that passes against the correct
 * and the incorrect code protects nothing"). The rule generalizes to every
 * call site sharing the vulnerable pattern, as AGENTS.md requires of a
 * security-adjacent fix: any seeded role, present or future, holding any
 * write authority over these two resources must hold the matching read.
 */
import { describe, expect, it } from 'vitest';

import { SYSTEM_ROLE_DEFINITIONS } from '../../prisma/seed/platform.seed';

import type { PermissionIdentifier } from '../../src/core/authorization/domain/permissions';

/**
 * Every write authority this module introduces over an engagement, and the
 * read permission each of them presupposes. `audit-engagement:view` is the
 * gate on `getAuditEngagement`, `listAuditEngagements`,
 * `listAuditEngagementFindings` AND the first gate on
 * `createFindingFromEngagement` — so holding any of these four without it
 * yields a role that can change an engagement it cannot see.
 */
const AUDIT_ENGAGEMENT_WRITE_PERMISSIONS: readonly PermissionIdentifier[] = [
  'audit-engagement:create',
  'audit-engagement:edit',
  'audit-engagement:scope',
  'audit-engagement:transition',
];

/**
 * The finding-side equivalent. `finding:view` gates `getFinding`/
 * `listFindings`; a role that records, remediates, links or closes a
 * finding but cannot read one back is incoherent in the same way.
 */
const FINDING_WRITE_PERMISSIONS: readonly PermissionIdentifier[] = [
  'finding:create',
  'finding:close',
  'finding:remediate',
  'finding:link',
];

function rolesHoldingAnyOf(writes: readonly PermissionIdentifier[]): readonly string[] {
  return SYSTEM_ROLE_DEFINITIONS.filter((role) => {
    const permissions = new Set<string>(role.permissions);
    return writes.some((write) => permissions.has(write));
  }).map((role) => role.name);
}

function offendersMissing(
  writes: readonly PermissionIdentifier[],
  read: PermissionIdentifier,
): readonly string[] {
  return SYSTEM_ROLE_DEFINITIONS.filter((role) => {
    const permissions = new Set<string>(role.permissions);
    return writes.some((write) => permissions.has(write)) && !permissions.has(read);
  }).map((role) => role.name);
}

describe('a seeded role that may write a resource can also read it', () => {
  it('every seeded role holding any audit-engagement write authority also holds audit-engagement:view', () => {
    expect(offendersMissing(AUDIT_ENGAGEMENT_WRITE_PERMISSIONS, 'audit-engagement:view')).toEqual(
      [],
    );
  });

  it('every seeded role holding any finding write authority also holds finding:view', () => {
    expect(offendersMissing(FINDING_WRITE_PERMISSIONS, 'finding:view')).toEqual([]);
  });

  // Non-vacuity, the same third assertion the sibling pairing guards carry:
  // a rule that no seeded role can violate because none holds the write
  // authority at all would pass forever while protecting nothing.
  it('at least one seeded role actually holds audit-engagement write authority — the guard is not vacuously true', () => {
    expect(rolesHoldingAnyOf(AUDIT_ENGAGEMENT_WRITE_PERMISSIONS).length).toBeGreaterThan(0);
  });

  it('at least one seeded role actually holds finding write authority — the guard is not vacuously true', () => {
    expect(rolesHoldingAnyOf(FINDING_WRITE_PERMISSIONS).length).toBeGreaterThan(0);
  });

  // Names the specific role the defect was found in, so a regression that
  // strips its read permissions fails with a message that says which role
  // broke rather than only that "some role" did.
  it('Audit Lead can read both resources it is seeded to write', () => {
    const auditLead = SYSTEM_ROLE_DEFINITIONS.find((role) => role.name === 'Audit Lead');
    expect(auditLead).toBeDefined();

    const permissions = new Set<string>(auditLead?.permissions ?? []);
    expect(permissions.has('audit-engagement:view')).toBe(true);
    expect(permissions.has('finding:view')).toBe(true);
  });
});
