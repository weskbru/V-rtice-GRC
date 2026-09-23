import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';

import { RequirePermission } from '../../../core/authorization/presentation/permission.guard';
import { CurrentSession } from '../../../core/identity/presentation/current-session.decorator';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { createPageResponse } from '../../../shared/pagination';
import { GetRiskUseCase } from '../application/get-risk.usecase';
import { RecordTreatmentUseCase } from '../application/record-treatment.usecase';
import { CreateTreatmentActionUseCase } from '../application/treatment-actions/create-treatment-action.usecase';
import { UpdateTreatmentActionUseCase } from '../application/treatment-actions/update-treatment-action.usecase';
import { RiskTreatmentActionQueryPort } from '../domain/ports/risk-treatment-action-query.port';
import { RiskTreatmentActionRepositoryPort } from '../domain/ports/risk-treatment-action-repository.port';
import { RiskTreatmentDecisionRepositoryPort } from '../domain/ports/risk-treatment-decision-repository.port';

import { CreateRiskTreatmentActionRequestDto } from './dto/create-treatment-action-request.dto';
import { CreateRiskTreatmentDecisionRequestDto } from './dto/create-treatment-decision-request.dto';
import { ListTreatmentActionsQueryDto } from './dto/list-treatment-actions-query.dto';
import { PageQueryDto } from './dto/page-query.dto';
import {
  toTreatmentActionResponse,
  type TreatmentActionResponse,
} from './dto/treatment-action-response.mapper';
import {
  toTreatmentDecisionResponse,
  type TreatmentDecisionResponse,
} from './dto/treatment-decision-response.mapper';
import { UpdateRiskTreatmentActionRequestDto } from './dto/update-treatment-action-request.dto';
import { formatETag, parseIfMatchHeader } from './risk.controller';

import type { ValidatedSession } from '../../../core/sessions/application/session.service';
import type { Request, Response } from 'express';

interface PageMeta {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface TreatmentDecisionPageResponse {
  readonly data: readonly TreatmentDecisionResponse[];
  readonly meta: PageMeta;
}

export interface TreatmentActionPageResponse {
  readonly data: readonly TreatmentActionResponse[];
  readonly meta: PageMeta;
}

@Controller('risks/:riskId')
export class TreatmentController {
  constructor(
    private readonly getRiskUseCase: GetRiskUseCase,
    private readonly recordTreatmentUseCase: RecordTreatmentUseCase,
    private readonly createTreatmentActionUseCase: CreateTreatmentActionUseCase,
    private readonly updateTreatmentActionUseCase: UpdateTreatmentActionUseCase,
    private readonly treatmentDecisionRepository: RiskTreatmentDecisionRepositoryPort,
    private readonly treatmentActionRepository: RiskTreatmentActionRepositoryPort,
    private readonly treatmentActionQuery: RiskTreatmentActionQueryPort,
  ) {}

  @RequirePermission('risk:view')
  @Get('treatments')
  async listTreatments(
    @CurrentSession() session: ValidatedSession,
    @Param('riskId', new ParseUUIDPipe()) riskId: string,
    @Query() query: PageQueryDto,
  ): Promise<TreatmentDecisionPageResponse> {
    await this.getRiskUseCase.execute({ actorUserId: session.userId, riskId });

    const { items, total } = await this.treatmentDecisionRepository.listByRisk(
      riskId,
      query.page,
      query.pageSize,
    );

    const outstanding = await this.treatmentActionRepository.findDecisionIdsWithOutstandingActions(
      items.map((item) => item.id),
    );
    const responses = items.map((item) =>
      toTreatmentDecisionResponse(item, outstanding.has(item.id)),
    );

    const page = createPageResponse(
      responses,
      { page: query.page, pageSize: query.pageSize },
      total,
    );
    return { data: page.items, meta: toPageMeta(page) };
  }

  @RequirePermission('risk:treat')
  @Post('treatments')
  @HttpCode(HttpStatus.CREATED)
  async createTreatment(
    @CurrentSession() session: ValidatedSession,
    @Param('riskId', new ParseUUIDPipe()) riskId: string,
    @Headers('if-match') ifMatchHeader: string | undefined,
    @Body() body: CreateRiskTreatmentDecisionRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<TreatmentDecisionResponse> {
    const expectedVersion = parseIfMatchHeader(ifMatchHeader);

    const { decision, risk } = await this.recordTreatmentUseCase.execute({
      actorUserId: session.userId,
      riskId,
      expectedVersion,
      strategy: body.strategy,
      description: body.description,
      deadline: body.deadline,
    });

    response.set('Location', `${request.originalUrl.replace(/\/$/, '')}/${decision.id}`);
    response.set('ETag', formatETag(risk.version));

    return toTreatmentDecisionResponse(decision, false);
  }

  @RequirePermission('risk:view')
  @Get('treatment-actions')
  async listTreatmentActions(
    @CurrentSession() session: ValidatedSession,
    @Param('riskId', new ParseUUIDPipe()) riskId: string,
    @Query() query: ListTreatmentActionsQueryDto,
  ): Promise<TreatmentActionPageResponse> {
    await this.getRiskUseCase.execute({ actorUserId: session.userId, riskId });

    const { items, total } = await this.treatmentActionQuery.listByRisk(
      riskId,
      { status: query.status, overdue: query.overdue },
      query.page,
      query.pageSize,
    );

    const linksByActionId =
      await this.treatmentActionRepository.findTreatmentDecisionIdsByActionIds(
        items.map((item) => item.id),
      );
    const responses = items.map((item) =>
      toTreatmentActionResponse(item, linksByActionId.get(item.id) ?? null),
    );
    const page = createPageResponse(
      responses,
      { page: query.page, pageSize: query.pageSize },
      total,
    );
    return { data: page.items, meta: toPageMeta(page) };
  }

  @RequirePermission('risk:treat')
  @Post('treatment-actions')
  @HttpCode(HttpStatus.CREATED)
  async createTreatmentAction(
    @CurrentSession() session: ValidatedSession,
    @Param('riskId', new ParseUUIDPipe()) riskId: string,
    @Headers('if-match') ifMatchHeader: string | undefined,
    @Body() body: CreateRiskTreatmentActionRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<TreatmentActionResponse> {
    const expectedVersion = parseIfMatchHeader(ifMatchHeader);

    const { action, treatmentDecisionId, risk } = await this.createTreatmentActionUseCase.execute({
      actorUserId: session.userId,
      riskId,
      expectedVersion,
      title: body.title,
      description: body.description,
      responsibleUserId: body.responsibleUserId,
      dueOn: body.dueOn,
      treatmentDecisionId: body.treatmentDecisionId,
    });

    response.set('Location', `${request.originalUrl.replace(/\/$/, '')}/${action.id}`);
    response.set('ETag', formatETag(risk.version));

    return toTreatmentActionResponse(action, treatmentDecisionId);
  }

  @RequirePermission('risk:treat')
  @Patch('treatment-actions/:actionId')
  async updateTreatmentAction(
    @CurrentSession() session: ValidatedSession,
    @Param('riskId', new ParseUUIDPipe()) riskId: string,
    @Param('actionId', new ParseUUIDPipe()) actionId: string,
    @Headers('if-match') ifMatchHeader: string | undefined,
    @Body() body: UpdateRiskTreatmentActionRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<TreatmentActionResponse> {
    const expectedVersion = parseIfMatchHeader(ifMatchHeader);
    assertUpdateBodyNotEmpty(body);

    const { action, treatmentDecisionId, risk } = await this.updateTreatmentActionUseCase.execute({
      actorUserId: session.userId,
      riskId,
      actionId,
      expectedVersion,
      title: body.title,
      description: body.description,
      responsibleUserId: body.responsibleUserId,
      dueOn: body.dueOn,
      status: body.status,
      reopenReason: body.reopenReason,
      treatmentDecisionId: body.treatmentDecisionId,
    });

    response.set('ETag', formatETag(risk.version));

    return toTreatmentActionResponse(action, treatmentDecisionId);
  }
}

function toPageMeta(page: {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}): PageMeta {
  return {
    page: page.page,
    pageSize: page.pageSize,
    total: page.total,
    totalPages: page.totalPages,
  };
}

function assertUpdateBodyNotEmpty(body: UpdateRiskTreatmentActionRequestDto): void {
  if (Object.keys(body).length === 0) {
    throw new BadRequestException({
      title: USER_MESSAGES.problemTitle.badRequest,
      detail: USER_MESSAGES.risk.updateRequestEmpty,
    });
  }
}
