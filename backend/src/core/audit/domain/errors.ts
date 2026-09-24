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

export class InvalidAuditFieldAllowlistError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAuditFieldAllowlistError';
  }
}
