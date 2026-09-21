/**
 * T176 — `PUT /admin/users/{userId}/status` (`contracts/admin.openapi.yaml`,
 * FR-011, FR-017). Setting `INACTIVE` prevents further authentication and
 * revokes every session the user holds (reason `USER_DEACTIVATED`) inside
 * the same transaction as the status change — a deactivated user with a
 * live session is still an active user, so the two must be atomic.
 *
 * A caller may not deactivate their own account (`422`) — checked BEFORE
 * any database read, since it depends only on the two ids already in hand.
 *
 * Reuses `SessionService.revokeAllForUser` (`core/sessions`) rather than
 * `AuthUseCasesPort.deactivateUser` (`core/identity`'s own pre-existing
 * deactivation path, `AuthOrchestrator`): that port only ever sets
 * `INACTIVE` and has no reactivation branch, no self-deactivation guard and
 * no `reason` — this use case is the genuinely more capable administrative
 * surface `AuthUseCasesPort.deactivateUser`'s own doc comment anticipated
 * ("a future admin-facing endpoint will call exactly this same port
 * method" turned out not to hold once reactivation and `reason` entered
 * the contract; that pre-existing method is left as-is for whatever
 * non-administrative caller still needs a bare deactivation, per D-12-style
 * "the task sheet's assumption did not survive contact with the full
 * contract").
 */
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
        // Defensive only — `existing` was just confirmed above, inside the
        // same request (users are never hard-deleted, FR-102).
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
        // FR-017: revoked atomically with the status change — a
        // deactivated user with a live session is still an active user.
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
