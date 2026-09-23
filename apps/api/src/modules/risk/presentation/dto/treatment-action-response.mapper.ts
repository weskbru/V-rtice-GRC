import { isActionOverdue, todayDateOnlyUtc } from '../../../../grc/shared/domain/overdue.service';

import type { ActionRecord } from '../../../../grc/action/domain/ports/action-repository.port';
import type { ActionStatus } from '@prisma/client';

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
