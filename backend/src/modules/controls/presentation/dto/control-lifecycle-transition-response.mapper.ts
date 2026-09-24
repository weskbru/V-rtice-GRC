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
