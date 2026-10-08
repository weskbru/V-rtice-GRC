import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { UnauthorizedDomainError, NotFoundDomainError } from '../../../shared/errors/domain-error';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { AuditRecorder } from '../../audit/application/audit-recorder.service';
import { ActorDirectoryPort } from '../domain/ports/actor-directory.port';
import { AttachmentRepositoryPort } from '../domain/ports/attachment-repository.port';

import { assertAttachmentAccessible } from './attachment-access';

const ATTACHMENT_ENTITY_LABEL = 'Anexo';

export interface WithdrawAttachmentInput {
  readonly actorUserId: string;
  readonly attachmentId: string;
}

@Injectable()
export class WithdrawAttachmentUseCase {
  constructor(
    private readonly attachmentRepository: AttachmentRepositoryPort,
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly actorDirectory: ActorDirectoryPort,
    private readonly auditRecorder: AuditRecorder,
  ) {}

  async execute(input: WithdrawAttachmentInput): Promise<void> {
    const attachment = await this.attachmentRepository.findById(input.attachmentId);
    if (!attachment) {
      throw new NotFoundDomainError(ATTACHMENT_ENTITY_LABEL, input.attachmentId);
    }

    const parentAccess = await assertAttachmentAccessible(attachment, input.actorUserId);

    const actorLabel = await this.actorDirectory.findActorLabel(input.actorUserId);
    if (!actorLabel) {
      throw new UnauthorizedDomainError();
    }

    await this.transactionRunner.run(async () => {
      const withdrawn = await this.attachmentRepository.withdraw(
        input.attachmentId,
        input.actorUserId,
      );
      if (!withdrawn) {
        throw new NotFoundDomainError(ATTACHMENT_ENTITY_LABEL, input.attachmentId);
      }

      await this.auditRecorder.record({
        action: 'attachment.withdrawn',
        entityType: AuditEntityType.ATTACHMENT,
        entityId: attachment.id,
        actorLabel,
        newValues: {
          deletedAt: new Date(),
          deletedByUserId: input.actorUserId,
        },
        organizationalUnitId: parentAccess.organizationalUnitId,
      });
    });
  }
}
