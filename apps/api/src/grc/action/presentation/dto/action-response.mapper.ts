/**
 * T053/002-shared-grc-foundation, US2 — maps `ActionWithDerived`
 * (`application/get-action.usecase.ts`) to the wire shape
 * `contracts/grc-foundation.openapi.yaml`'s `Action` schema describes. ONE
 * mapper is the only place a domain object becomes this DTO (ADR-009),
 * mirroring `evidence-response.mapper.ts`'s discipline.
 *
 * `overdue` and `originLabel` are both computed/resolved upstream (by
 * `GetActionUseCase`/`ListActionUseCase`) — this mapper only shapes what it
 * is given, never re-derives either.
 */
import type { ActionWithDerived } from '../../application/get-action.usecase';
import type { ActionOriginType, ActionStatus } from '@prisma/client';

export interface OrgUnitRefResponse {
  readonly id: string;
  readonly name: string;
}

export interface UserRefResponse {
  readonly id: string;
  readonly fullName: string;
}

export interface ActionResponse {
  readonly id: string;
  readonly code: string;
  readonly orgUnit: OrgUnitRefResponse;
  readonly originType: ActionOriginType;
  readonly originId: string;
  readonly originLabel: string | undefined;
  readonly title: string;
  readonly description: string | null;
  readonly responsible: UserRefResponse;
  readonly dueOn: string;
  readonly status: ActionStatus;
  readonly overdue: boolean;
  readonly completedAt: string | null;
  readonly reopenedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toActionResponse(record: ActionWithDerived): ActionResponse {
  return {
    id: record.id,
    code: record.code,
    orgUnit: { id: record.orgUnit.id, name: record.orgUnit.name },
    originType: record.originType,
    originId: record.originId,
    originLabel: record.originLabel,
    title: record.title,
    description: record.description ?? null,
    responsible: { id: record.responsible.id, fullName: record.responsible.fullName },
    dueOn: toDateOnly(record.dueOn),
    status: record.status,
    overdue: record.overdue,
    completedAt: record.completedAt ? record.completedAt.toISOString() : null,
    reopenedAt: record.reopenedAt ? record.reopenedAt.toISOString() : null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}
