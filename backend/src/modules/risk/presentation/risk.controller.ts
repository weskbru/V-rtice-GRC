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
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';

import { RequirePermission } from '../../../core/authorization/presentation/permission.guard';
import { CurrentSession } from '../../../core/identity/presentation/current-session.decorator';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { CreateRiskUseCase } from '../application/create-risk.usecase';
import { GetRiskDetailUseCase } from '../application/get-risk-detail.usecase';
import { ListRisksUseCase } from '../application/list-risks.usecase';
import { ReplaceRiskStatementsUseCase } from '../application/replace-risk-statements.usecase';
import { UpdateRiskUseCase } from '../application/update-risk.usecase';

import { CreateRiskRequestDto } from './dto/create-risk-request.dto';
import { ListRisksQueryDto } from './dto/list-risks-query.dto';
import { ReplaceRiskStatementsRequestDto } from './dto/replace-risk-statements-request.dto';
import {
  toEmptyRiskDetailAggregate,
  toRiskDetailResponse,
  toRiskStatementResponses,
  type RiskDetailResponse,
  type RiskStatementResponse,
} from './dto/risk-response.mapper';
import {
  toRiskSummaryResponse,
  type RiskSummaryResponse,
} from './dto/risk-summary-response.mapper';
import { UpdateRiskRequestDto } from './dto/update-risk-request.dto';

import type { ValidatedSession } from '../../../core/sessions/application/session.service';
import type { Request, Response } from 'express';

export interface RiskRegisterPageResponse {
  readonly data: readonly RiskSummaryResponse[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

@Controller('risks')
export class RiskController {
  constructor(
    private readonly createRiskUseCase: CreateRiskUseCase,
    private readonly getRiskDetailUseCase: GetRiskDetailUseCase,
    private readonly updateRiskUseCase: UpdateRiskUseCase,
    private readonly listRisksUseCase: ListRisksUseCase,
    private readonly replaceRiskStatementsUseCase: ReplaceRiskStatementsUseCase,
  ) {}

  @RequirePermission('risk:view')
  @Get()
  async list(
    @CurrentSession() session: ValidatedSession,
    @Query() query: ListRisksQueryDto,
  ): Promise<RiskRegisterPageResponse> {
    const result = await this.listRisksUseCase.execute({
      actorUserId: session.userId,
      page: query.page,
      pageSize: query.pageSize,
      q: query.q,
      status: query.status,
      riskLevel: query.riskLevel,
      riskLevelBasis: query.riskLevelBasis,
      categoryId: query.categoryId,
      orgUnitId: query.orgUnitId,
      includeDescendants: query.includeDescendants,
      ownerUserId: query.ownerUserId,
      overdueReview: query.overdueReview,
      overdueTreatment: query.overdueTreatment,
      sortField: query.sort,
      sortDirection: query.direction,
    });

    return {
      data: result.items.map(toRiskSummaryResponse),
      meta: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }

  @RequirePermission('risk:create')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentSession() session: ValidatedSession,
    @Body() body: CreateRiskRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RiskDetailResponse> {
    const record = await this.createRiskUseCase.execute({
      actorUserId: session.userId,
      title: body.title,
      description: body.description,
      categoryId: body.categoryId ?? undefined,
      typeId: body.typeId ?? undefined,
      originId: body.originId ?? undefined,
      orgUnitId: body.orgUnitId,
      ownerUserId: body.ownerUserId,
      responsibleUserId: body.responsibleUserId ?? undefined,
      identifiedOn: body.identifiedOn,
      nextReviewOn: body.nextReviewOn ?? undefined,
      causes: body.causes,
      consequences: body.consequences,
    });

    response.set('Location', `${request.originalUrl.replace(/\/$/, '')}/${record.id}`);
    response.set('ETag', formatETag(record.version));

    return toRiskDetailResponse(toEmptyRiskDetailAggregate(record));
  }

  @RequirePermission('risk:view')
  @Get(':riskId')
  async findById(
    @CurrentSession() session: ValidatedSession,
    @Param('riskId', new ParseUUIDPipe()) riskId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RiskDetailResponse> {
    const aggregate = await this.getRiskDetailUseCase.execute({
      actorUserId: session.userId,
      riskId,
    });

    response.set('ETag', formatETag(aggregate.risk.version));

    return toRiskDetailResponse(aggregate);
  }

  @RequirePermission('risk:edit')
  @Patch(':riskId')
  async update(
    @CurrentSession() session: ValidatedSession,
    @Param('riskId', new ParseUUIDPipe()) riskId: string,
    @Headers('if-match') ifMatchHeader: string | undefined,
    @Body() body: UpdateRiskRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RiskDetailResponse> {
    const expectedVersion = parseIfMatchHeader(ifMatchHeader);
    assertUpdateBodyNotEmpty(body);

    const record = await this.updateRiskUseCase.execute({
      actorUserId: session.userId,
      riskId,
      expectedVersion,
      title: body.title,
      description: body.description,
      categoryId: body.categoryId,
      typeId: body.typeId,
      originId: body.originId,
      orgUnitId: body.orgUnitId,
      ownerUserId: body.ownerUserId,
      responsibleUserId: body.responsibleUserId,
      identifiedOn: body.identifiedOn,
      nextReviewOn: body.nextReviewOn,
    });

    response.set('ETag', formatETag(record.version));

    const aggregate = await this.getRiskDetailUseCase.execute({
      actorUserId: session.userId,
      riskId,
    });
    return toRiskDetailResponse(aggregate);
  }

  @RequirePermission('risk:edit')
  @Put(':riskId/causes')
  async replaceCauses(
    @CurrentSession() session: ValidatedSession,
    @Param('riskId', new ParseUUIDPipe()) riskId: string,
    @Headers('if-match') ifMatchHeader: string | undefined,
    @Body() body: ReplaceRiskStatementsRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<readonly RiskStatementResponse[]> {
    const expectedVersion = parseIfMatchHeader(ifMatchHeader);

    const { items, risk } = await this.replaceRiskStatementsUseCase.execute({
      actorUserId: session.userId,
      riskId,
      kind: 'causes',
      expectedVersion,
      items: body.items,
    });

    response.set('ETag', formatETag(risk.version));

    return toRiskStatementResponses(items);
  }

  @RequirePermission('risk:edit')
  @Put(':riskId/consequences')
  async replaceConsequences(
    @CurrentSession() session: ValidatedSession,
    @Param('riskId', new ParseUUIDPipe()) riskId: string,
    @Headers('if-match') ifMatchHeader: string | undefined,
    @Body() body: ReplaceRiskStatementsRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<readonly RiskStatementResponse[]> {
    const expectedVersion = parseIfMatchHeader(ifMatchHeader);

    const { items, risk } = await this.replaceRiskStatementsUseCase.execute({
      actorUserId: session.userId,
      riskId,
      kind: 'consequences',
      expectedVersion,
      items: body.items,
    });

    response.set('ETag', formatETag(risk.version));

    return toRiskStatementResponses(items);
  }
}

export function formatETag(version: number): string {
  return `"${String(version)}"`;
}

export function parseIfMatchHeader(headerValue: string | undefined): number {
  if (headerValue === undefined || headerValue.trim().length === 0) {
    throw new BadRequestException({
      title: USER_MESSAGES.problemTitle.badRequest,
      detail: USER_MESSAGES.risk.ifMatchRequired,
    });
  }

  const unquoted = headerValue.trim().replace(/^"|"$/g, '');
  const version = Number(unquoted);

  if (!Number.isInteger(version) || version < 0) {
    throw new BadRequestException({
      title: USER_MESSAGES.problemTitle.badRequest,
      detail: USER_MESSAGES.risk.ifMatchInvalid,
    });
  }

  return version;
}

function assertUpdateBodyNotEmpty(body: UpdateRiskRequestDto): void {
  if (!Object.values(body).some((value) => value !== undefined)) {
    throw new BadRequestException({
      title: USER_MESSAGES.problemTitle.badRequest,
      detail: USER_MESSAGES.risk.updateRequestEmpty,
    });
  }
}
