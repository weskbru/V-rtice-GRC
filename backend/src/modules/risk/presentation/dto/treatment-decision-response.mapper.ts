import { todayDateOnlyUtc } from '../../../../grc/shared/domain/overdue.service';

import type { UserRefResponse } from './risk-response.mapper';
import type { TreatmentDecisionRecord } from '../../domain/ports/risk-treatment-decision-repository.port';
import type { TreatmentStrategy } from '@prisma/client';

export interface TreatmentDecisionResponse {
  readonly id: string;
  readonly strategy: TreatmentStrategy;
  readonly description: string;
  readonly deadline: string | null;
  readonly decidedBy: UserRefResponse;
  readonly decidedAt: string;
  readonly supersededAt: string | null;
  readonly deadlineOverdue: boolean;
}

export function toTreatmentDecisionResponse(
  record: TreatmentDecisionRecord,
  hasOutstandingActions: boolean,
): TreatmentDecisionResponse {
  const deadlinePassed =
    record.deadline !== null && record.deadline.getTime() < todayDateOnlyUtc().getTime();

  return {
    id: record.id,
    strategy: record.strategy,
    description: record.description,
    deadline: record.deadline ? toDateOnlyString(record.deadline) : null,
    decidedBy: {
      id: record.decidedBy.id,
      fullName: record.decidedBy.fullName,
      email: record.decidedBy.email,
    },
    decidedAt: record.decidedAt.toISOString(),
    supersededAt: record.supersededAt ? record.supersededAt.toISOString() : null,
    deadlineOverdue: deadlinePassed && hasOutstandingActions,
  };
}

function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}
