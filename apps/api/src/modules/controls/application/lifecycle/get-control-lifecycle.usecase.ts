/**
 * T020/003-controls-management — `GetControlLifecycleUseCase`: the read
 * side of `GET /controls/{controlId}/lifecycle` (`getControlLifecycle`
 * operation, D-6, FR-004). Mirrors
 * `modules/risk/application/lifecycle/get-risk-lifecycle.usecase.ts`'s
 * structure — see that file's header for the "filter by BOTH current
 * state and the caller's permissions" reasoning this one does not repeat.
 *
 * ## `HAS_JUSTIFICATION` in a PREVIEW context
 *
 * This endpoint evaluates `domain/control-lifecycle.ts`'s preconditions
 * against a `ControlTransitionContext` built from the CURRENT record alone
 * — there is no request body here to read a candidate `justification`
 * from. `HAS_JUSTIFICATION` therefore always evaluates unmet in this
 * preview (`justification: undefined`), which is the honest answer: a
 * caller previewing the record has not yet decided what to write, and the
 * contract's own "advisory: the server re-evaluates on every transition
 * request" note is exactly what makes that acceptable — `POST
 * .../transitions` is the actual, authoritative check, evaluated against
 * whatever the caller actually supplies.
 */
import { Injectable } from '@nestjs/common';

import { PermissionResolverService } from '../../../../core/authorization/application/permission-resolver.service';
import { ScopeResolverService } from '../../../../core/organizations/application/scope-resolver.service';
import { NotFoundDomainError } from '../../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import {
  evaluateControlPreconditions,
  listControlLifecycleTransitionsFrom,
} from '../../domain/control-lifecycle';
import { ControlRepositoryPort } from '../../domain/ports/control-repository.port';

import type { PermissionIdentifier } from '../../../../core/authorization/domain/permissions';
import type { ControlStatus } from '@prisma/client';

export interface GetControlLifecycleInput {
  readonly actorUserId: string;
  readonly controlId: string;
}

export interface AvailableControlTransition {
  readonly toStatus: ControlStatus;
  readonly requiredPermission: PermissionIdentifier;
  readonly preconditionsMet: boolean;
  readonly unmetPreconditions: readonly string[];
}

export interface ControlLifecycleState {
  readonly status: ControlStatus;
  readonly availableTransitions: readonly AvailableControlTransition[];
}

@Injectable()
export class GetControlLifecycleUseCase {
  constructor(
    private readonly controlRepository: ControlRepositoryPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async execute(input: GetControlLifecycleInput): Promise<ControlLifecycleState> {
    const scope = await this.scopeResolver.resolveScope(input.actorUserId);
    const referenceDate = new Date();

    const control = await this.controlRepository.findById(scope, input.controlId, referenceDate);
    if (!control) {
      // No scope-denial audit path here: unlike the "existing record"
      // use cases (`GetControlUseCase`), this preview endpoint has no
      // stated FR requiring the denial itself be audited, and the
      // contract's own `NotFound` response is the disclosure guarantee
      // that matters (FR-007) — matched by a plain 404 either way.
      throw new NotFoundDomainError(USER_MESSAGES.controls.entityLabel, input.controlId);
    }

    const permissions = await this.permissionResolver.getEffectivePermissions(input.actorUserId);

    const availableTransitions = listControlLifecycleTransitionsFrom(control.status)
      .filter((rule) => permissions.has(rule.requiredPermission))
      .map((rule) => {
        const results = evaluateControlPreconditions(rule.preconditions, {
          ownerUserId: control.owner?.id,
          justification: undefined,
        });
        const unmet = results.filter((result) => !result.met);

        return {
          toStatus: rule.to,
          requiredPermission: rule.requiredPermission,
          preconditionsMet: unmet.length === 0,
          unmetPreconditions: unmet.map((result) => result.message),
        };
      });

    return { status: control.status, availableTransitions };
  }
}
