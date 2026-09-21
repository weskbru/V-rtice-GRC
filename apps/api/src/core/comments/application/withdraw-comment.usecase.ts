/**
 * T192 — `WithdrawCommentUseCase`: `DELETE /comments/{commentId}` (FR-100,
 * FR-102). Soft-deletes only — author, timestamp and the audit link are
 * preserved, never hard-deleted.
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { NotFoundDomainError, UnauthorizedDomainError } from '../../../shared/errors/domain-error';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { AuditRecorder } from '../../audit/application/audit-recorder.service';
import { ActorDirectoryPort } from '../domain/ports/actor-directory.port';
import { CommentRepositoryPort } from '../domain/ports/comment-repository.port';

import { assertCommentAccessible } from './comment-access';

const COMMENT_ENTITY_LABEL = 'Comentário';

export interface WithdrawCommentInput {
  readonly actorUserId: string;
  readonly commentId: string;
}

@Injectable()
export class WithdrawCommentUseCase {
  constructor(
    private readonly commentRepository: CommentRepositoryPort,
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly actorDirectory: ActorDirectoryPort,
    private readonly auditRecorder: AuditRecorder,
  ) {}

  async execute(input: WithdrawCommentInput): Promise<void> {
    const comment = await this.commentRepository.findById(input.commentId);
    if (!comment) {
      throw new NotFoundDomainError(COMMENT_ENTITY_LABEL, input.commentId);
    }

    const parentAccess = await assertCommentAccessible(comment, input.actorUserId);

    const actorLabel = await this.actorDirectory.findActorLabel(input.actorUserId);
    if (!actorLabel) {
      throw new UnauthorizedDomainError();
    }

    await this.transactionRunner.run(async () => {
      const withdrawn = await this.commentRepository.withdraw(input.commentId, input.actorUserId);
      if (!withdrawn) {
        throw new NotFoundDomainError(COMMENT_ENTITY_LABEL, input.commentId);
      }

      await this.auditRecorder.record({
        action: 'comment.withdrawn',
        entityType: AuditEntityType.COMMENT,
        entityId: comment.id,
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
