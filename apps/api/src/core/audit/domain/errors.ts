/**
 * Programming-invariant errors for the audit capability (T029/T030,
 * ADR-005). None of these are `DomainError`s in the `shared/errors`
 * sense — they are not expected business outcomes a caller is meant to
 * catch and translate into an HTTP response. Each one signals a bug in the
 * *calling* code (an audited operation invoked outside a transaction, or a
 * module that never registered an allow-list, or a registration that tried
 * to allow-list a secret-shaped field), so they are left as plain `Error`
 * subclasses that are meant to escape uncaught in development/tests and to
 * surface as a 500 in production — loudly, per ADR-005's "fail loudly, not
 * silently write standalone".
 */

/**
 * Thrown by `AuditEventWriterPort` implementations when `AuditRecorder`
 * is invoked without an ambient `PrismaService` transaction (ADR-005).
 * There is no legitimate way to catch and recover from this — the fix is
 * always to wrap the audited business operation in
 * `prismaService.runInTransaction(...)`.
 */
export class AuditNotInTransactionError extends Error {
  constructor() {
    super(
      'AuditRecorder.record() was called without an active PrismaService transaction (ADR-005). ' +
        'Wrap the audited business operation — the entity write AND the AuditRecorder.record() ' +
        'call — in `prismaService.runInTransaction(async () => { ... })` so a rolled-back change ' +
        'can never leave an audit row behind, and a committed audit row can never be missing.',
    );
    this.name = 'AuditNotInTransactionError';
  }
}

/**
 * Thrown when `previousValues`/`newValues` are supplied for an
 * `AuditEntityType` that has no registered field allow-list (T030,
 * FR-035). Silently passing every field through would be exactly the
 * failure mode the allow-list exists to prevent, so an unregistered entity
 * type fails loudly instead of defaulting to "allow everything" or
 * "allow nothing" without telling anyone.
 */
export class AuditFieldAllowlistNotRegisteredError extends Error {
  constructor(entityType: string) {
    super(
      `No audit field allow-list is registered for entity type "${entityType}". Register one ` +
        'with registerAuditFieldAllowlist(...) before recording previous/new values for this ' +
        'entity type (see core/audit/domain/audit-field-allowlist.ts).',
    );
    this.name = 'AuditFieldAllowlistNotRegisteredError';
  }
}

/**
 * Thrown by `registerAuditFieldAllowlist` when the caller tries to
 * register a field whose name matches a pattern that must never be
 * eligible for an audit payload (password/token/secret/credential/hash —
 * FR-035, FR-108), or when an entity type is registered twice. Defense in
 * depth: even a future module's typo or copy-paste mistake cannot make a
 * secret-shaped field allow-listed.
 */
export class InvalidAuditFieldAllowlistError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAuditFieldAllowlistError';
  }
}
