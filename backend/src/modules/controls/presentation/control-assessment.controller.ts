import {
  Body,
  Controller,
  Get,
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
import { parseIsoDate } from '../../../grc/shared/domain/iso-date';
import { createPageResponse } from '../../../shared/pagination';
import { CreateControlAssessmentUseCase } from '../application/assessments/create-control-assessment.usecase';
import { DecideControlAssessmentAttestationUseCase } from '../application/assessments/decide-control-assessment-attestation.usecase';
import { GetControlAssessmentUseCase } from '../application/assessments/get-control-assessment.usecase';
import { ListControlAssessmentsUseCase } from '../application/assessments/list-control-assessments.usecase';
import { RequestControlAssessmentAttestationUseCase } from '../application/assessments/request-control-assessment-attestation.usecase';
import { ControlAssessmentApprovalRepositoryPort } from '../domain/ports/control-assessment-approval-repository.port';

import { AssessmentPageQueryDto } from './dto/assessment-page-query.dto';
import { ControlAssessmentAttestationDecisionRequestDto } from './dto/control-assessment-attestation-decision-request.dto';
import {
  toControlAssessmentAttestationResponse,
  toControlAssessmentResponse,
  type ControlAssessmentAttestationResponse,
  type ControlAssessmentResponse,
} from './dto/control-assessment-response.mapper';
import { CreateControlAssessmentRequestDto } from './dto/create-control-assessment-request.dto';

import type { ValidatedSession } from '../../../core/sessions/application/session.service';
import type { Request, Response } from 'express';

export interface ControlAssessmentPageResponse {
  readonly data: readonly ControlAssessmentResponse[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

@Controller('controls/:controlId/assessments')
export class ControlAssessmentController {
  constructor(
    private readonly createUseCase: CreateControlAssessmentUseCase,
    private readonly listUseCase: ListControlAssessmentsUseCase,
    private readonly getUseCase: GetControlAssessmentUseCase,
    private readonly requestAttestationUseCase: RequestControlAssessmentAttestationUseCase,
    private readonly decideAttestationUseCase: DecideControlAssessmentAttestationUseCase,
    private readonly approvalRepository: ControlAssessmentApprovalRepositoryPort,
  ) {}

  @RequirePermission('control:view')
  @Get()
  async list(
    @CurrentSession() session: ValidatedSession,
    @Param('controlId', new ParseUUIDPipe()) controlId: string,
    @Query() query: AssessmentPageQueryDto,
  ): Promise<ControlAssessmentPageResponse> {
    const result = await this.listUseCase.execute({
      actorUserId: session.userId,
      controlId,
      page: query.page,
      pageSize: query.pageSize,
    });

    const items = await Promise.all(
      result.items.map(async (item) => {
        const attestation = item.approvalId
          ? await this.approvalRepository.findById(item.approvalId)
          : undefined;
        return toControlAssessmentResponse(item, attestation);
      }),
    );

    const page = createPageResponse(
      items,
      { page: result.page, pageSize: result.pageSize },
      result.total,
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

  @RequirePermission('control:test')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentSession() session: ValidatedSession,
    @Param('controlId', new ParseUUIDPipe()) controlId: string,
    @Body() body: CreateControlAssessmentRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ControlAssessmentResponse> {
    const assessment = await this.createUseCase.execute({
      actorUserId: session.userId,
      controlId,
      assessedOn: parseIsoDate(body.assessedOn),
      result: body.result,
      conclusion: body.conclusion,
    });

    response.set('Location', `${request.originalUrl.replace(/\/$/, '')}/${assessment.id}`);

    return toControlAssessmentResponse(assessment, undefined);
  }

  @RequirePermission('control:view')
  @Get(':assessmentId')
  async findById(
    @CurrentSession() session: ValidatedSession,
    @Param('controlId', new ParseUUIDPipe()) controlId: string,
    @Param('assessmentId', new ParseUUIDPipe()) assessmentId: string,
  ): Promise<ControlAssessmentResponse> {
    const assessment = await this.getUseCase.execute({
      actorUserId: session.userId,
      controlId,
      assessmentId,
    });
    const attestation = assessment.approvalId
      ? await this.approvalRepository.findById(assessment.approvalId)
      : undefined;
    return toControlAssessmentResponse(assessment, attestation);
  }

  @RequirePermission('control:test')
  @Post(':assessmentId/attestation')
  @HttpCode(HttpStatus.CREATED)
  async requestAttestation(
    @CurrentSession() session: ValidatedSession,
    @Param('controlId', new ParseUUIDPipe()) controlId: string,
    @Param('assessmentId', new ParseUUIDPipe()) assessmentId: string,
  ): Promise<ControlAssessmentAttestationResponse> {
    const approval = await this.requestAttestationUseCase.execute({
      actorUserId: session.userId,
      controlId,
      assessmentId,
    });
    return toControlAssessmentAttestationResponse(approval);
  }

  @RequirePermission('control:approve')
  @Post(':assessmentId/attestation/decision')
  @HttpCode(HttpStatus.OK)
  async decideAttestation(
    @CurrentSession() session: ValidatedSession,
    @Param('controlId', new ParseUUIDPipe()) controlId: string,
    @Param('assessmentId', new ParseUUIDPipe()) assessmentId: string,
    @Body() body: ControlAssessmentAttestationDecisionRequestDto,
  ): Promise<ControlAssessmentAttestationResponse> {
    const approval = await this.decideAttestationUseCase.execute({
      actorUserId: session.userId,
      controlId,
      assessmentId,
      decision: body.decision,
      justification: body.justification,
    });
    return toControlAssessmentAttestationResponse(approval);
  }
}
