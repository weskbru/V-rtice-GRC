import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { AuditRecorder } from '../../audit/application/audit-recorder.service';
import { getCommentableEntityAccessor } from '../domain/entity-registry';
import { CommentRepositoryPort } from '../domain/ports/comment-repository.port';

import type { CommentRecord } from '../domain/ports/comment-repository.port';
import type { CommentableEntityType } from '@prisma/client';

export interface CreateCommentInput {
  readonly actorUserId: string;
  readonly entityType: CommentableEntityType;
  readonly entityId: string;
  readonly body: string;
}

@Injectable()
export class CreateCommentUseCase {
  constructor(
    private readonly commentRepository: CommentRepositoryPort,
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly auditRecorder: AuditRecorder,
  ) {}

  async execute(input: CreateCommentInput): Promise<CommentRecord> {
    const accessor = getCommentableEntityAccessor(input.entityType);
    const parentAccess = await accessor.resolveViewableParent(input.actorUserId, input.entityId);

    return this.transactionRunner.run(async () => {
      const comment = await this.commentRepository.create({
        entityType: input.entityType,
        entityId: input.entityId,
        body: input.body,
        authorUserId: input.actorUserId,
      });

      await this.auditRecorder.record({
        action: 'comment.created',
        entityType: AuditEntityType.COMMENT,
        entityId: comment.id,
        actorLabel: comment.author.fullName,
        newValues: {
          entityType: comment.entityType,
          entityId: comment.entityId,
          body: comment.body,
        },
        organizationalUnitId: parentAccess.organizationalUnitId,
      });

      return comment;
    });
  }
}
