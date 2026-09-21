/**
 * T045a/T054/002-shared-grc-foundation, US2 — `grc/action`'s own
 * registration against `EvidenceSubjectResolverPort`'s registry
 * (`grc/shared/domain/ports/evidence-subject-resolver.port.ts`) for
 * `EvidenceSubjectType.ACTION` (FR-017: "Uma ação MUST poder referenciar
 * evidências que comprovem sua execução"). Registered directly from
 * `ActionModule`'s own constructor — no cross-boundary adapter needed,
 * since both `grc/evidence` and `grc/action` already live under `grc/**`
 * (see that registry's own header, "Who registers what").
 *
 * Mirrors `modules/risk/application/collaboration/risk-evidence-subject
 * -accessor.ts`'s shape: `action:view` permission PLUS
 * `GetActionUseCase`'s own scope-checked read, neither substituting for
 * the other.
 */
import { Injectable } from '@nestjs/common';

import { PermissionResolverService } from '../../../../core/authorization/application/permission-resolver.service';
import { NotFoundDomainError } from '../../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { GetActionUseCase } from '../get-action.usecase';

import type {
  EvidenceSubjectAccess,
  EvidenceSubjectAccessor,
} from '../../../shared/domain/ports/evidence-subject-resolver.port';

@Injectable()
export class ActionEvidenceSubjectAccessor implements EvidenceSubjectAccessor {
  constructor(
    private readonly getActionUseCase: GetActionUseCase,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async resolveViewableSubject(
    actorUserId: string,
    subjectId: string,
  ): Promise<EvidenceSubjectAccess> {
    const canView = await this.permissionResolver.hasPermission(actorUserId, 'action:view');
    if (!canView) {
      throw new NotFoundDomainError(USER_MESSAGES.action.entityLabel, subjectId);
    }

    const action = await this.getActionUseCase.execute({ actorUserId, actionId: subjectId });

    return {
      organizationalUnitId: action.orgUnit.id,
      label: `${action.code} — ${action.title}`,
    };
  }
}
