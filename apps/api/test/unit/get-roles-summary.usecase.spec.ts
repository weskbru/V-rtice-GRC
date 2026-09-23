import { describe, expect, it, vi } from 'vitest';

import { GetRolesSummaryUseCase } from '../../src/core/authorization/application/get-roles-summary.usecase';
import { toRolesSummaryResponse } from '../../src/core/authorization/presentation/dto/roles-summary-response.mapper';

import type {
  RoleRepositoryPort,
  RoleSummaryCounts,
} from '../../src/core/authorization/domain/ports/role-repository.port';

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
