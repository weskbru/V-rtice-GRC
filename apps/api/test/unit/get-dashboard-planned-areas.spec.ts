/**
 * F-22 defect 2 — unit test proving `GET /dashboard`'s `plannedAreas` are
 * sourced from `core/dashboard/domain/planned-area-registry.ts`, not a
 * closed union/literal array owned by Risk Management
 * (`modules/risk/application/get-dashboard.usecase.ts` used to declare
 * `type PlannedAreaKey = 'PROBLEMS' | 'INCIDENTS' | 'CONTROLS'` and a
 * matching `PLANNED_AREAS` array directly).
 *
 * The test registers a planned area the exact way a FUTURE module's own
 * composition root would — a bare call to `registerPlannedArea(...)` from
 * OUTSIDE `modules/risk` and outside `core/**`'s own default registration
 * — and asserts it reaches `GetDashboardUseCase.execute()`'s output
 * without editing `modules/risk` or `core/dashboard` to know about it.
 * This is SC-011's property, exercised directly rather than through a
 * whole second business module and a real HTTP round trip.
 */
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

/** A zero-permission caller never reaches `DashboardQueryPort` (see
 * `GetDashboardUseCase`'s own header) — a stub that throws if called is
 * therefore a stronger assertion than a mock nobody inspects. */
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
    // Simulates a future module's own composition root — e.g. a
    // hypothetical `ProblemsModule` constructor — calling this registry
    // directly, exactly like `RiskModule` registers its own audit
    // allow-list and collaboration entity type from its own file, never
    // from `core/**`.
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
