import type { ControlUserRefRecord } from './control-repository.port';
import type { ControlStatus } from '@prisma/client';

export interface ControlLifecycleTransitionRecord {
  readonly id: string;
  readonly controlId: string;
  readonly fromStatus: ControlStatus;
  readonly toStatus: ControlStatus;
  readonly performedBy: ControlUserRefRecord;
  readonly performedAt: Date;
  readonly justification: string | null;
}

export interface CreateControlLifecycleTransitionInput {
  readonly controlId: string;
  readonly fromStatus: ControlStatus;
  readonly toStatus: ControlStatus;
  readonly performedByUserId: string;
  readonly justification: string | null;
}

export abstract class ControlLifecycleTransitionRepositoryPort {
  abstract create(
    input: CreateControlLifecycleTransitionInput,
  ): Promise<ControlLifecycleTransitionRecord>;
}
