/**
 * T039/003-controls-management, Task C — `modules/controls`'s own
 * registration against `EvidenceSubjectResolverPort`'s registry
 * (`grc/shared/domain/ports/evidence-subject-resolver.port.ts`) for
 * `EvidenceSubjectType.CONTROL` (FR-026: "uma evidência sustenta um
 * controle pelo mesmo mecanismo de tipo fechado já usado pelos demais
 * sujeitos"). Mirrors
 * `grc/finding/application/collaboration/finding-evidence-subject-accessor.ts`'s
 * shape exactly — `control:view` permission PLUS `ControlAccessResolver`'s
 * own scope-checked read, neither substituting for the other.
 *
 * `EvidenceLink.subjectId` for `CONTROL` is the `Control`'s own id.
 */
import { Injectable } from '@nestjs/common';

import { PermissionResolverService } from '../../../../core/authorization/application/permission-resolver.service';
import { NotFoundDomainError } from '../../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { ControlAccessResolver } from '../control-access-resolver.service';

import type {
  EvidenceSubjectAccess,
  EvidenceSubjectAccessor,
} from '../../../../grc/shared/domain/ports/evidence-subject-resolver.port';

@Injectable()
export class ControlEvidenceSubjectAccessor implements EvidenceSubjectAccessor {
  constructor(
    private readonly controlAccess: ControlAccessResolver,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async resolveViewableSubject(
    actorUserId: string,
    subjectId: string,
  ): Promise<EvidenceSubjectAccess> {
    const canView = await this.permissionResolver.hasPermission(actorUserId, 'control:view');
    if (!canView) {
      throw new NotFoundDomainError(USER_MESSAGES.controls.entityLabel, subjectId);
    }

    const { control } = await this.controlAccess.resolveControl(actorUserId, subjectId);

    return {
      organizationalUnitId: control.orgUnitId,
      label: `${control.code} — ${control.name}`,
    };
  }
}
