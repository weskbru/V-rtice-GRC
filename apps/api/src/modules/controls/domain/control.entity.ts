/**
 * T018/003-controls-management — domain rules that live WITH the `Control`
 * entity (data-model.md §1, FR-004/FR-005/FR-006). Pure domain logic: no
 * I/O, no Prisma, no framework import — `ControlStatus` is imported only
 * as a TYPE from `@prisma/client`, the same accepted pattern
 * `modules/risk/domain/risk.entity.ts`'s own header documents.
 */
import type { ControlStatus } from '@prisma/client';

/**
 * T019 — the SINGLE point that decides what `controls.is_active` must be
 * for a given `status` (data-model.md §1: "`is_active` é mantido em
 * sincronia por um único ponto de escrita ... um segundo ponto que
 * escrevesse `is_active` recriaria a divergência que esta fase inteira
 * existe para eliminar").
 *
 * `false` only for `RETIRED`; `true` for every other status (`DRAFT`,
 * `ACTIVE`, `SUSPENDED`) — this is exactly the reading `modules/risk`'s
 * `ControlDirectoryPort`-mediated `isActive` check
 * (`control?.isActive`, `LinkControlUseCase`) already had under the Fase 1
 * minimal registry (where every control defaulted to `isActive: true` and
 * nothing ever flipped it), extended so a control retired under THIS
 * fase's lifecycle also reads as inactive to that same check, without
 * `modules/risk` changing at all.
 *
 * The future write path (`PerformControlTransitionUseCase`, T021, out of
 * this task's scope) MUST derive `isActive` from this function on every
 * write that changes `status` — never compute or hard-code it separately.
 * That is what "único ponto" means in practice: one function, one call
 * site, forever. `control-lifecycle.spec.ts` (T019's own test) proves this
 * is the only place in `apps/api/src` that contains this rule.
 */
export function isActiveForControlStatus(status: ControlStatus): boolean {
  return status !== 'RETIRED';
}
