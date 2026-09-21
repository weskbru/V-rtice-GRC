/**
 * T089 — `CreateRiskUseCase` (FR-053 to FR-060, FR-025c, FR-062, ADR-005,
 * ADR-006).
 *
 * ## Transaction boundary
 *
 * Like `core/sessions/application/session.service.ts`, this class never
 * imports `PrismaService` — it depends on `TransactionRunnerPort`
 * (`shared/persistence/transaction-runner.port.ts`) so the write (via
 * `RiskRepositoryPort`) and the audit entry (via `AuditRecorder`) share one
 * transaction (ADR-005) without this `application`-layer file reaching into
 * the top-level `infrastructure` element, which ADR-011 forbids here.
 *
 * ## Order of checks
 *
 * 1. The organizational unit must exist and be active (FR-059/FR-060)
 *    BEFORE the scope check — an org unit that does not exist cannot be "in
 *    scope" either, and reporting "not found" first is more informative
 *    than "out of scope" for something that never existed.
 * 2. The organizational unit must be within the caller's authorized scope
 *    (FR-025c) — refused with `422`, not `404`: unlike reading an existing
 *    out-of-scope risk (where non-disclosure applies, FR-030), there is no
 *    existing record here whose existence could be disclosed; the caller is
 *    simply told their own scope does not reach where they tried to create.
 * 3. Owner, responsible (if supplied), category/type/origin (if supplied)
 *    must each exist and be active (FR-060 referential integrity), AND the
 *    owner/responsible must be assignable to the risk's organizational unit
 *    — active, and either carrying no primary organizational unit at all or
 *    one that falls within that unit's assignment line
 *    (`core/organizations/domain/assignment-line.ts`, the single rule the
 *    read-side directory lookup, `RiskForm` and this write path now all
 *    share). A user that exists and is active but is not assignable here is
 *    refused distinctly from "not found or inactive" — same 422 family,
 *    different message — so the response never conflates the two.
 * 4. (F-CV-2) The same candidate must also be able to SEE the risk once
 *    assigned: `risk:view` AND a scope reaching `orgUnitId`, checked
 *    against the CANDIDATE, not the caller — see `assertUserAssignable`'s
 *    own header for why lineage (step 3) is not the same question as
 *    visibility, and why this never grants anything by itself.
 *
 * Every failure above is `ValidationDomainError` (422 via
 * `ProblemDetailsFilter`), matching `contracts/risks.openapi.yaml`'s
 * `createRisk` 422 branch.
 *
 * ## Code year (interpretive decision — not specified by data-model.md)
 *
 * `RSK-{year}-{sequence}`'s year is the risk's CREATION year (server clock,
 * UTC), not `identifiedOn`'s year. `identifiedOn` is a business-supplied,
 * possibly backdated field (FR-053); tying the immutable code to it would
 * let a caller choose which year's sequence a code lands in, and could
 * produce a code that looks "from the future" relative to when the record
 * was actually created. Using the creation instant is simpler, matches how
 * paper/legacy registers usually number records (by registration date), and
 * is the same choice implicitly made by every other server-generated,
 * creation-time identifier in this codebase.
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import { PermissionResolverService } from '../../../core/authorization/application/permission-resolver.service';
import { AssignmentLineService } from '../../../core/organizations/application/assignment-line.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import {
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { RiskCodeGeneratorPort } from '../domain/ports/risk-code-generator.port';
import { RiskReferenceDataPort } from '../domain/ports/risk-reference-data.port';
import { RiskRepositoryPort } from '../domain/ports/risk-repository.port';

import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type { RiskRecord } from '../domain/ports/risk-repository.port';

export interface CreateRiskInput {
  readonly actorUserId: string;
  readonly title: string;
  readonly description: string;
  readonly categoryId?: string | undefined;
  readonly typeId?: string | undefined;
  readonly originId?: string | undefined;
  readonly orgUnitId: string;
  readonly ownerUserId: string;
  readonly responsibleUserId?: string | undefined;
  /** ISO `YYYY-MM-DD`. Defaults to the current UTC date when omitted
   * (`contracts/risks.openapi.yaml`: "Defaults to the current date when
   * omitted"). */
  readonly identifiedOn?: string | undefined;
  readonly nextReviewOn?: string | undefined;
  readonly causes?: readonly string[] | undefined;
  readonly consequences?: readonly string[] | undefined;
}

@Injectable()
export class CreateRiskUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly riskRepository: RiskRepositoryPort,
    private readonly referenceData: RiskReferenceDataPort,
    private readonly codeGenerator: RiskCodeGeneratorPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly assignmentLine: AssignmentLineService,
    private readonly permissionResolver: PermissionResolverService,
    private readonly auditRecorder: AuditRecorder,
  ) {}

  async execute(input: CreateRiskInput): Promise<RiskRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      // Defensive only: `SessionGuard` already proved this user has a live
      // session, so the actor row existing is expected. Fails closed rather
      // than attributing an audit event to a fabricated label.
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    await this.assertOrgUnitCreatable(scope, input.orgUnitId);
    // FR-025c's org-unit check above already proved `input.orgUnitId` exists
    // and is active, so this resolves — the `?? new Set()` fallback is
    // defensive-only and fails closed (refuses a user WITH a primary unit;
    // never widens for one without) rather than assumed reachable.
    const assignableUnitIds =
      (await this.assignmentLine.resolveUnitIds(input.orgUnitId)) ?? new Set<string>();

    await this.assertUserAssignable(
      input.ownerUserId,
      assignableUnitIds,
      input.orgUnitId,
      USER_MESSAGES.risk.ownerNotFound,
      USER_MESSAGES.risk.ownerNotAssignable,
      USER_MESSAGES.risk.ownerNotVisible,
      'ownerUserId',
    );
    if (input.responsibleUserId) {
      await this.assertUserAssignable(
        input.responsibleUserId,
        assignableUnitIds,
        input.orgUnitId,
        USER_MESSAGES.risk.responsibleNotFound,
        USER_MESSAGES.risk.responsibleNotAssignable,
        USER_MESSAGES.risk.responsibleNotVisible,
        'responsibleUserId',
      );
    }
    if (input.categoryId) {
      await this.assertReferenceActive(
        () => this.referenceData.findCategory(input.categoryId!),
        USER_MESSAGES.risk.categoryNotFound,
        'categoryId',
      );
    }
    if (input.typeId) {
      await this.assertReferenceActive(
        () => this.referenceData.findType(input.typeId!),
        USER_MESSAGES.risk.typeNotFound,
        'typeId',
      );
    }
    if (input.originId) {
      await this.assertReferenceActive(
        () => this.referenceData.findOrigin(input.originId!),
        USER_MESSAGES.risk.originNotFound,
        'originId',
      );
    }

    const identifiedOn = input.identifiedOn ? parseIsoDate(input.identifiedOn) : startOfTodayUtc();
    const nextReviewOn = input.nextReviewOn ? parseIsoDate(input.nextReviewOn) : undefined;
    const causes = input.causes ?? [];
    const consequences = input.consequences ?? [];
    // See file header: the code's year is the creation instant, not
    // `identifiedOn`.
    const codeYear = new Date().getUTCFullYear();

    return this.transactionRunner.run(async () => {
      const code = await this.codeGenerator.nextCode(codeYear);

      const record = await this.riskRepository.create({
        code,
        title: input.title,
        description: input.description,
        categoryId: input.categoryId,
        typeId: input.typeId,
        originId: input.originId,
        orgUnitId: input.orgUnitId,
        ownerUserId: input.ownerUserId,
        responsibleUserId: input.responsibleUserId,
        identifiedOn,
        nextReviewOn,
        causes,
        consequences,
      });

      await this.auditRecorder.record({
        action: 'risk.created',
        entityType: AuditEntityType.RISK,
        entityId: record.id,
        actorLabel: actor.fullName,
        newValues: {
          title: input.title,
          description: input.description,
          categoryId: input.categoryId ?? null,
          typeId: input.typeId ?? null,
          originId: input.originId ?? null,
          orgUnitId: input.orgUnitId,
          ownerUserId: input.ownerUserId,
          responsibleUserId: input.responsibleUserId ?? null,
          identifiedOn,
          nextReviewOn: nextReviewOn ?? null,
        },
        organizationalUnitId: input.orgUnitId,
      });

      return record;
    });
  }

  private async assertOrgUnitCreatable(scope: ScopeFilter, orgUnitId: string): Promise<void> {
    const orgUnit = await this.referenceData.findOrgUnit(orgUnitId);
    if (!orgUnit?.isActive) {
      throw new ValidationDomainError(USER_MESSAGES.risk.orgUnitNotFound, [
        { field: 'orgUnitId', message: USER_MESSAGES.risk.orgUnitNotFound },
      ]);
    }

    if (!isOrgUnitWithinScope(scope, orgUnitId)) {
      throw new ValidationDomainError(USER_MESSAGES.risk.orgUnitOutOfScope, [
        { field: 'orgUnitId', message: USER_MESSAGES.risk.orgUnitOutOfScope },
      ]);
    }
  }

  /**
   * The active-user check is unchanged in behaviour and message from before
   * this rule existed. The assignability check is new: a user who exists
   * and is active but whose primary organizational unit falls outside
   * `assignmentLine` is refused distinctly, never conflated with "not found
   * or inactive". A user with no primary organizational unit at all
   * (`primaryOrgUnitId === undefined`) is assignable anywhere, matching
   * `core/organizations/domain/assignment-line.ts`'s own rule.
   *
   * ## F-CV-2 — assignment-line membership is not visibility
   *
   * A candidate can pass the assignment-line check above (their primary
   * unit sits in the risk's own lineage) and still receive a 404 the moment
   * they open the risk they were just made owner/responsible of — lineage
   * and scope are two different notions of "belongs". Visibility requires
   * `risk:view` AND a scope that reaches `orgUnitId`
   * (`AssignmentLineService.isQuestionInScope`, the exact predicate a
   * scoped read is gated by), checked against the CANDIDATE's own
   * permissions/scope, never the caller's. This grants nothing — a
   * candidate who fails this keeps failing it until someone with
   * `risk:administer` gives them an `OrgScopeGrant`; this use case only
   * refuses to hand out a responsibility the platform cannot let them see.
   */
  private async assertUserAssignable(
    userId: string,
    assignmentLine: ReadonlySet<string>,
    orgUnitId: string,
    notFoundMessage: string,
    notAssignableMessage: string,
    notVisibleMessage: string,
    field: string,
  ): Promise<void> {
    const user = await this.referenceData.findUser(userId);
    if (!user?.isActive) {
      throw new ValidationDomainError(notFoundMessage, [{ field, message: notFoundMessage }]);
    }
    if (user.primaryOrgUnitId !== undefined && !assignmentLine.has(user.primaryOrgUnitId)) {
      throw new ValidationDomainError(notAssignableMessage, [
        { field, message: notAssignableMessage },
      ]);
    }

    const [canViewRisks, candidateScope] = await Promise.all([
      this.permissionResolver.hasPermission(userId, 'risk:view'),
      this.scopeResolver.resolveScope(userId),
    ]);
    if (!canViewRisks || !this.assignmentLine.isQuestionInScope(candidateScope, orgUnitId)) {
      throw new ValidationDomainError(notVisibleMessage, [{ field, message: notVisibleMessage }]);
    }
  }

  private async assertReferenceActive(
    lookup: () => Promise<{ isActive: boolean } | undefined>,
    message: string,
    field: string,
  ): Promise<void> {
    const reference = await lookup();
    if (!reference?.isActive) {
      throw new ValidationDomainError(message, [{ field, message }]);
    }
  }
}

/** FR-025c's predicate, shared verbatim by `UpdateRiskUseCase`. Deliberately
 * NOT `OrgScopeEnforcerService.assertAccessible` (`core/organizations`),
 * which throws `NotFoundDomainError` — the right answer for reading/writing
 * an EXISTING out-of-scope record (FR-030 non-disclosure) — and, since
 * F-38's fix, is exactly what `GetRiskUseCase`/`UpdateRiskUseCase`/
 * `PerformTransitionUseCase`/the risk link use cases now do at their own
 * scoped-lookup-miss point, via
 * `OrgScopeEnforcerService.assertExistingRecordAccessible` — but the wrong
 * one here: there is no existing record to disclose the existence of, so
 * `ValidationDomainError` (422) is correct instead. */
export function isOrgUnitWithinScope(scope: ScopeFilter, orgUnitId: string): boolean {
  return scope.kind === 'GLOBAL' || scope.unitIds.has(orgUnitId);
}

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Parses an ISO `YYYY-MM-DD` (or full ISO datetime) string into a UTC
 * midnight `Date`, matching the `@db.Date` column's semantics (no time
 * component is meaningful for `identifiedOn`/`nextReviewOn`). DTO-level
 * `@IsDateString()` has already rejected anything not ISO-8601-shaped by
 * the time this runs. */
export function parseIsoDate(value: string): Date {
  const datePart = value.length > 10 ? value.slice(0, 10) : value;
  return new Date(`${datePart}T00:00:00.000Z`);
}
