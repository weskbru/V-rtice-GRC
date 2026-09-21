/**
 * T030 — per-`AuditEntityType` field allow-list governing what may ever
 * enter `previousValues`/`newValues` (FR-035, data-model.md §5, ADR-005).
 *
 * ## Why a registry, not a single hard-coded object literal
 *
 * ADR-011 requires that "a future module registers its own entity type's
 * allow-list without modification to its core" (mirrored in FR-038 for the
 * audit capability as a whole). A single exported `Record<AuditEntityType,
 * ...>` object literal would force every future module to edit *this*
 * file to add its own entity type — exactly the "modification to
 * `AuditRecorder`'s core" the constitution and ADR-011 forbid. Instead this
 * module exports a small mutable registry: `registerAuditFieldAllowlist`
 * is called once, by each entity type's owning module, at startup —
 * `core/audit/domain/core-entity-audit-allowlists.ts` does exactly this
 * for the ten `AuditEntityType` values that exist today, and a future
 * business module (e.g. Risk Management) calls the same function for its
 * own entity types from its own module file. Nothing here is edited to
 * add one.
 *
 * ## Why unregistered/unlisted fields fail loudly instead of degrading
 *
 * `applyAuditFieldAllowlist` is the ONLY function in the codebase allowed
 * to build the `previousValues`/`newValues` payload `AuditRecorder` hands
 * to the writer (see `audit-recorder.service.ts`) — there is no second
 * path into those columns. A field not on the allow-list is silently
 * dropped (never passed through — the one case where "fail open" would be
 * dangerous, since a caller might have merged a secret field into a
 * plain object without realizing it). An entity type with NO registered
 * allow-list at all is a different failure: that is a missing
 * registration, a programming error, not user data to be defensively
 * dropped — so it throws `AuditFieldAllowlistNotRegisteredError` rather
 * than silently allowing or silently blocking everything.
 *
 * ## Why secret-shaped field names can never be registered, even by
 * mistake
 *
 * `registerAuditFieldAllowlist` itself rejects any field name shaped like
 * a secret/credential/hash/token (`isNeverEligibleFieldName` below). This
 * is defense in depth on top of each concrete allow-list already never
 * listing `passwordHash`/`tokenHash`/etc. — even a future module's
 * copy-paste mistake cannot make a secret-shaped field eligible, because
 * the registration call itself throws before the field ever reaches the
 * registry.
 */
import { AuditFieldAllowlistNotRegisteredError, InvalidAuditFieldAllowlistError } from './errors';

import type { AuditEntityType } from '@prisma/client';

/**
 * Field-name shapes that must never be eligible for any entity type's
 * allow-list (FR-035, FR-108), regardless of what any module — present or
 * future — tries to register.
 *
 * Deliberately NOT a bare substring match on "password": several entirely
 * legitimate, non-secret fields describe password *metadata* rather than
 * carrying the secret itself — `LocalCredential.passwordChangedAt`,
 * `mustChangePassword` — and a naive `/password/i` pattern would reject
 * those too. The actual value-bearing fields in this schema
 * (`passwordHash`, `Session.tokenHash`) share a real, narrower shape: the
 * field name ENDS with `Hash`/`Secret`/`Token`/`Credential`. Case-
 * insensitive suffix match, so `passwordHash`, `PasswordHash`,
 * `oldPasswordHash`, `tokenHash`, `apiSecret`, `mfaSecret`, `refreshToken`
 * are all rejected, while `passwordChangedAt`/`mustChangePassword` are not.
 * A handful of single-word exact names (a bare `password`/`otp`/`secret`/
 * `token`/`hash`/`credential`/`apikey` field) are rejected outright too.
 */
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

/**
 * Registers the allow-listed field names for one `AuditEntityType`.
 * Called once per entity type, at application startup, by the module that
 * owns that entity type (see the file-level comment above). Throws rather
 * than silently overwriting if the entity type is already registered —
 * two modules disagreeing about one entity type's allow-list is a
 * configuration bug that must be caught immediately, not resolved by
 * "last write wins".
 */
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

/** Exposed for tests and for callers that need to know without triggering
 * the "not registered" failure path. */
export function getAuditFieldAllowlist(
  entityType: AuditEntityType,
): ReadonlySet<string> | undefined {
  return registry.get(entityType);
}

/**
 * Test-only escape hatch: clears every registration so a unit test can
 * exercise `registerAuditFieldAllowlist`/`applyAuditFieldAllowlist` from a
 * known-empty state without interference from `core-entity-audit-allowlists.ts`
 * having already run in the same process. Never called by application code.
 */
export function __resetAuditFieldAllowlistRegistryForTests(): void {
  registry.clear();
}

/**
 * Filters `values` down to only the fields registered for `entityType`.
 * Returns `undefined` for `null`/`undefined` input (nothing to audit) and
 * for a result with no surviving fields (an empty JSONB object is noise,
 * not signal). This is the ONLY sanctioned path from a caller-supplied
 * object into an audit row's `previousValues`/`newValues` — see the
 * file-level comment.
 */
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
