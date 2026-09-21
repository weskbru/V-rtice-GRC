/**
 * T043/005-audit-findings, User Story 2 — `ListAuditEngagementFindingsUseCase`
 * (`GET /audits/{auditId}/findings`, `listAuditEngagementFindings`
 * operation, FR-007, FR-008, SC-001). Filters `Finding` by
 * `auditEngagementId` (T043's own addition to `FindingListFilter`,
 * `grc/finding/domain/ports/finding-repository.port.ts`) — organizationally
 * scoped through the SAME `AuditEngagementAccessResolver` every other use
 * case in this module calls first (F-38, FR-018), never a second
 * scope-resolution mechanism.
 *
 * ## Single permission — `finding:view` deliberately NOT re-required
 *
 * `audit.openapi.yaml`'s own description: "Requires `audit-engagement:view`
 * and scope over the engagement (`finding:view` is NOT additionally
 * required - the engagement's own scope already gates visibility of what
 * it produced, the same reasoning `getControlLifecycle` gives for not
 * re-requiring `risk:view` on a risk-scoped read elsewhere in this
 * platform)." One `@RequirePermission('audit-engagement:view')` decorator
 * on the controller route is therefore sufficient — no per-request manual
 * permission check inside this use case, unlike
 * `CreateFindingFromEngagementUseCase`'s own two-permission shape.
 *
 * ## Ordering
 *
 * Delegates entirely to `FindingRepositoryPort.list`'s own fixed order
 * (`identifiedOn desc, id asc`) — the SAME ordering every other Finding
 * listing in this platform already uses (`ListFindingUseCase`). "Newest
 * first" (the contract's own words) is satisfied by that existing order;
 * this task introduces no second, competing ordering rule for one filtered
 * view of the same table.
 */
import { Injectable } from '@nestjs/common';

import { FindingRepositoryPort } from '../../../grc/finding/domain/ports/finding-repository.port';

import { AuditEngagementAccessResolver } from './audit-engagement-access-resolver.service';

import type { FindingRecord } from '../../../grc/finding/domain/ports/finding-repository.port';
import type { FindingStatus } from '@prisma/client';

export interface ListAuditEngagementFindingsInput {
  readonly actorUserId: string;
  readonly auditEngagementId: string;
  readonly status?: FindingStatus | undefined;
  readonly page: number;
  readonly pageSize: number;
}

export interface AuditEngagementFindingsPage {
  readonly items: readonly FindingRecord[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

@Injectable()
export class ListAuditEngagementFindingsUseCase {
  constructor(
    private readonly accessResolver: AuditEngagementAccessResolver,
    private readonly findingRepository: FindingRepositoryPort,
  ) {}

  async execute(input: ListAuditEngagementFindingsInput): Promise<AuditEngagementFindingsPage> {
    // Existence + organizational scope over the engagement (the PRIMARY
    // resource of this route) — 404, indistinguishable from nonexistent,
    // when out of scope (FR-018). `finding:view` is deliberately not
    // checked here — see this file's own header.
    const { scope } = await this.accessResolver.resolveAuditEngagement(
      input.actorUserId,
      input.auditEngagementId,
    );

    const page = await this.findingRepository.list(
      scope,
      { status: input.status, auditEngagementId: input.auditEngagementId },
      input.page,
      input.pageSize,
    );

    return {
      items: page.items,
      page: page.page,
      pageSize: page.pageSize,
      total: page.total,
      totalPages: page.total === 0 ? 0 : Math.ceil(page.total / page.pageSize),
    };
  }
}
