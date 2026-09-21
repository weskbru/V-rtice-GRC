/**
 * T053/002-shared-grc-foundation, US2 — `ActionController`:
 * `contracts/grc-foundation.openapi.yaml`'s `/actions` and
 * `/actions/{actionId}[/transitions]` paths (`listActions`, `createAction`,
 * `getAction`, `updateAction`, `transitionAction`). Every route carries its
 * own `@RequirePermission` (FR-033) — there is no route on this controller
 * without one, and no `DELETE` route exists (FR-011-FR-019 give `Action` no
 * delete operation — cancellation is a `status` transition, not removal).
 */
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { RequirePermission } from '../../../core/authorization/presentation/permission.guard';
import { CurrentSession } from '../../../core/identity/presentation/current-session.decorator';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { isActionOverdue, todayDateOnlyUtc } from '../../shared/domain/overdue.service';
import { ActionOriginLabelService } from '../application/action-origin-label.service';
import { CreateActionUseCase } from '../application/create-action.usecase';
import { GetActionUseCase } from '../application/get-action.usecase';
import { ListActionUseCase } from '../application/list-action.usecase';
import { TransitionActionUseCase } from '../application/transition-action.usecase';
import { UpdateActionUseCase } from '../application/update-action.usecase';

import { toActionResponse, type ActionResponse } from './dto/action-response.mapper';
import { CreateActionRequestDto } from './dto/create-action-request.dto';
import { ListActionQueryDto } from './dto/list-action-query.dto';
import { TransitionActionRequestDto } from './dto/transition-action-request.dto';
import { UpdateActionRequestDto } from './dto/update-action-request.dto';

import type { ValidatedSession } from '../../../core/sessions/application/session.service';

export interface ActionPageResponse {
  readonly items: readonly ActionResponse[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

@Controller('actions')
export class ActionController {
  constructor(
    private readonly createActionUseCase: CreateActionUseCase,
    private readonly listActionUseCase: ListActionUseCase,
    private readonly getActionUseCase: GetActionUseCase,
    private readonly updateActionUseCase: UpdateActionUseCase,
    private readonly transitionActionUseCase: TransitionActionUseCase,
    private readonly originLabelService: ActionOriginLabelService,
  ) {}

  @RequirePermission('action:view')
  @Get()
  async list(
    @CurrentSession() session: ValidatedSession,
    @Query() query: ListActionQueryDto,
  ): Promise<ActionPageResponse> {
    const result = await this.listActionUseCase.execute({
      actorUserId: session.userId,
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
      responsibleUserId: query.responsibleUserId,
      originType: query.originType,
      originId: query.originId,
      overdue: query.overdue,
      dueBefore: query.dueBefore,
    });

    return {
      items: result.items.map((item) => toActionResponse(item)),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    };
  }

  @RequirePermission('action:create')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentSession() session: ValidatedSession,
    @Body() body: CreateActionRequestDto,
  ): Promise<ActionResponse> {
    const { record, originLabel } = await this.createActionUseCase.execute({
      actorUserId: session.userId,
      originType: body.originType,
      originId: body.originId,
      title: body.title,
      description: body.description,
      responsibleUserId: body.responsibleUserId,
      dueOn: body.dueOn,
    });

    return toActionResponse({
      ...record,
      overdue: isActionOverdue(record.dueOn, record.status, todayDateOnlyUtc()),
      originLabel,
    });
  }

  @RequirePermission('action:view')
  @Get(':actionId')
  async findById(
    @CurrentSession() session: ValidatedSession,
    @Param('actionId', new ParseUUIDPipe()) actionId: string,
  ): Promise<ActionResponse> {
    const record = await this.getActionUseCase.execute({ actorUserId: session.userId, actionId });
    return toActionResponse(record);
  }

  @RequirePermission('action:edit')
  @Patch(':actionId')
  async update(
    @CurrentSession() session: ValidatedSession,
    @Param('actionId', new ParseUUIDPipe()) actionId: string,
    @Body() body: UpdateActionRequestDto,
  ): Promise<ActionResponse> {
    assertUpdateBodyNotEmpty(body);

    const updated = await this.updateActionUseCase.execute({
      actorUserId: session.userId,
      actionId,
      title: body.title,
      description: body.description,
      responsibleUserId: body.responsibleUserId,
      dueOn: body.dueOn,
    });

    const originLabel = await this.originLabelService.resolveLabel(
      session.userId,
      updated.originType,
      updated.originId,
    );
    return toActionResponse({
      ...updated,
      overdue: isActionOverdue(updated.dueOn, updated.status, todayDateOnlyUtc()),
      originLabel,
    });
  }

  @RequirePermission('action:edit')
  @Post(':actionId/transitions')
  @HttpCode(HttpStatus.OK)
  async transition(
    @CurrentSession() session: ValidatedSession,
    @Param('actionId', new ParseUUIDPipe()) actionId: string,
    @Body() body: TransitionActionRequestDto,
  ): Promise<ActionResponse> {
    const updated = await this.transitionActionUseCase.execute({
      actorUserId: session.userId,
      actionId,
      to: body.to,
      reason: body.reason,
    });

    const originLabel = await this.originLabelService.resolveLabel(
      session.userId,
      updated.originType,
      updated.originId,
    );
    return toActionResponse({
      ...updated,
      overdue: isActionOverdue(updated.dueOn, updated.status, todayDateOnlyUtc()),
      originLabel,
    });
  }
}

/** `UpdateActionRequest`'s `minProperties: 1` — controller-level check,
 * mirroring `evidence.controller.ts#assertUpdateBodyNotEmpty`'s own
 * documented reasoning. */
function assertUpdateBodyNotEmpty(body: UpdateActionRequestDto): void {
  if (!Object.values(body).some((value) => value !== undefined)) {
    throw new BadRequestException({
      title: USER_MESSAGES.problemTitle.badRequest,
      detail: USER_MESSAGES.action.updateRequestEmpty,
    });
  }
}
