import type { UnitScopeFilter } from '../../../../shared/persistence/scope-filter';
import type { ActionOriginType } from '@prisma/client';

export interface ActionOriginAccess {
  readonly organizationalUnitId: string;
  readonly label: string;
}

export interface ActionOriginAccessor {
  resolveEditableOrigin(actorUserId: string, originId: string): Promise<ActionOriginAccess>;

  resolveViewableOrigin(actorUserId: string, originId: string): Promise<ActionOriginAccess>;

  resolveOriginScope(actorUserId: string, originId: string): Promise<ActionOriginAccess>;

  listOriginIdsInScope(scope: UnitScopeFilter): Promise<readonly string[]>;
}

export class ActionOriginTypeNotRegisteredError extends Error {
  constructor(originType: string) {
    super(
      `No action-origin accessor is registered for "${originType}". Register one with ` +
        "registerActionOriginResolver(...) from the owning module's own composition root " +
        '(see grc/shared/domain/ports/action-origin-resolver.port.ts).',
    );
    this.name = 'ActionOriginTypeNotRegisteredError';
  }
}

const registry = new Map<ActionOriginType, ActionOriginAccessor>();

export function registerActionOriginResolver(
  originType: ActionOriginType,
  accessor: ActionOriginAccessor,
): void {
  if (registry.has(originType)) {
    throw new Error(
      `Action origin type "${originType}" is already registered. Each origin type may be ` +
        'registered exactly once.',
    );
  }
  registry.set(originType, accessor);
}

export function getActionOriginAccessor(originType: ActionOriginType): ActionOriginAccessor {
  const accessor = registry.get(originType);
  if (!accessor) {
    throw new ActionOriginTypeNotRegisteredError(originType);
  }
  return accessor;
}

export function listRegisteredActionOriginTypes(): readonly ActionOriginType[] {
  return Array.from(registry.keys());
}

export function __resetActionOriginRegistryForTests(): void {
  registry.clear();
}
