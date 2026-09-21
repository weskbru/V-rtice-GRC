/**
 * T026/004-compliance-management — domain rules that live WITH the
 * `Requirement` entity (data-model.md §3, FR-003/FR-004/FR-007). Pure
 * domain logic: no I/O, no Prisma, no framework import.
 */
import { isFrameworkVersionEditable } from './framework-version-lifecycle';

import type { FrameworkVersionStatus } from '@prisma/client';

/**
 * `true` only while the PARENT version is `DRAFT` (FR-004) — a clause is
 * born and dies with its version's draft state. Delegates to
 * `isFrameworkVersionEditable` rather than re-declaring the rule: a
 * requirement's editability and its parent version's own editability are,
 * by FR-004's own wording, literally the same fact viewed from two
 * entities, never two independent rules that could drift.
 *
 * This is the APPLICATION-level half of the guarantee — the checkpoint
 * `UpdateRequirementUseCase` consults before ever issuing a write. The
 * REAL guarantee is the `requirements_immutable_after_publish` database
 * trigger (research.md D-4, T006), which rejects the same write even if
 * this function is bypassed entirely (a raw SQL statement, a future use
 * case that forgets to call this). Neither guard substitutes for the
 * other — `requirement-immutability-trigger.spec.ts` (T028) and
 * `update-requirement-refused-after-publish.spec.ts` (T029) test them
 * separately, on purpose.
 */
export function isRequirementEditable(parentVersionStatus: FrameworkVersionStatus): boolean {
  return isFrameworkVersionEditable(parentVersionStatus);
}
