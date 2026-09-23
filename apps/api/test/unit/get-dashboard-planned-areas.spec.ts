import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  __resetPlannedAreaRegistryForTests,
  getPlannedAreas,
  registerPlannedArea,
} from '../../src/core/dashboard/domain/planned-area-registry';
import { GetDashboardUseCase } from '../../src/modules/risk/application/get-dashboard.usecase';

import type { PermissionResolverService } from '../../src/core/authorization/application/permission-resolver.service';
import type { ScopeResolverService } from '../../src/core/organizations/application/scope-resolver.service';
import type { DashboardQueryPort } from '../../src/modules/risk/domain/ports/dashboard-query.port';

const unreachableDashboardQuery = new Proxy(
  {},
  {
    get() {
      throw new Error('DashboardQueryPort must not be called for a zero-permission caller.');
    },
  },
) as DashboardQueryPort;

function buildUseCase(): GetDashboardUseCase {
  const scopeResolver = {
    resolveScope: vi.fn().mockResolvedValue({ kind: 'GLOBAL' }),
  } as unknown as ScopeResolverService;
  const permissionResolver = {
    getEffectivePermissions: vi.fn().mockResolvedValue(new Set()),
  } as unknown as PermissionResolverService;

  return new GetDashboardUseCase(unreachableDashboardQuery, scopeResolver, permissionResolver);
}

describe('GetDashboardUseCase.plannedAreas sourced from the registry, not a literal (F-22 defect 2)', () => {
  afterEach(() => {
    __resetPlannedAreaRegistryForTests();
  });

  it('returns exactly what is registered — nothing, when nothing is registered', async () => {
    const useCase = buildUseCase();
    const output = await useCase.execute({ actorUserId: 'user-1' });
    expect(output.plannedAreas).toEqual([]);
  });

  it('a planned area registered from OUTSIDE modules/risk and outside core/dashboard appears in the output', async () => {
    registerPlannedArea({ key: 'PROBE_AREA', label: 'Área de sondagem (teste)' });

    const useCase = buildUseCase();
    const output = await useCase.execute({ actorUserId: 'user-1' });

    expect(output.plannedAreas).toEqual([
      { key: 'PROBE_AREA', label: 'Área de sondagem (teste)', status: 'PLANNED' },
    ]);
  });

  it('every registered area is present regardless of the caller having zero permissions (FR-050/SC-013: no permission question arises)', async () => {
    registerPlannedArea({ key: 'PROBE_AREA', label: 'Área de sondagem (teste)' });

    const useCase = buildUseCase();
    const output = await useCase.execute({ actorUserId: 'zero-permission-user' });

    expect(output.plannedAreas.map((area) => area.key)).toEqual(['PROBE_AREA']);
  });

  it('the registry itself refuses two registrants disagreeing about the same key', () => {
    registerPlannedArea({ key: 'PROBE_AREA', label: 'Primeiro' });
    expect(() => registerPlannedArea({ key: 'PROBE_AREA', label: 'Segundo' })).toThrow(
      /already registered/,
    );
  });

  it('getPlannedAreas() reflects registrations made after it was first imported (not a decoration-time snapshot)', () => {
    expect(getPlannedAreas()).toEqual([]);
    registerPlannedArea({ key: 'PROBE_AREA', label: 'Área de sondagem (teste)' });
    expect(getPlannedAreas()).toEqual([{ key: 'PROBE_AREA', label: 'Área de sondagem (teste)' }]);
  });
});
