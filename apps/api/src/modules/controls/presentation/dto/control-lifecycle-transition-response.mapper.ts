/**
 * T023/003-controls-management — maps `ControlLifecycleTransitionRecord`
 * (`domain/ports/control-lifecycle-transition-repository.port.ts`) to
 * `contracts/controls.openapi.yaml`'s `ControlLifecycleTransition` wire
 * shape. The ONE place a control lifecycle transition becomes a response
 * body (ADR-009).
 */
import type { ControlUserRefResponse } from './control-response.mapper';
import type { ControlLifecycleTransitionRecord } from '../../domain/ports/control-lifecycle-transition-repository.port';
import type { ControlStatus } from '@prisma/client';

export interface ControlLifecycleTransitionResponse {
  readonly id: string;
  readonly fromStatus: ControlStatus;
  readonly toStatus: ControlStatus;
  readonly performedBy: ControlUserRefResponse;
  readonly performedAt: string;
  readonly justification: string | null;
}

export function toControlLifecycleTransitionResponse(
  record: ControlLifecycleTransitionRecord,
): ControlLifecycleTransitionResponse {
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
  };
}
