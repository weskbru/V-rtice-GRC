/**
 * `CommentsModule` — the comments capability's composition root (T191/T192,
 * ADR-011). Sits directly under `src/core/comments/`, outside the
 * `domain`/`application`/`infrastructure`/`presentation` folders the
 * boundary lint rules classify.
 *
 * Exports nothing today — `core/files` reaches `entity-registry.ts`
 * directly (a plain TS module, not a Nest provider; see that file's
 * header), so there is no DI-level dependency for another module to
 * import.
 */
import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { TransactionRunnerPort } from '../../shared/persistence/transaction-runner.port';
import { AuditModule } from '../audit/audit.module';

import { CreateCommentUseCase } from './application/create-comment.usecase';
import { ListCommentsUseCase } from './application/list-comments.usecase';
import { WithdrawCommentUseCase } from './application/withdraw-comment.usecase';
import { registerCommentsAuditAllowlist } from './domain/comments-audit-allowlist';
import { ActorDirectoryPort } from './domain/ports/actor-directory.port';
import { CommentRepositoryPort } from './domain/ports/comment-repository.port';
import { PrismaActorDirectory } from './infrastructure/prisma-actor-directory';
import { PrismaCommentRepository } from './infrastructure/prisma-comment.repository';
import { PrismaTransactionRunner } from './infrastructure/prisma-transaction-runner';
import { CommentController } from './presentation/comment.controller';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [CommentController],
  providers: [
    CreateCommentUseCase,
    ListCommentsUseCase,
    WithdrawCommentUseCase,
    { provide: CommentRepositoryPort, useClass: PrismaCommentRepository },
    { provide: ActorDirectoryPort, useClass: PrismaActorDirectory },
    { provide: TransactionRunnerPort, useClass: PrismaTransactionRunner },
  ],
})
export class CommentsModule {
  constructor() {
    // T192: register this capability's own AuditEntityType.COMMENT field
    // allow-list from its own file, without editing `core/audit/**`
    // (ADR-011).
    registerCommentsAuditAllowlist();
  }
}
