/**
 * 007-implementation-remediation, Frente A, D-1/D-2/D-7 — maps the shared
 * `ActionRecord` (`grc/action/domain/ports/action-repository.port.ts`),
 * plus the link row's `treatmentDecisionId` (if any), to
 * `contracts/risks.openapi.yaml`'s `RiskTreatmentAction` wire shape. The
 * identity exposed (`id`) is now `Action.id` (D-2) — no schema change to
 * the response body itself, only to what the field identifies (see
 * `contracts/contract-changes.md` §1.1).
 *
 * `overdue` is computed here, on read, via the ONE shared predicate
 * (`grc/shared/domain/overdue.service.ts#isActionOverdue`, D-7) — never
 * stored, never a second copy of the rule.
 */
import { isActionOverdue, todayDateOnlyUtc } from '../../../../grc/shared/domain/overdue.service';

import type { ActionRecord } from '../../../../grc/action/domain/ports/action-repository.port';
import type { ActionStatus } from '@prisma/client';

/** `UserRef`'s `email` is OPTIONAL in `contracts/risks.openapi.yaml`
 * (`required: [id, fullName]`) — omitted here, never fabricated, because
 * `ActionRecord.responsible` (`UserRefRecord`, grc/action's own shape,
 * `grc/action/domain/ports/action-repository.port.ts`) does not carry an
 * email at all. The retired `RiskTreatmentActionResponsible` relation used
 * to fetch it via a risk-module-specific query (`responsibleUser: {
 * select: { id, fullName, email } }`); that query is gone with the
 * convergence (D-1) and nothing in this response needs it. */
interface ResponsibleRef {
  readonly id: string;
  readonly fullName: string;
}

export interface TreatmentActionResponse {
  readonly id: string;
  readonly treatmentDecisionId: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly responsible: ResponsibleRef;
  readonly dueOn: string;
  readonly status: ActionStatus;
  readonly overdue: boolean;
  readonly completedAt: string | null;
  readonly createdAt: string;
}

export function toTreatmentActionResponse(
  action: ActionRecord,
  treatmentDecisionId: string | null,
): TreatmentActionResponse {
  return {
    id: action.id,
    treatmentDecisionId,
    title: action.title,
    description: action.description ?? null,
    responsible: {
      id: action.responsible.id,
      fullName: action.responsible.fullName,
    },
    dueOn: toDateOnlyString(action.dueOn),
    status: action.status,
    overdue: isActionOverdue(action.dueOn, action.status, todayDateOnlyUtc()),
    completedAt: action.completedAt ? action.completedAt.toISOString() : null,
    createdAt: action.createdAt.toISOString(),
  };
}

function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}
