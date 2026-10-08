import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';

import { RequirePermission } from '../../../core/authorization/presentation/permission.guard';
import { CurrentSession } from '../../../core/identity/presentation/current-session.decorator';
import { createPageResponse } from '../../../shared/pagination';
import { GetRiskHistoryUseCase } from '../application/get-risk-history.usecase';

import { ListRiskHistoryQueryDto } from './dto/list-risk-history-query.dto';
import {
  toRiskHistoryEntryResponse,
  type RiskHistoryEntryResponse,
} from './dto/risk-history-entry-response.mapper';

import type { ValidatedSession } from '../../../core/sessions/application/session.service';

export interface RiskHistoryPageResponse {
  readonly data: readonly RiskHistoryEntryResponse[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

@Controller('risks/:riskId')
export class HistoryController {
  constructor(private readonly getRiskHistoryUseCase: GetRiskHistoryUseCase) {}

  @RequirePermission('risk:view')
  @Get('history')
  async getHistory(
    @CurrentSession() session: ValidatedSession,
    @Param('riskId', new ParseUUIDPipe()) riskId: string,
    @Query() query: ListRiskHistoryQueryDto,
  ): Promise<RiskHistoryPageResponse> {
    const { items, total } = await this.getRiskHistoryUseCase.execute({
      actorUserId: session.userId,
      riskId,
      types: query.type,
      page: query.page,
      pageSize: query.pageSize,
    });

    const page = createPageResponse(items, { page: query.page, pageSize: query.pageSize }, total);

    return {
      data: page.items.map(toRiskHistoryEntryResponse),
      meta: {
        page: page.page,
        pageSize: page.pageSize,
        total: page.total,
        totalPages: page.totalPages,
      },
    };
  }
}
