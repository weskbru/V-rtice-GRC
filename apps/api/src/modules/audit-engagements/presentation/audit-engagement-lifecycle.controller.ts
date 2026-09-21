/**
 * T040/005-audit-findings, User Story 1 — `AuditEngagementLifecycleController`:
 * `POST /audits/{auditId}/start`, `POST /audits/{auditId}/complete`,
 * `POST /audits/{auditId}/cancel` (`startAuditEngagement`,
 * `completeAuditEngagement`, `cancelAuditEngagement` — operations 9-11 of
 * 11, the last amended into `contracts/audit.openapi.yaml` for FR-004a).
 *
 * Unlike `ControlLifecycleController`'s single `POST /transitions` route
 * (one endpoint serving every `(from, to)` pair, gated dynamically because
 * a static permission cannot fit all of them), every legal `AuditEngagement`
 * transition is gated by the SAME single permission, `audit-engagement:transition`
 * (data-model.md §10, `audit-engagement-permissions.ts`) — so each
 * transition gets its own route with a plain, static `@RequirePermission`,
 * mirroring `RiskLifecycleController`'s own per-transition-route shape
 * rather than Control's dynamic one.
 */
import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from '@nestjs/common';

import { RequirePermission } from '../../../core/authorization/presentation/permission.guard';
import { CurrentSession } from '../../../core/identity/presentation/current-session.decorator';
import { CancelAuditEngagementUseCase } from '../application/cancel-audit-engagement.usecase';
import { CompleteAuditEngagementUseCase } from '../application/complete-audit-engagement.usecase';
import { StartAuditEngagementUseCase } from '../application/start-audit-engagement.usecase';

import { formatETag, parseIfMatchHeader } from './audit-engagement.controller';
import {
  toAuditEngagementResponse,
  type AuditEngagementResponse,
} from './dto/audit-engagement-response.mapper';
import { CancelAuditEngagementRequestDto } from './dto/cancel-audit-engagement-request.dto';

import type { ValidatedSession } from '../../../core/sessions/application/session.service';
import type { Response } from 'express';

@Controller('audits/:auditId')
export class AuditEngagementLifecycleController {
  constructor(
    private readonly startAuditEngagementUseCase: StartAuditEngagementUseCase,
    private readonly completeAuditEngagementUseCase: CompleteAuditEngagementUseCase,
    private readonly cancelAuditEngagementUseCase: CancelAuditEngagementUseCase,
  ) {}

  /** `startAuditEngagement`. `PLANNING -> IN_PROGRESS`, refused `422` with
   * no scope link (FR-003). */
  @RequirePermission('audit-engagement:transition')
  @Post('start')
  @HttpCode(HttpStatus.OK)
  async start(
    @CurrentSession() session: ValidatedSession,
    @Param('auditId', new ParseUUIDPipe()) auditId: string,
    @Headers('if-match') ifMatchHeader: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuditEngagementResponse> {
    const expectedVersion = parseIfMatchHeader(ifMatchHeader);

    const record = await this.startAuditEngagementUseCase.execute({
      actorUserId: session.userId,
      auditEngagementId: auditId,
      expectedVersion,
    });

    response.set('ETag', formatETag(record.version));

    return toAuditEngagementResponse(record);
  }

  /** `completeAuditEngagement`. `IN_PROGRESS -> COMPLETED`, terminal. */
  @RequirePermission('audit-engagement:transition')
  @Post('complete')
  @HttpCode(HttpStatus.OK)
  async complete(
    @CurrentSession() session: ValidatedSession,
    @Param('auditId', new ParseUUIDPipe()) auditId: string,
    @Headers('if-match') ifMatchHeader: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuditEngagementResponse> {
    const expectedVersion = parseIfMatchHeader(ifMatchHeader);

    const record = await this.completeAuditEngagementUseCase.execute({
      actorUserId: session.userId,
      auditEngagementId: auditId,
      expectedVersion,
    });

    response.set('ETag', formatETag(record.version));

    return toAuditEngagementResponse(record);
  }

  /** `cancelAuditEngagement` (FR-004a). `PLANNING -> CANCELLED` or
   * `IN_PROGRESS -> CANCELLED`, terminal, requires a non-empty
   * `justification`. */
  @RequirePermission('audit-engagement:transition')
  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @CurrentSession() session: ValidatedSession,
    @Param('auditId', new ParseUUIDPipe()) auditId: string,
    @Headers('if-match') ifMatchHeader: string | undefined,
    @Body() body: CancelAuditEngagementRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuditEngagementResponse> {
    const expectedVersion = parseIfMatchHeader(ifMatchHeader);

    const record = await this.cancelAuditEngagementUseCase.execute({
      actorUserId: session.userId,
      auditEngagementId: auditId,
      // `CancelAuditEngagementRequestDto.justification` is DTO-optional
      // (see that file's own header) — the empty-string fallback lets
      // `assertCancellationJustificationProvided` (called inside the use
      // case) refuse an omitted justification with `422`, never a `400`
      // this controller would otherwise have to throw itself.
      justification: body.justification ?? '',
      expectedVersion,
    });

    response.set('ETag', formatETag(record.version));

    return toAuditEngagementResponse(record);
  }
}
