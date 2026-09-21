/**
 * T020/003-controls-management — port for the append-only
 * `ControlLifecycleTransition` table. Added during this task's own
 * implementation because the contract's `getControlLifecycle`/
 * `transitionControl` operations reference a `ControlLifecycleTransition`
 * schema that `data-model.md` never defines a table for — see this task's
 * report and `schema.prisma`'s own `ControlLifecycleTransition` model
 * header for the full account of that gap. Mirrors
 * `modules/risk/domain/ports/risk-lifecycle-transition-repository.port.ts`
 * exactly, minus `approvalId`/`findMostRecentInto`: Controls' lifecycle has
 * no approval-gated transition (D-6's own "Descartado explicitamente: um
 * estado PENDING_APPROVAL") and no precondition needs lifecycle HISTORY —
 * `HAS_OWNER`/`HAS_JUSTIFICATION` (`domain/control-lifecycle.ts`) are both
 * decided from the CURRENT record plus the incoming request alone.
 *
 * `PerformControlTransitionUseCase` depends on this abstract class, never
 * on `PrismaService` directly (ADR-011).
 * `infrastructure/control-lifecycle-transition.repository.ts` is the only
 * implementation.
 */
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
  /** Pure insert — no scope predicate: the caller has already resolved and
   * scope-checked the parent `Control` via `ControlRepositoryPort.findById`
   * before this is ever called (same reasoning as
   * `RiskLifecycleTransitionRepositoryPort.create`'s own doc comment). */
  abstract create(
    input: CreateControlLifecycleTransitionInput,
  ): Promise<ControlLifecycleTransitionRecord>;
}
