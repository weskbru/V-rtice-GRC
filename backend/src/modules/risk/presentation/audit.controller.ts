import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';

import { NoPermissionRequired } from '../../../core/authorization/presentation/permission.guard';
import { CurrentSession } from '../../../core/identity/presentation/current-session.decorator';
import { createPageResponse } from '../../../shared/pagination';
import { ListRiskAuditEventsUseCase } from '../application/list-risk-audit-events.usecase';

import { toAuditEventResponse, type AuditEventResponse } from './dto/audit-event-response.mapper';
import { ListRiskAuditEventsQueryDto } from './dto/list-risk-audit-events-query.dto';

import type { ValidatedSession } from '../../../core/sessions/application/session.service';

export interface RiskAuditEventsPageResponse {
  readonly data: readonly AuditEventResponse[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

@Controller('risks/:riskId')
export class AuditController {
  constructor(private readonly listRiskAuditEventsUseCase: ListRiskAuditEventsUseCase) {}

  @NoPermissionRequired()
  @Get('audit-events')
  async list(
    @CurrentSession() session: ValidatedSession,
    @Param('riskId', new ParseUUIDPipe()) riskId: string,
    @Query() query: ListRiskAuditEventsQueryDto,
  ): Promise<RiskAuditEventsPageResponse> {
    const { items, total } = await this.listRiskAuditEventsUseCase.execute({
      actorUserId: session.userId,
      riskId,
      action: query.action,
      actorUserIdFilter: query.actorUserId,
      occurredFrom: query.occurredFrom ? new Date(query.occurredFrom) : undefined,
      occurredTo: query.occurredTo ? new Date(query.occurredTo) : undefined,
      page: query.page,
      pageSize: query.pageSize,
    });

    const page = createPageResponse(items, { page: query.page, pageSize: query.pageSize }, total);

    return {
      data: page.items.map(toAuditEventResponse),
      meta: {
        page: page.page,
        pageSize: page.pageSize,
        total: page.total,
        totalPages: page.totalPages,
      },
    };
  }
}
