export type ScopeFilterKind = 'GLOBAL' | 'UNIT';

export interface GlobalScopeFilter {
  readonly kind: 'GLOBAL';
}

export interface UnitScopeFilter {
  readonly kind: 'UNIT';
  readonly unitIds: ReadonlySet<string>;
}

export type ScopeFilter = GlobalScopeFilter | UnitScopeFilter;

export function emptyScope(): UnitScopeFilter {
  return { kind: 'UNIT', unitIds: new Set<string>() };
}

export function globalScope(): GlobalScopeFilter {
  return { kind: 'GLOBAL' };
}

export function unitScope(unitIds: ReadonlySet<string> | readonly string[]): UnitScopeFilter {
  return { kind: 'UNIT', unitIds: unitIds instanceof Set ? unitIds : new Set(unitIds) };
}

export function applyScopeToWhere<TWhere extends Record<string, unknown>>(
  scope: ScopeFilter,
  scopeField: keyof TWhere & string,
  where: TWhere,
): TWhere {
  if (scope.kind === 'GLOBAL') {
    return where;
  }

  return {
    ...where,
    [scopeField]: { in: Array.from(scope.unitIds) },
  };
}
