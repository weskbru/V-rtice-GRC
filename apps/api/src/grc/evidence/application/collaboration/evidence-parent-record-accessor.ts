/**
 * T030a/002-shared-grc-foundation, US1 — `EvidenceParentRecordAccessor`:
 * Evidence's own registration against the attachable entity-type registry
 * (`core/comments/domain/entity-registry.ts`), the correction this task's
 * scope requires (see `schema.prisma`'s `Evidence`/`AttachableEntityType`
 * section header comments for the full account of why `Evidence.fileId`
 * was removed in favor of this mechanism). Mirrors
 * `modules/risk/application/collaboration/risk-parent-record-accessor.ts`
 * exactly — see that file's header for the full two-check rationale this
 * one does not repeat: `PermissionGuard` on `AttachmentController` never
 * runs for an evidence's attachments (that controller carries
 * `@NoPermissionRequired()`), so this accessor is the one place that
 * reconstructs BOTH `evidence:view` AND organizational scope for the
 * dynamic, entity-type-driven case.
 *
 * `EvidenceModule`'s own constructor calls
 * `registerAttachableEntityType('EVIDENCE', ...)` with an instance of this
 * class — no edit to `core/comments/**`/`core/files/**` is needed, the
 * exact extension point `entity-registry.ts` describes.
 */
import { Injectable } from '@nestjs/common';

import { PermissionResolverService } from '../../../../core/authorization/application/permission-resolver.service';
import { NotFoundDomainError } from '../../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { GetEvidenceUseCase } from '../get-evidence.usecase';

import type {
  ParentRecordAccess,
  ParentRecordAccessor,
} from '../../../../core/comments/domain/entity-registry';

@Injectable()
export class EvidenceParentRecordAccessor implements ParentRecordAccessor {
  constructor(
    private readonly getEvidenceUseCase: GetEvidenceUseCase,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async resolveViewableParent(actorUserId: string, entityId: string): Promise<ParentRecordAccess> {
    const canView = await this.permissionResolver.hasPermission(actorUserId, 'evidence:view');
    if (!canView) {
      throw new NotFoundDomainError(USER_MESSAGES.evidence.entityLabel, entityId);
    }

    const evidence = await this.getEvidenceUseCase.execute({ actorUserId, evidenceId: entityId });

    return { organizationalUnitId: evidence.orgUnit.id };
  }
}
