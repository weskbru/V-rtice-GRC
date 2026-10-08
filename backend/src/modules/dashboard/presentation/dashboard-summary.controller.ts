import { Controller, Get } from '@nestjs/common';

import { NoPermissionRequired } from '../../../core/authorization/presentation/permission.guard';
import { CurrentSession } from '../../../core/identity/presentation/current-session.decorator';
import { GetDashboardSummaryUseCase } from '../application/get-dashboard-summary.usecase';

import {
  toDashboardSummaryResponse,
  type DashboardSummaryResponse,
} from './dto/dashboard-summary-response.mapper';

import type { ValidatedSession } from '../../../core/sessions/application/session.service';

@Controller()
export class DashboardSummaryController {
  constructor(private readonly getDashboardSummaryUseCase: GetDashboardSummaryUseCase) {}

  @NoPermissionRequired()
  @Get('dashboard/summary')
  async getSummary(@CurrentSession() session: ValidatedSession): Promise<DashboardSummaryResponse> {
    const output = await this.getDashboardSummaryUseCase.execute({
      actorUserId: session.userId,
    });
    return toDashboardSummaryResponse(output);
  }
}
