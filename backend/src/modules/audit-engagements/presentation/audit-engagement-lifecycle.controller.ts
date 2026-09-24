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
      justification: body.justification ?? '',
      expectedVersion,
    });

    response.set('ETag', formatETag(record.version));

    return toAuditEngagementResponse(record);
  }
}
