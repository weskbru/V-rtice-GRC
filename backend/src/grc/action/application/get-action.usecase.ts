import { Injectable } from '@nestjs/common';

import { NotFoundDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { isActionOverdue, todayDateOnlyUtc } from '../../shared/domain/overdue.service';
import { ActionRepositoryPort } from '../domain/ports/action-repository.port';

import { ActionOriginLabelService } from './action-origin-label.service';
import { assertActionOriginInScope } from './assert-action-origin-in-scope';

import type { ActionRecord } from '../domain/ports/action-repository.port';

export interface GetActionInput {
  readonly actorUserId: string;
  readonly actionId: string;
}

export interface ActionWithDerived extends ActionRecord {
  readonly overdue: boolean;
  readonly originLabel: string | undefined;
}

@Injectable()
export class GetActionUseCase {
  constructor(
    private readonly actionRepository: ActionRepositoryPort,
    private readonly originLabelService: ActionOriginLabelService,
  ) {}

  async execute(input: GetActionInput): Promise<ActionWithDerived> {
    const record = await this.actionRepository.findByIdUnscoped(input.actionId);
    if (!record) {
      throw new NotFoundDomainError(USER_MESSAGES.action.entityLabel, input.actionId);
    }

    await assertActionOriginInScope(
      input.actorUserId,
      input.actionId,
      record.originType,
      record.originId,
    );

    const originLabel = await this.originLabelService.resolveLabel(
      input.actorUserId,
      record.originType,
      record.originId,
    );

    return {
      ...record,
      overdue: isActionOverdue(record.dueOn, record.status, todayDateOnlyUtc()),
      originLabel,
    };
  }
}
