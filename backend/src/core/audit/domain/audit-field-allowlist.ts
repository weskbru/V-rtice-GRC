import { AuditFieldAllowlistNotRegisteredError, InvalidAuditFieldAllowlistError } from './errors';

import type { AuditEntityType } from '@prisma/client';

const NEVER_ELIGIBLE_FIELD_NAME_SUFFIX_PATTERN = /(?:hash|secret|token|credential)$/i;
const NEVER_ELIGIBLE_EXACT_FIELD_NAMES = new Set([
  'password',
  'otp',
  'secret',
  'token',
  'hash',
  'credential',
  'apikey',
  'api_key',
]);

function isNeverEligibleFieldName(field: string): boolean {
  return (
    NEVER_ELIGIBLE_FIELD_NAME_SUFFIX_PATTERN.test(field) ||
    NEVER_ELIGIBLE_EXACT_FIELD_NAMES.has(field.toLowerCase())
  );
}

const registry = new Map<AuditEntityType, ReadonlySet<string>>();

export function registerAuditFieldAllowlist(
  entityType: AuditEntityType,
  fields: readonly string[],
): void {
  if (registry.has(entityType)) {
    throw new InvalidAuditFieldAllowlistError(
      `Audit field allow-list for entity type "${entityType}" is already registered. ` +
        'Each entity type may be registered exactly once — extend the allow-list at its ' +
        'original registration site instead of registering it again.',
    );
  }

  const rejected = fields.filter((field) => isNeverEligibleFieldName(field));
  if (rejected.length > 0) {
    throw new InvalidAuditFieldAllowlistError(
      `Refusing to register audit field allow-list for "${entityType}": field(s) ` +
        `${rejected.map((field) => `"${field}"`).join(', ')} look like secrets/credentials/hashes ` +
        'and may never be eligible for an audit payload (FR-035, FR-108).',
    );
  }

  registry.set(entityType, new Set(fields));
}

export function getAuditFieldAllowlist(
  entityType: AuditEntityType,
): ReadonlySet<string> | undefined {
  return registry.get(entityType);
}

export function __resetAuditFieldAllowlistRegistryForTests(): void {
  registry.clear();
}

export function applyAuditFieldAllowlist(
  entityType: AuditEntityType,
  values: Readonly<Record<string, unknown>> | null | undefined,
): Record<string, unknown> | undefined {
  if (values === null || values === undefined) {
    return undefined;
  }

  const allowlist = registry.get(entityType);
  if (!allowlist) {
    throw new AuditFieldAllowlistNotRegisteredError(entityType);
  }

  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (allowlist.has(key)) {
      filtered[key] = value;
    }
  }

  return Object.keys(filtered).length > 0 ? filtered : undefined;
}
