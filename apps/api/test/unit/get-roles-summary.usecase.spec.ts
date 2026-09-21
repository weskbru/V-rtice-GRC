/**
 * 2026-09-13 (015-roles-permissions-surface, T015) — unit tests for
 * `GetRolesSummaryUseCase` and the response mapper it feeds
 * (`contracts/admin.openapi.yaml`'s `getRolesSummary`, FR-039/FR-040).
 *
 * ## What a unit test can and cannot prove here
 *
 * It CANNOT prove `usersWithRoles` is a distinct count — that is a property
 * of the SQL in `PrismaRoleRepository.getSummaryCounts`, and only a real
 * database can answer it. `test/integration/role-summary.spec.ts` is where
 * SC-004 is actually proved, against real `user_roles` rows.
 *
 * What it CAN prove, and does: that the four numbers reach the wire in the
 * right four places. Every fixture below uses four MUTUALLY DISTINCT values
 * chosen so that no pair can be swapped without changing the result — a
 * fixture like `{2, 1, 1, 2}` would let `systemRoles`/`customRoles` trade
 * places and still pass, which is exactly the class of defect an explicit
 * mapper exists to catch (`roles-summary-response.mapper.ts`'s own header).
 */
import { describe, expect, it, vi } from 'vitest';

import { GetRolesSummaryUseCase } from '../../src/core/authorization/application/get-roles-summary.usecase';
import { toRolesSummaryResponse } from '../../src/core/authorization/presentation/dto/roles-summary-response.mapper';

import type {
  RoleRepositoryPort,
  RoleSummaryCounts,
} from '../../src/core/authorization/domain/ports/role-repository.port';

/** Four mutually distinct values, and `usersWithRoles` deliberately SMALLER
 * than `totalRoles` and unequal to any of the three role counts — so a
 * mapper that accidentally forwarded a role count into `usersWithRoles`
 * fails, rather than coincidentally agreeing. */
const COUNTS: RoleSummaryCounts = {
  totalRoles: 12,
  systemRoles: 9,
  customRoles: 3,
  usersWithRoles: 7,
};

function buildUseCase(counts: RoleSummaryCounts = COUNTS): {
  readonly useCase: GetRolesSummaryUseCase;
  readonly getSummaryCounts: ReturnType<typeof vi.fn>;
} {
  const getSummaryCounts = vi.fn().mockResolvedValue(counts);
  const repository = { getSummaryCounts } as unknown as RoleRepositoryPort;
  return { useCase: new GetRolesSummaryUseCase(repository), getSummaryCounts };
}

describe('GetRolesSummaryUseCase (015, T015, FR-039)', () => {
  it('returns exactly the four contracted fields, each carrying its own count', async () => {
    const { useCase } = buildUseCase();

    const output = await useCase.execute();

    expect(output).toEqual({
      totalRoles: 12,
      systemRoles: 9,
      customRoles: 3,
      usersWithRoles: 7,
    });
  });

  it('the response body carries the same four fields and nothing else (additionalProperties: false)', async () => {
    const { useCase } = buildUseCase();

    const response = toRolesSummaryResponse(await useCase.execute());

    // Key SET, not just values: the contract schema declares
    // `additionalProperties: false`, so a fifth field leaking out of the
    // domain shape onto the wire is a contract violation, not a harmless
    // extra.
    expect(Object.keys(response).sort()).toEqual([
      'customRoles',
      'systemRoles',
      'totalRoles',
      'usersWithRoles',
    ]);
    expect(response.totalRoles).toBe(12);
    expect(response.systemRoles).toBe(9);
    expect(response.customRoles).toBe(3);
    expect(response.usersWithRoles).toBe(7);
  });

  it('holds the invariant totalRoles = systemRoles + customRoles for whatever the repository reports', async () => {
    // Three independent aggregates in the repository (see its own header
    // for why `customRoles` is NOT derived as `total - system`), so this
    // assertion is a real property of the data, not arithmetic. The
    // integration suite asserts the same invariant against a real database.
    for (const counts of [
      { totalRoles: 12, systemRoles: 9, customRoles: 3, usersWithRoles: 7 },
      { totalRoles: 4, systemRoles: 4, customRoles: 0, usersWithRoles: 2 },
      { totalRoles: 0, systemRoles: 0, customRoles: 0, usersWithRoles: 0 },
    ] satisfies RoleSummaryCounts[]) {
      const { useCase } = buildUseCase(counts);

      const output = await useCase.execute();

      expect(output.totalRoles).toBe(output.systemRoles + output.customRoles);
    }
  });

  it('asks the repository for one aggregate, never a count per role', async () => {
    // NFR-006/A7-F07: the whole reason this endpoint exists instead of the
    // screen deriving the numbers is that the work must not grow with the
    // number of roles. One call, no arguments — there is no roleId to
    // iterate over.
    const { useCase, getSummaryCounts } = buildUseCase();

    await useCase.execute();

    expect(getSummaryCounts).toHaveBeenCalledTimes(1);
    expect(getSummaryCounts).toHaveBeenCalledWith();
  });

  it('reports a genuinely empty platform as four zeros, never as an absent field', async () => {
    const { useCase } = buildUseCase({
      totalRoles: 0,
      systemRoles: 0,
      customRoles: 0,
      usersWithRoles: 0,
    });

    const response = toRolesSummaryResponse(await useCase.execute());

    expect(response).toEqual({
      totalRoles: 0,
      systemRoles: 0,
      customRoles: 0,
      usersWithRoles: 0,
    });
  });
});
