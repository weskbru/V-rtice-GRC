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

import {
  NoPermissionRequired,
  RequirePermission,
} from '../../../core/authorization/presentation/permission.guard';
import { CurrentSession } from '../../../core/identity/presentation/current-session.decorator';
import { CreateFindingFromEngagementUseCase } from '../application/create-finding-from-engagement.usecase';
import { ListAuditEngagementFindingsUseCase } from '../application/list-audit-engagement-findings.usecase';

import { CreateFindingFromEngagementRequestDto } from './dto/create-finding-from-engagement-request.dto';
import {
  toFindingSummaryResponse,
  type FindingSummaryResponse,
} from './dto/finding-summary-response.mapper';
import { ListAuditEngagementFindingsQueryDto } from './dto/list-audit-engagement-findings-query.dto';

import type { ValidatedSession } from '../../../core/sessions/application/session.service';
import type { Request, Response } from 'express';

export interface AuditEngagementFindingsPageResponse {
  readonly data: readonly FindingSummaryResponse[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

@Controller('audits/:auditId/findings')
export class AuditEngagementFindingController {
  constructor(
    private readonly createFindingFromEngagementUseCase: CreateFindingFromEngagementUseCase,
    private readonly listAuditEngagementFindingsUseCase: ListAuditEngagementFindingsUseCase,
  ) {}

  @RequirePermission('audit-engagement:view')
  @Get()
  async list(
    @CurrentSession() session: ValidatedSession,
    @Param('auditId', new ParseUUIDPipe()) auditId: string,
    @Query() query: ListAuditEngagementFindingsQueryDto,
  ): Promise<AuditEngagementFindingsPageResponse> {
    const result = await this.listAuditEngagementFindingsUseCase.execute({
      actorUserId: session.userId,
      auditEngagementId: auditId,
      status: query.status,
      page: query.page,
      pageSize: query.pageSize,
    });

    return {
      data: result.items.map(toFindingSummaryResponse),
      meta: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }

  @NoPermissionRequired()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentSession() session: ValidatedSession,
    @Param('auditId', new ParseUUIDPipe()) auditId: string,
    @Body() body: CreateFindingFromEngagementRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<FindingSummaryResponse> {
    const record = await this.createFindingFromEngagementUseCase.execute({
      actorUserId: session.userId,
      auditEngagementId: auditId,
      title: body.title,
      description: body.description,
      recommendation: body.recommendation,
      category: body.category,
      origin: body.origin,
      severity: body.severity,
      priority: body.priority,
      ownerUserId: body.ownerUserId,
      identifiedOn: body.identifiedOn,
    });

    const apiPrefix = request.originalUrl.split('/audits/')[0];
    response.set('Location', `${apiPrefix}/findings/${record.id}`);

    return toFindingSummaryResponse(record);
  }
}
