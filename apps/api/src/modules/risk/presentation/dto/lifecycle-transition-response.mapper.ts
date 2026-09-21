/**
 * T158 — maps `LifecycleTransitionRecord`
 * (`domain/ports/risk-lifecycle-transition-repository.port.ts`) to
 * `contracts/risks.openapi.yaml`'s `RiskLifecycleTransition` wire shape.
 * The ONE place a lifecycle transition becomes a response body (ADR-009).
 */
import type { UserRefResponse } from './risk-response.mapper';
import type { LifecycleTransitionRecord } from '../../domain/ports/risk-lifecycle-transition-repository.port';
import type { RiskStatus } from '@prisma/client';

export interface LifecycleTransitionResponse {
  readonly id: string;
  readonly fromStatus: RiskStatus;
  readonly toStatus: RiskStatus;
  readonly performedBy: UserRefResponse;
  readonly performedAt: string;
  readonly justification: string | null;
  readonly approvalId: string | null;
}

export function toLifecycleTransitionResponse(
  record: LifecycleTransitionRecord,
): LifecycleTransitionResponse {
  return {
    id: record.id,
    fromStatus: record.fromStatus,
    toStatus: record.toStatus,
    performedBy: {
      id: record.performedBy.id,
      fullName: record.performedBy.fullName,
      email: record.performedBy.email,
    },
    performedAt: record.performedAt.toISOString(),
    justification: record.justification,
    approvalId: record.approvalId,
  };
}
