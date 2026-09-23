import { Injectable } from '@nestjs/common';

import { PermissionResolverService } from '../../../../core/authorization/application/permission-resolver.service';
import { NotFoundDomainError } from '../../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { GetFindingUseCase } from '../get-finding.usecase';

import type {
  EvidenceSubjectAccess,
  EvidenceSubjectAccessor,
} from '../../../shared/domain/ports/evidence-subject-resolver.port';

@Injectable()
export class FindingEvidenceSubjectAccessor implements EvidenceSubjectAccessor {
  constructor(
    private readonly getFindingUseCase: GetFindingUseCase,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async resolveViewableSubject(
    actorUserId: string,
    subjectId: string,
  ): Promise<EvidenceSubjectAccess> {
    const canView = await this.permissionResolver.hasPermission(actorUserId, 'finding:view');
    if (!canView) {
      throw new NotFoundDomainError(USER_MESSAGES.findings.entityLabel, subjectId);
    }

    const finding = await this.getFindingUseCase.execute({ actorUserId, findingId: subjectId });

    return {
      organizationalUnitId: finding.orgUnit.id,
      label: `${finding.code} — ${finding.title}`,
    };
  }
}
