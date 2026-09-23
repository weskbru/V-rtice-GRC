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
  Req,
  Res,
} from '@nestjs/common';

import {
  NoPermissionRequired,
  RequirePermission,
} from '../../../core/authorization/presentation/permission.guard';
import { CurrentSession } from '../../../core/identity/presentation/current-session.decorator';
import { DecideApprovalUseCase } from '../application/approvals/decide-approval.usecase';
import { RequestApprovalUseCase } from '../application/approvals/request-approval.usecase';
import { GetRiskUseCase } from '../application/get-risk.usecase';
import { GetRiskLifecycleUseCase } from '../application/lifecycle/get-risk-lifecycle.usecase';
import { PerformTransitionUseCase } from '../application/perform-transition.usecase';
import { ApprovalRepositoryPort } from '../domain/ports/approval-repository.port';

import { ApprovalDecisionRequestDto } from './dto/approval-decision-request.dto';
import { toApprovalResponse, type ApprovalResponse } from './dto/approval-response.mapper';
import {
  toLifecycleTransitionResponse,
  type LifecycleTransitionResponse,
} from './dto/lifecycle-transition-response.mapper';
import { RequestApprovalRequestDto } from './dto/request-approval-request.dto';
import {
  toRiskLifecycleStateResponse,
  type RiskLifecycleStateResponse,
} from './dto/risk-lifecycle-state-response.mapper';
import { TransitionRiskRequestDto } from './dto/transition-risk-request.dto';
import { formatETag, parseIfMatchHeader } from './risk.controller';

import type { ValidatedSession } from '../../../core/sessions/application/session.service';
import type { Request, Response } from 'express';

@Controller('risks/:riskId')
export class LifecycleController {
  constructor(
    private readonly getRiskLifecycleUseCase: GetRiskLifecycleUseCase,
    private readonly getRiskUseCase: GetRiskUseCase,
    private readonly performTransitionUseCase: PerformTransitionUseCase,
    private readonly requestApprovalUseCase: RequestApprovalUseCase,
    private readonly decideApprovalUseCase: DecideApprovalUseCase,
    private readonly approvalRepository: ApprovalRepositoryPort,
  ) {}

  @RequirePermission('risk:view')
  @Get('lifecycle')
  async getLifecycle(
    @CurrentSession() session: ValidatedSession,
    @Param('riskId', new ParseUUIDPipe()) riskId: string,
  ): Promise<RiskLifecycleStateResponse> {
    const state = await this.getRiskLifecycleUseCase.execute({
      actorUserId: session.userId,
      riskId,
    });
    return toRiskLifecycleStateResponse(state);
  }

  @NoPermissionRequired()
  @Post('transitions')
  @HttpCode(HttpStatus.OK)
  async transition(
    @CurrentSession() session: ValidatedSession,
    @Param('riskId', new ParseUUIDPipe()) riskId: string,
    @Headers('if-match') ifMatchHeader: string | undefined,
    @Body() body: TransitionRiskRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LifecycleTransitionResponse> {
    const expectedVersion = parseIfMatchHeader(ifMatchHeader);

    const { transition, risk } = await this.performTransitionUseCase.execute({
      actorUserId: session.userId,
      riskId,
      expectedVersion,
      toStatus: body.toStatus,
      justification: body.justification,
    });

    response.set('ETag', formatETag(risk.version));

    return toLifecycleTransitionResponse(transition);
  }

  @RequirePermission('risk:view')
  @Get('approvals')
  async listApprovals(
    @CurrentSession() session: ValidatedSession,
    @Param('riskId', new ParseUUIDPipe()) riskId: string,
  ): Promise<readonly ApprovalResponse[]> {
    await this.getRiskUseCase.execute({ actorUserId: session.userId, riskId });

    const approvals = await this.approvalRepository.listByEntity('RISK', riskId);
    return approvals.map(toApprovalResponse);
  }

  @RequirePermission('risk:transition')
  @Post('approvals')
  @HttpCode(HttpStatus.CREATED)
  async requestApproval(
    @CurrentSession() session: ValidatedSession,
    @Param('riskId', new ParseUUIDPipe()) riskId: string,
    @Headers('if-match') ifMatchHeader: string | undefined,
    @Body() body: RequestApprovalRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApprovalResponse> {
    const expectedVersion = parseIfMatchHeader(ifMatchHeader);

    const { approval, risk } = await this.requestApprovalUseCase.execute({
      actorUserId: session.userId,
      riskId,
      expectedVersion,
      toStatus: body.toStatus,
      justification: body.justification,
    });

    response.set('Location', `${request.originalUrl.replace(/\/$/, '')}/${approval.id}`);
    response.set('ETag', formatETag(risk.version));

    return toApprovalResponse(approval);
  }

  @RequirePermission('risk:approve')
  @Post('approvals/:approvalId/decision')
  @HttpCode(HttpStatus.OK)
  async decideApproval(
    @CurrentSession() session: ValidatedSession,
    @Param('riskId', new ParseUUIDPipe()) riskId: string,
    @Param('approvalId', new ParseUUIDPipe()) approvalId: string,
    @Headers('if-match') ifMatchHeader: string | undefined,
    @Body() body: ApprovalDecisionRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApprovalResponse> {
    const expectedVersion = parseIfMatchHeader(ifMatchHeader);

    const { approval, risk } = await this.decideApprovalUseCase.execute({
      actorUserId: session.userId,
      riskId,
      approvalId,
      expectedVersion,
      decision: body.decision,
      justification: body.justification,
    });

    response.set('ETag', formatETag(risk.version));

    return toApprovalResponse(approval);
  }
}
