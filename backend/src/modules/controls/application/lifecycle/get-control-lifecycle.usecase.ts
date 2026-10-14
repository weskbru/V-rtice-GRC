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
