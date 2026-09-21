/**
 * T086 — domain rules that live WITH the `Risk` entity, not in a controller
 * or use case (data-model.md §8's own instruction: "the check lives in the
 * domain" for FR-084). Pure domain logic: no I/O, no Prisma, no framework
 * import — `RiskStatus` is imported only as a TYPE from `@prisma/client`,
 * the same accepted pattern already established by
 * `core/audit/domain/audit-event.types.ts` (`AuditOutcome`) and
 * `core/authorization/domain/permissions.ts` (`PermissionAction`): business
 * vocabulary fixed by the specification, not a persistence detail, with no
 * separate hand-maintained enum to duplicate it into.
 *
 * Every assertion here throws a `shared/errors/domain-error.ts` type
 * directly — `shared/**` may be imported by every layer (ADR-011), so the
 * domain throwing the final, presentation-ready error type is not a
 * boundary violation; `core/organizations/application/org-scope-enforcer
 * .service.ts` already establishes the same pattern one layer up.
 */
import {
  ValidationDomainError,
  type ValidationFieldError,
} from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';

import type { RiskStatus } from '@prisma/client';

/** Statuses in which a risk's business content (title, description,
 * classification, ownership, dates, causes, consequences) may no longer be
 * edited (FR-084). Lifecycle/administrative operations (archival) are a
 * later phase and are not "business content" in this sense. */
const BUSINESS_CONTENT_LOCKED_STATUSES: ReadonlySet<RiskStatus> = new Set(['CLOSED', 'ARCHIVED']);

/**
 * FR-084 — refuses editing business content on a `CLOSED` or `ARCHIVED`
 * risk while the record remains readable (the caller never reaches this
 * function for a `GET`, only for a write). Throws `ValidationDomainError`
 * (422 via `ProblemDetailsFilter`), matching
 * `contracts/risks.openapi.yaml`'s `updateRisk` 422 branch: "Risks in
 * CLOSED or ARCHIVED reject business-content updates with 422 while
 * remaining readable".
 */
export function assertBusinessContentEditable(status: RiskStatus): void {
  if (BUSINESS_CONTENT_LOCKED_STATUSES.has(status)) {
    throw new ValidationDomainError(USER_MESSAGES.risk.businessContentLocked, [
      { field: 'status', message: USER_MESSAGES.risk.businessContentLocked },
    ]);
  }
}

/** The fields FR-055 requires before a risk may leave `DRAFT`. Every field
 * is the value the risk WOULD have after the pending write — a caller
 * building this from "current record + incoming changes" merges them
 * before calling `assertCanLeaveDraft`. */
export interface DraftCompletenessInput {
  readonly title: string | null | undefined;
  readonly description: string | null | undefined;
  readonly categoryId: string | null | undefined;
  readonly orgUnitId: string | null | undefined;
  readonly ownerUserId: string | null | undefined;
}

/**
 * FR-055 — "leaving DRAFT requires title, description, category,
 * organizational unit and owner". Pure, non-throwing gap computation —
 * factored out of `assertCanLeaveDraft` (below) so it can ALSO be used by
 * `domain/transition-preconditions.ts`'s `DRAFT_FIELDS_COMPLETE` evaluator
 * (T155/US6), which needs a `met`/`unmet` ANSWER for the `GET
 * /risks/{riskId}/lifecycle` preview (FR-082) rather than a thrown
 * exception — the SAME rule, computed once, consumed two ways.
 */
export function findDraftCompletenessGaps(
  input: DraftCompletenessInput,
): readonly ValidationFieldError[] {
  const errors: ValidationFieldError[] = [];

  if (!input.title || input.title.trim().length === 0) {
    errors.push({ field: 'title', message: USER_MESSAGES.risk.draftIncomplete.title });
  }
  if (!input.description || input.description.trim().length === 0) {
    errors.push({ field: 'description', message: USER_MESSAGES.risk.draftIncomplete.description });
  }
  if (!input.categoryId) {
    errors.push({ field: 'categoryId', message: USER_MESSAGES.risk.draftIncomplete.category });
  }
  if (!input.orgUnitId) {
    errors.push({ field: 'orgUnitId', message: USER_MESSAGES.risk.draftIncomplete.orgUnit });
  }
  if (!input.ownerUserId) {
    errors.push({ field: 'ownerUserId', message: USER_MESSAGES.risk.draftIncomplete.owner });
  }

  return errors;
}

/**
 * FR-055 — "leaving DRAFT requires title, description, category,
 * organizational unit and owner". Not invoked by the create/update use
 * cases in this phase (creation always starts in `DRAFT`, per
 * `contracts/risks.openapi.yaml`'s `createRisk`, and business-content
 * update never itself changes `status`) — published now, alongside
 * `assertBusinessContentEditable`, so the future lifecycle-transition use
 * case (US6, "leave DRAFT") calls it without this rule needing to be
 * invented later or duplicated outside the domain.
 */
export function assertCanLeaveDraft(input: DraftCompletenessInput): void {
  const errors = findDraftCompletenessGaps(input);

  if (errors.length > 0) {
    throw new ValidationDomainError(USER_MESSAGES.risk.draftIncomplete.title, errors);
  }
}
