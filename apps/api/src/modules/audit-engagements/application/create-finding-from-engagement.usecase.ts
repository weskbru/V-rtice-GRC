/**
 * T042/005-audit-findings, User Story 2 — `CreateFindingFromEngagementUseCase`
 * (`POST /audits/{auditId}/findings`, `createFindingFromEngagement`
 * operation, FR-004, FR-007, FR-008, SC-001, research.md D-5/D-9).
 *
 * ## Delegates to `CreateFindingUseCase` — does not duplicate it
 *
 * `Finding` is a GRC-kernel capability (`grc/finding`, ADR-016), and a
 * business module depending on it directly across `grc/finding`'s own
 * `application`/`domain` layers is the SAME accepted shape
 * `eslint-plugin-boundaries` already grants every business module for
 * `grc/**` (`apps/api/eslint.config.mjs`'s own "business modules may
 * depend on the GRC kernel" rule) — the identical shape `modules/risk`
 * already uses for `grc/action`
 * (`modules/risk/application/treatment-actions/create-treatment-action.usecase.ts`).
 * This use case therefore COMPOSES `CreateFindingUseCase.execute()` rather
 * than re-implementing owner validation, org-unit validation, code
 * generation, persistence or the `finding.created` audit event a second
 * time (CLAUDE.md §19.7: one calculator, never a second copy of a business
 * rule) — the only two things this use case adds on top are (1) resolving
 * `orgUnitId` server-side from the engagement itself, never from the
 * request body (`CreateFindingFromEngagementRequest` has no `orgUnitId`
 * field at all — FR-008's own "a finding produced by an engagement can
 * never diverge from the unit being examined"), and (2) the
 * `IN_PROGRESS`-only precondition below, which `CreateFindingUseCase`
 * itself has no reason to know about.
 *
 * ## Two permissions, two different refusal shapes — mirrors
 * `ListRiskAuditEventsUseCase`
 *
 * The contract's own description: "Requires `finding:create` and
 * `audit-engagement:view` (the caller must be able to see the engagement
 * they are recording a finding for), scope over the engagement." A single
 * `@RequirePermission` decorator can only express ONE permission and
 * always refuses with `403` (`PermissionGuard`) — it cannot express "this
 * permission folds into the engagement's own 404 non-disclosure, that one
 * is a plain 403". The controller therefore marks this route
 * `@NoPermissionRequired()` (still requires a valid session) and this use
 * case performs both checks itself, in this order, exactly mirroring
 * `ListRiskAuditEventsUseCase`'s own documented shape (`modules/risk/
 * application/list-risk-audit-events.usecase.ts`):
 *
 * 1. `audit-engagement:view` — missing it, OR the engagement being out of
 *    scope, OR it not existing at all, are all folded into the SAME
 *    `NotFoundDomainError` (byte-identical `404`): `AuditEngagement` is
 *    this operation's own PRIMARY resource (this document's own header:
 *    "AuditEngagement/Finding themselves, as the PRIMARY resource of an
 *    operation, are 404"), so a caller who cannot see it at all gets
 *    exactly one outcome, never a distinguishable "it exists, you just
 *    lack the permission" signal. This is DELIBERATELY a stronger
 *    non-disclosure guarantee than ADR-020 part 5's own "referenced
 *    entity" fold-to-`422` — `AuditEngagement` here is not a
 *    referenced entity of this write, it is the route's own primary one,
 *    and 004-compliance-management/003-controls-management/this module's
 *    own convention already uses `404`, never `422`, for that case.
 * 2. `finding:create` — checked only once step 1 has succeeded; missing it
 *    is `ForbiddenDomainError` (`403`): the engagement's existence is
 *    already known to this caller by then, so refusing with `403` rather
 *    than `404` discloses nothing new.
 *
 * `assertAuditEngagementAcceptsFindings` (FR-004/FR-007) is checked AFTER
 * both permission gates — a caller without permission never learns the
 * engagement's lifecycle status either.
 */
import { Injectable } from '@nestjs/common';

import { PermissionResolverService } from '../../../core/authorization/application/permission-resolver.service';
import { CreateFindingUseCase } from '../../../grc/finding/application/create-finding.usecase';
import { ForbiddenDomainError, NotFoundDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { assertAuditEngagementAcceptsFindings } from '../domain/audit-engagement.entity';

import { AuditEngagementAccessResolver } from './audit-engagement-access-resolver.service';

import type { FindingRecord } from '../../../grc/finding/domain/ports/finding-repository.port';
import type {
  FindingCategory,
  FindingOrigin,
  FindingPriority,
  FindingSeverity,
} from '@prisma/client';

export interface CreateFindingFromEngagementInput {
  readonly actorUserId: string;
  readonly auditEngagementId: string;
  readonly title: string;
  readonly description: string;
  readonly recommendation?: string | undefined;
  readonly category: FindingCategory;
  readonly origin: FindingOrigin;
  readonly severity: FindingSeverity;
  readonly priority: FindingPriority;
  readonly ownerUserId: string;
  readonly identifiedOn: string;
}

@Injectable()
export class CreateFindingFromEngagementUseCase {
  constructor(
    private readonly accessResolver: AuditEngagementAccessResolver,
    private readonly permissionResolver: PermissionResolverService,
    private readonly createFindingUseCase: CreateFindingUseCase,
  ) {}

  async execute(input: CreateFindingFromEngagementInput): Promise<FindingRecord> {
    // 1. `audit-engagement:view` — folds into the SAME 404 the engagement's
    // own existence/scope check gives (see this file's own header).
    const canViewEngagement = await this.permissionResolver.hasPermission(
      input.actorUserId,
      'audit-engagement:view',
    );
    if (!canViewEngagement) {
      throw new NotFoundDomainError(
        USER_MESSAGES.auditEngagements.entityLabel,
        input.auditEngagementId,
      );
    }

    const { auditEngagement } = await this.accessResolver.resolveAuditEngagement(
      input.actorUserId,
      input.auditEngagementId,
    );

    // 2. `finding:create` — the engagement's existence is already known to
    // this caller at this point, so `403` discloses nothing new.
    const canCreateFinding = await this.permissionResolver.hasPermission(
      input.actorUserId,
      'finding:create',
    );
    if (!canCreateFinding) {
      throw new ForbiddenDomainError();
    }

    // FR-004/FR-007 — `PLANNING`, `COMPLETED` and `CANCELLED` all refuse.
    assertAuditEngagementAcceptsFindings(auditEngagement.status);

    // Delegates to the kernel's own creation path — see this file's header.
    // `orgUnitId` is the ENGAGEMENT's own unit, never a client-supplied
    // value (FR-008).
    return this.createFindingUseCase.execute({
      actorUserId: input.actorUserId,
      orgUnitId: auditEngagement.orgUnit.id,
      title: input.title,
      description: input.description,
      recommendation: input.recommendation,
      category: input.category,
      origin: input.origin,
      severity: input.severity,
      priority: input.priority,
      ownerUserId: input.ownerUserId,
      identifiedOn: input.identifiedOn,
      auditEngagementId: input.auditEngagementId,
    });
  }
}
