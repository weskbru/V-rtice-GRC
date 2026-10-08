import { Injectable } from '@nestjs/common';
import { SessionRevocationReason } from '@prisma/client';

import { NotFoundDomainError, UnauthorizedDomainError } from '../../../shared/errors/domain-error';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { SessionService } from '../../sessions/application/session.service';
import { UserDirectoryPort } from '../domain/ports/user-directory.port';

const USER_ENTITY_LABEL = 'Usuário';

export interface RevokeUserSessionsCommand {
  readonly actorUserId: string;
  readonly userId: string;
}

@Injectable()
export class RevokeUserSessionsUseCase {
  constructor(
    private readonly userDirectory: UserDirectoryPort,
    private readonly sessionService: SessionService,
    private readonly transactionRunner: TransactionRunnerPort,
  ) {}

  async execute(command: RevokeUserSessionsCommand): Promise<void> {
    const actor = await this.userDirectory.findAdminRecordById(command.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const target = await this.userDirectory.findAdminRecordById(command.userId);
    if (!target) {
      throw new NotFoundDomainError(USER_ENTITY_LABEL, command.userId);
    }

    await this.transactionRunner.run(async () => {
      await this.sessionService.revokeAllForUser(
        command.userId,
        SessionRevocationReason.ADMIN_REVOKED,
        actor.fullName,
      );
    });
  }
}
