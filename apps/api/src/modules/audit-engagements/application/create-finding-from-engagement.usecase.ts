import { Injectable } from '@nestjs/common';

import { PermissionResolverService } from '../../../core/authorization/application/permission-resolver.service';
import { CreateFindingUseCase } from '../../../grc/finding/application/create-finding.usecase';
import { ForbiddenDomainError, NotFoundDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { assertAuditEngagementAcceptsFindings } from '../domain/audit-engagement.entity';

import { AuditEngagementAccessResolver } from './audit-engagement-access-resolver.service';

import type { FindingRecord } from '../../../grc/finding/domain/ports/finding-repository.port';
import type {
  FindingCategory,
  FindingOrigin,
  FindingPriority,
  FindingSeverity,
} from '@prisma/client';

export interface CreateFindingFromEngagementInput {
  readonly actorUserId: string;
  readonly auditEngagementId: string;
  readonly title: string;
  readonly description: string;
  readonly recommendation?: string | undefined;
  readonly category: FindingCategory;
  readonly origin: FindingOrigin;
  readonly severity: FindingSeverity;
  readonly priority: FindingPriority;
  readonly ownerUserId: string;
  readonly identifiedOn: string;
}

@Injectable()
export class CreateFindingFromEngagementUseCase {
  constructor(
    private readonly accessResolver: AuditEngagementAccessResolver,
    private readonly permissionResolver: PermissionResolverService,
    private readonly createFindingUseCase: CreateFindingUseCase,
  ) {}

  async execute(input: CreateFindingFromEngagementInput): Promise<FindingRecord> {
    const canViewEngagement = await this.permissionResolver.hasPermission(
      input.actorUserId,
      'audit-engagement:view',
    );
    if (!canViewEngagement) {
      throw new NotFoundDomainError(
        USER_MESSAGES.auditEngagements.entityLabel,
        input.auditEngagementId,
      );
    }

    const { auditEngagement } = await this.accessResolver.resolveAuditEngagement(
      input.actorUserId,
      input.auditEngagementId,
    );

    const canCreateFinding = await this.permissionResolver.hasPermission(
      input.actorUserId,
      'finding:create',
    );
    if (!canCreateFinding) {
      throw new ForbiddenDomainError();
    }

    assertAuditEngagementAcceptsFindings(auditEngagement.status);

    return this.createFindingUseCase.execute({
      actorUserId: input.actorUserId,
      orgUnitId: auditEngagement.orgUnit.id,
      title: input.title,
      description: input.description,
      recommendation: input.recommendation,
      category: input.category,
      origin: input.origin,
      severity: input.severity,
      priority: input.priority,
      ownerUserId: input.ownerUserId,
      identifiedOn: input.identifiedOn,
      auditEngagementId: input.auditEngagementId,
    });
  }
}
