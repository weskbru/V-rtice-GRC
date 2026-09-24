import { Injectable } from '@nestjs/common';
import { AuditEntityType, AuditOutcome } from '@prisma/client';

import {
  ConflictDomainError,
  NotFoundDomainError,
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { AuditRecorder } from '../../audit/application/audit-recorder.service';
import { UserDirectoryPort } from '../domain/ports/user-directory.port';

import { GetUserUseCase, type AdminUserDetail } from './get-user.usecase';

const USER_ENTITY_LABEL = 'Usuário';

export interface UpdateUserCommand {
  readonly actorUserId: string;
  readonly userId: string;
  readonly email?: string;
  readonly fullName?: string;
  readonly jobTitle?: string | null;
  readonly primaryOrgUnitId?: string | null;
}

@Injectable()
export class UpdateUserUseCase {
  constructor(
    private readonly userDirectory: UserDirectoryPort,
    private readonly getUser: GetUserUseCase,
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly auditRecorder: AuditRecorder,
  ) {}

  async execute(command: UpdateUserCommand): Promise<AdminUserDetail> {
    const actor = await this.userDirectory.findAdminRecordById(command.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const existing = await this.userDirectory.findAdminRecordById(command.userId);
    if (!existing) {
      throw new NotFoundDomainError(USER_ENTITY_LABEL, command.userId);
    }

    if (command.email !== undefined) {
      const conflict = await this.userDirectory.findByEmail(command.email);
      if (conflict && conflict.id !== command.userId) {
        throw new ConflictDomainError(USER_MESSAGES.admin.emailAlreadyInUse);
      }
    }

    if (command.primaryOrgUnitId !== undefined && command.primaryOrgUnitId !== null) {
      const orgUnit = await this.userDirectory.findOrgUnitForValidation(command.primaryOrgUnitId);
      if (!orgUnit?.isActive) {
        throw new ValidationDomainError(USER_MESSAGES.admin.parentOrgUnitNotFound);
      }
    }

    await this.transactionRunner.run(async () => {
      const previous = await this.userDirectory.updateProfile(command.userId, {
        ...(command.email !== undefined ? { email: command.email } : {}),
        ...(command.fullName !== undefined ? { fullName: command.fullName } : {}),
        ...(command.jobTitle !== undefined ? { jobTitle: command.jobTitle } : {}),
        ...(command.primaryOrgUnitId !== undefined
          ? { primaryOrgUnitId: command.primaryOrgUnitId }
          : {}),
      });
      if (!previous) {
        throw new NotFoundDomainError(USER_ENTITY_LABEL, command.userId);
      }

      await this.auditRecorder.record({
        action: 'user.updated',
        entityType: AuditEntityType.USER,
        entityId: command.userId,
        actorLabel: actor.fullName,
        previousValues: {
          ...(command.email !== undefined ? { email: previous.email } : {}),
          ...(command.fullName !== undefined ? { fullName: previous.fullName } : {}),
          ...(command.jobTitle !== undefined ? { jobTitle: previous.jobTitle ?? null } : {}),
          ...(command.primaryOrgUnitId !== undefined
            ? { primaryOrgUnitId: previous.primaryOrgUnitId ?? null }
            : {}),
        },
        newValues: {
          ...(command.email !== undefined ? { email: command.email } : {}),
          ...(command.fullName !== undefined ? { fullName: command.fullName } : {}),
          ...(command.jobTitle !== undefined ? { jobTitle: command.jobTitle } : {}),
          ...(command.primaryOrgUnitId !== undefined
            ? { primaryOrgUnitId: command.primaryOrgUnitId }
            : {}),
        },
        organizationalUnitId: command.primaryOrgUnitId ?? undefined,
        outcome: AuditOutcome.SUCCESS,
      });
    });

    return this.getUser.execute(command.userId);
  }
}
