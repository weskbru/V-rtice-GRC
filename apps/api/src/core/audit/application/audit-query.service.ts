/**
 * T168/US7 — `AuditQueryService`: the reusable, permission-and-scope-
 * agnostic-by-design audit query engine (core-application depends only on
 * `AuditEventReaderPort`, never `PrismaService` directly — ADR-011).
 *
 * Deliberately thin: permission enforcement (`audit:view`) and the
 * entity-existence/visibility check that decides 404 vs 403 for a specific
 * business entity are NOT this service's job — they require knowing about
 * the calling module's own entities (e.g. "does this risk exist, is it in
 * scope"), which `core/audit` must never import (ADR-011: "core/** never
 * imports modules/**", enforced by `apps/api/eslint.config.mjs`'s boundary
 * lint). Those checks live in the calling module's own use case
 * (`modules/risk/application/list-risk-audit-events.usecase.ts`) — see
 * that file's header for the full reasoning, including why its OWN HTTP
 * controller could not live under `core/audit/presentation/` as this
 * task's sheet named, despite this service satisfying the sheet's
 * "audit query API filtered by permission and scope" in substance (the
 * `scope: ScopeFilter` parameter below IS applied, unconditionally, against
 * `audit_event.organizationalUnitId` — the permission/scope filtering this
 * service owns is real, just not the whole story for a specific,
 * existence-sensitive endpoint).
 */
import { Injectable } from '@nestjs/common';

import { AuditEventReaderPort } from '../domain/ports/audit-event-reader.port';

import type { AuditEventQuery, AuditEventPage } from '../domain/ports/audit-event-reader.port';

@Injectable()
export class AuditQueryService {
  constructor(private readonly reader: AuditEventReaderPort) {}

  async query(input: AuditEventQuery): Promise<AuditEventPage> {
    return this.reader.query(input);
  }
}
