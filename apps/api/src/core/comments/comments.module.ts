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
    registerCommentsAuditAllowlist();
  }
}
