import { applyScopeToWhere } from './scope-filter';

import type { ScopeFilter } from './scope-filter';

export abstract class ScopedRepository<TWhereInput extends Record<string, unknown>> {
  protected constructor(private readonly scopeField: keyof TWhereInput & string) {}

  protected applyScope(scope: ScopeFilter, where: TWhereInput): TWhereInput {
    return applyScopeToWhere(scope, this.scopeField, where);
  }

  protected withScope<TResult>(
    scope: ScopeFilter,
    where: TWhereInput,
    query: (scopedWhere: TWhereInput) => Promise<TResult>,
  ): Promise<TResult> {
    return query(this.applyScope(scope, where));
  }

  protected async resolveOrganizationalUnitIgnoringScope<
    TRow extends Partial<Record<string, unknown>> | null,
  >(probe: () => Promise<TRow>): Promise<string | undefined> {
    const row = await probe();
    if (row === null || row === undefined) {
      return undefined;
    }
    const value = row[this.scopeField];
    return typeof value === 'string' ? value : undefined;
  }
}
