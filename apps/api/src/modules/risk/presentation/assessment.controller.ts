import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';

import { RequirePermission } from '../../../core/authorization/presentation/permission.guard';
import { CurrentSession } from '../../../core/identity/presentation/current-session.decorator';
import { createPageResponse } from '../../../shared/pagination';
import { CreateAssessmentUseCase } from '../application/create-assessment.usecase';
import { GetRiskUseCase } from '../application/get-risk.usecase';
import { RiskAssessmentRepositoryPort } from '../domain/ports/risk-assessment-repository.port';

import { toAssessmentResponse, type AssessmentResponse } from './dto/assessment-response.mapper';
import { CreateAssessmentRequestDto } from './dto/create-assessment-request.dto';
import { PageQueryDto } from './dto/page-query.dto';
import { formatETag, parseIfMatchHeader } from './risk.controller';

import type { ValidatedSession } from '../../../core/sessions/application/session.service';
import type { AssessmentRecord } from '../domain/ports/risk-assessment-repository.port';
import type { Request, Response } from 'express';

export interface AssessmentPageResponse {
  readonly data: readonly AssessmentResponse[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

@Controller('risks/:riskId/assessments')
export class AssessmentController {
  constructor(
    private readonly createAssessmentUseCase: CreateAssessmentUseCase,
    private readonly getRiskUseCase: GetRiskUseCase,
    private readonly assessmentRepository: RiskAssessmentRepositoryPort,
  ) {}

  @RequirePermission('risk:view')
  @Get()
  async list(
    @CurrentSession() session: ValidatedSession,
    @Param('riskId', new ParseUUIDPipe()) riskId: string,
    @Query() query: PageQueryDto,
  ): Promise<AssessmentPageResponse> {
    await this.getRiskUseCase.execute({ actorUserId: session.userId, riskId });

    const { items, total } = await this.assessmentRepository.listByRisk(
      riskId,
      query.page,
      query.pageSize,
    );

    const byId = new Map(items.map((item) => [item.id, item]));
    const responses = await Promise.all(
      items.map(async (item) => toAssessmentResponse(item, await this.resolvePrevious(item, byId))),
    );

    const page = createPageResponse(
      responses,
      { page: query.page, pageSize: query.pageSize },
      total,
    );
    return {
      data: page.items,
      meta: {
        page: page.page,
        pageSize: page.pageSize,
        total: page.total,
        totalPages: page.totalPages,
      },
    };
  }

  @RequirePermission('risk:assess')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentSession() session: ValidatedSession,
    @Param('riskId', new ParseUUIDPipe()) riskId: string,
    @Headers('if-match') ifMatchHeader: string | undefined,
    @Body() body: CreateAssessmentRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AssessmentResponse> {
    const expectedVersion = parseIfMatchHeader(ifMatchHeader);

    const { assessment, risk } = await this.createAssessmentUseCase.execute({
      actorUserId: session.userId,
      riskId,
      expectedVersion,
      assessedOn: body.assessedOn,
      inherentProbability: body.inherentProbability,
      inherentImpact: body.inherentImpact,
      residualProbability: body.residualProbability,
      residualImpact: body.residualImpact,
      controlIdsConsidered: body.controlIdsConsidered,
      rationale: body.rationale,
      methodologyVersionId: body.methodologyVersionId,
      nextReviewOn: body.nextReviewOn,
    });

    response.set('Location', `${request.originalUrl.replace(/\/$/, '')}/${assessment.id}`);
    response.set('ETag', formatETag(risk.version));

    const previous = assessment.previousAssessmentId
      ? await this.assessmentRepository.findById(assessment.previousAssessmentId)
      : undefined;

    return toAssessmentResponse(assessment, previous);
  }

  private async resolvePrevious(
    item: AssessmentRecord,
    byId: ReadonlyMap<string, AssessmentRecord>,
  ): Promise<AssessmentRecord | undefined> {
    if (!item.previousAssessmentId) {
      return undefined;
    }
    return (
      byId.get(item.previousAssessmentId) ??
      this.assessmentRepository.findById(item.previousAssessmentId)
    );
  }
}
