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
import { parseIsoDate } from '../../../grc/shared/domain/iso-date';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { CreateAuditEngagementUseCase } from '../application/create-audit-engagement.usecase';
import { GetAuditEngagementUseCase } from '../application/get-audit-engagement.usecase';
import { ListAuditEngagementUseCase } from '../application/list-audit-engagement.usecase';
import { UpdateAuditEngagementUseCase } from '../application/update-audit-engagement.usecase';

import {
  toAuditEngagementResponse,
  type AuditEngagementResponse,
} from './dto/audit-engagement-response.mapper';
import { CreateAuditEngagementRequestDto } from './dto/create-audit-engagement-request.dto';
import { ListAuditEngagementsQueryDto } from './dto/list-audit-engagements-query.dto';
import { UpdateAuditEngagementRequestDto } from './dto/update-audit-engagement-request.dto';

import type { ValidatedSession } from '../../../core/sessions/application/session.service';
import type { Request, Response } from 'express';

export interface AuditEngagementPageResponse {
  readonly data: readonly AuditEngagementResponse[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

@Controller('audits')
export class AuditEngagementController {
  constructor(
    private readonly createAuditEngagementUseCase: CreateAuditEngagementUseCase,
    private readonly getAuditEngagementUseCase: GetAuditEngagementUseCase,
    private readonly listAuditEngagementUseCase: ListAuditEngagementUseCase,
    private readonly updateAuditEngagementUseCase: UpdateAuditEngagementUseCase,
  ) {}

  @RequirePermission('audit-engagement:view')
  @Get()
  async list(
    @CurrentSession() session: ValidatedSession,
    @Query() query: ListAuditEngagementsQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuditEngagementPageResponse> {
    const result = await this.listAuditEngagementUseCase.execute({
      actorUserId: session.userId,
      page: query.page,
      pageSize: query.pageSize,
      status: query.status ? [query.status] : undefined,
      orgUnitId: query.orgUnitId ? [query.orgUnitId] : undefined,
      leadAuditorUserId: query.leadAuditorUserId ? [query.leadAuditorUserId] : undefined,
      sortField: query.sort,
      sortDirection: query.direction,
    });

    response.set('Cache-Control', 'no-store');

    return {
      data: result.items.map(toAuditEngagementResponse),
      meta: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }

  @RequirePermission('audit-engagement:create')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentSession() session: ValidatedSession,
    @Body() body: CreateAuditEngagementRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuditEngagementResponse> {
    const record = await this.createAuditEngagementUseCase.execute({
      actorUserId: session.userId,
      objective: body.objective,
      periodStart: parseIsoDate(body.periodStart),
      periodEnd: parseIsoDate(body.periodEnd),
      orgUnitId: body.orgUnitId,
      leadAuditorUserId: body.leadAuditorUserId,
    });

    response.set('Location', `${request.originalUrl.replace(/\/$/, '')}/${record.id}`);
    response.set('ETag', formatETag(record.version));

    return toAuditEngagementResponse(record);
  }

  @RequirePermission('audit-engagement:view')
  @Get(':auditId')
  async findById(
    @CurrentSession() session: ValidatedSession,
    @Param('auditId', new ParseUUIDPipe()) auditId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuditEngagementResponse> {
    const record = await this.getAuditEngagementUseCase.execute({
      actorUserId: session.userId,
      auditEngagementId: auditId,
    });

    response.set('ETag', formatETag(record.version));
    response.set('Cache-Control', 'no-store');

    return toAuditEngagementResponse(record);
  }

  @RequirePermission('audit-engagement:edit')
  @Patch(':auditId')
  async update(
    @CurrentSession() session: ValidatedSession,
    @Param('auditId', new ParseUUIDPipe()) auditId: string,
    @Headers('if-match') ifMatchHeader: string | undefined,
    @Body() body: UpdateAuditEngagementRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuditEngagementResponse> {
    const expectedVersion = parseIfMatchHeader(ifMatchHeader);
    assertUpdateBodyNotEmpty(body);

    const record = await this.updateAuditEngagementUseCase.execute({
      actorUserId: session.userId,
      auditEngagementId: auditId,
      expectedVersion,
      objective: body.objective,
      periodStart: body.periodStart ? parseIsoDate(body.periodStart) : undefined,
      periodEnd: body.periodEnd ? parseIsoDate(body.periodEnd) : undefined,
      orgUnitId: body.orgUnitId,
      leadAuditorUserId: body.leadAuditorUserId,
    });

    response.set('ETag', formatETag(record.version));

    return toAuditEngagementResponse(record);
  }
}

export function formatETag(version: number): string {
  return `"${String(version)}"`;
}

export function parseIfMatchHeader(headerValue: string | undefined): number {
  if (headerValue === undefined || headerValue.trim().length === 0) {
    throw new BadRequestException({
      title: USER_MESSAGES.problemTitle.badRequest,
      detail: USER_MESSAGES.auditEngagements.ifMatchRequired,
    });
  }

  const unquoted = headerValue.trim().replace(/^"|"$/g, '');
  const version = Number(unquoted);

  if (!Number.isInteger(version) || version < 0) {
    throw new BadRequestException({
      title: USER_MESSAGES.problemTitle.badRequest,
      detail: USER_MESSAGES.auditEngagements.ifMatchInvalid,
    });
  }

  return version;
}

function assertUpdateBodyNotEmpty(body: UpdateAuditEngagementRequestDto): void {
  if (!Object.values(body).some((value) => value !== undefined)) {
    throw new BadRequestException({
      title: USER_MESSAGES.problemTitle.badRequest,
      detail: USER_MESSAGES.auditEngagements.updateRequestEmpty,
    });
  }
}
