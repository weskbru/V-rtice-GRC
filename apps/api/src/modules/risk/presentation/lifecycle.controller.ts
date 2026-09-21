/**
 * T158/T159 — `LifecycleController`: `GET /risks/{riskId}/lifecycle`,
 * `POST /risks/{riskId}/transitions`, `GET`/`POST
 * /risks/{riskId}/approvals` and `POST
 * /risks/{riskId}/approvals/{approvalId}/decision` per
 * `contracts/risks.openapi.yaml`'s "Risk Lifecycle" operations (ADR-006,
 * FR-029/FR-029a-d, FR-079 to FR-085).
 *
 * `POST /transitions` is deliberately `@NoPermissionRequired()`, not
 * `@RequirePermission(...)` — see `PerformTransitionUseCase`'s own header
 * for why a single route serving every `(from, to)` pair cannot carry one
 * static permission, and how the real, per-pair check is performed one
 * layer down instead. Every OTHER route here has one fixed, contract-stated
 * permission and uses the standard decorator.
 */
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

  /** FR-080/FR-082 — the current state, any pending-approval condition, and
   * the transitions valid from here AND permitted to this caller. */
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

  /** See this file's header for why this route is `@NoPermissionRequired()`
   * rather than a static `@RequirePermission`. `@HttpCode(HttpStatus.OK)`
   * because the contract's `transitionRisk` operation declares `200`, not
   * Nest's `@Post()` default of `201` (this endpoint applies an existing
   * risk's transition — nothing is "created"). */
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

  /**
   * FR-029b/SC-016 — every approval request and decision for this risk,
   * newest first.
   *
   * `risk:view` + scope: `GetRiskUseCase` reads the parent risk first (the
   * SAME scope/existence check `AssessmentController.list`/
   * `TreatmentController.listTreatments`/
   * `RiskRelationshipController.listControlLinks` all apply before
   * touching their own repository) — `approvals` has no `orgUnitId` of its
   * own to scope against, exactly like those other risk-child tables.
   * Previously this method called `approvalRepository.listByEntity`
   * directly, with no scope check at all: an out-of-scope risk (or one
   * this caller's role never grants `risk:view` over at all, since
   * `@RequirePermission` alone answers only "does this caller hold
   * `risk:view` ANYWHERE", never "over THIS risk") returned 200 with the
   * real approval history — a governance-activity disclosure, and a
   * byte-identical-404 (ADR-009) violation, fixed here by routing through
   * the same use case every sibling list endpoint already uses.
   */
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

  /** FR-029 — requires `risk:transition` (requesting), never
   * `risk:approve` (deciding) — the segregation-of-duties split
   * `domain/risk-lifecycle.ts`'s own header explains. */
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

  /** FR-029a — requires `risk:approve` (deciding), never `risk:transition`
   * (requesting). Segregation of duties (approver != requester) is enforced
   * inside `DecideApprovalUseCase`, in the domain, regardless of what
   * permission the caller holds. */
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
