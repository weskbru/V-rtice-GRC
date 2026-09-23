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
