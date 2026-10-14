import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import {
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { parseIsoDate } from '../../shared/domain/iso-date';
import { getActionOriginAccessor } from '../../shared/domain/ports/action-origin-resolver.port';
import { EntityCodeGeneratorPort } from '../../shared/domain/ports/entity-code-generator.port';
import { ActionReferenceDataPort } from '../domain/ports/action-reference-data.port';
import { ActionRepositoryPort } from '../domain/ports/action-repository.port';

import type { ActionRecord } from '../domain/ports/action-repository.port';
import type { ActionOriginType } from '@prisma/client';

export interface CreateActionInput {
  readonly actorUserId: string;
  readonly originType: ActionOriginType;
  readonly originId: string;
  readonly title: string;
  readonly description?: string | undefined;
  readonly responsibleUserId: string;
  readonly dueOn: string;
}

export interface CreateActionResult {
  readonly record: ActionRecord;
  readonly originLabel: string;
}

@Injectable()
export class CreateActionUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly actionRepository: ActionRepositoryPort,
    private readonly referenceData: ActionReferenceDataPort,
    private readonly codeGenerator: EntityCodeGeneratorPort,
    private readonly auditRecorder: AuditRecorder,
  ) {}

  async execute(input: CreateActionInput): Promise<CreateActionResult> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const origin = await getActionOriginAccessor(input.originType).resolveEditableOrigin(
      input.actorUserId,
      input.originId,
    );

    const responsible = await this.referenceData.findUser(input.responsibleUserId);
    if (!responsible?.isActive) {
      throw new ValidationDomainError(USER_MESSAGES.action.responsibleNotFound, [
        { field: 'responsibleUserId', message: USER_MESSAGES.action.responsibleNotFound },
      ]);
    }

    const dueOn = parseIsoDate(input.dueOn);
    const codeYear = new Date().getUTCFullYear();

    return this.transactionRunner.run(async () => {
      const code = await this.codeGenerator.nextCode('ACT', codeYear);

      const record = await this.actionRepository.create({
        code,
        orgUnitId: origin.organizationalUnitId,
        originType: input.originType,
        originId: input.originId,
        title: input.title,
        description: input.description,
        responsibleUserId: input.responsibleUserId,
        dueOn,
      });

      await this.auditRecorder.record({
        action: 'action.created',
        entityType: AuditEntityType.ACTION,
        entityId: record.id,
        actorLabel: actor.fullName,
        newValues: {
          originType: input.originType,
          originId: input.originId,
          title: input.title,
          description: input.description ?? null,
          responsibleUserId: input.responsibleUserId,
          dueOn,
          status: record.status,
        },
        organizationalUnitId: origin.organizationalUnitId,
      });

      return { record, originLabel: origin.label };
    });
  }
}
