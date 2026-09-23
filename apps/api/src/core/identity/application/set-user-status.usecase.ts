import { Injectable } from '@nestjs/common';
import { AuditEntityType, AuditOutcome, SessionRevocationReason } from '@prisma/client';

import {
  NotFoundDomainError,
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { AuditRecorder } from '../../audit/application/audit-recorder.service';
import { SessionService } from '../../sessions/application/session.service';
import { UserDirectoryPort } from '../domain/ports/user-directory.port';

import { GetUserUseCase, type AdminUserDetail } from './get-user.usecase';

import type { UserStatus } from '@prisma/client';

const USER_ENTITY_LABEL = 'Usuário';

export interface SetUserStatusCommand {
  readonly actorUserId: string;
  readonly userId: string;
  readonly status: UserStatus;
  readonly reason: string | undefined;
}

@Injectable()
export class SetUserStatusUseCase {
  constructor(
    private readonly userDirectory: UserDirectoryPort,
    private readonly sessionService: SessionService,
    private readonly getUser: GetUserUseCase,
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly auditRecorder: AuditRecorder,
  ) {}

  async execute(command: SetUserStatusCommand): Promise<AdminUserDetail> {
    if (command.status === 'INACTIVE' && command.userId === command.actorUserId) {
      throw new ValidationDomainError(USER_MESSAGES.admin.cannotDeactivateSelf);
    }

    const actor = await this.userDirectory.findAdminRecordById(command.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const existing = await this.userDirectory.findAdminRecordById(command.userId);
    if (!existing) {
      throw new NotFoundDomainError(USER_ENTITY_LABEL, command.userId);
    }

    await this.transactionRunner.run(async () => {
      const previousStatus = await this.userDirectory.setStatus(command.userId, command.status);
      if (previousStatus === undefined) {
        throw new NotFoundDomainError(USER_ENTITY_LABEL, command.userId);
      }

      await this.auditRecorder.record({
        action: command.status === 'ACTIVE' ? 'user.activated' : 'user.deactivated',
        entityType: AuditEntityType.USER,
        entityId: command.userId,
        actorLabel: actor.fullName,
        previousValues: { status: previousStatus },
        newValues: {
          status: command.status,
          ...(command.reason !== undefined ? { reason: command.reason } : {}),
        },
        outcome: AuditOutcome.SUCCESS,
      });

      if (command.status === 'INACTIVE') {
        await this.sessionService.revokeAllForUser(
          command.userId,
          SessionRevocationReason.USER_DEACTIVATED,
          actor.fullName,
        );
      }
    });

    return this.getUser.execute(command.userId);
  }
}
