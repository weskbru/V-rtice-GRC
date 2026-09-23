import { Controller, Get } from '@nestjs/common';

import { NoPermissionRequired } from '../../../core/authorization/presentation/permission.guard';
import { CurrentSession } from '../../../core/identity/presentation/current-session.decorator';
import { GetDashboardUseCase } from '../application/get-dashboard.usecase';

import { toDashboardResponse, type DashboardResponse } from './dto/dashboard-response.mapper';

import type { ValidatedSession } from '../../../core/sessions/application/session.service';

@Controller()
export class DashboardController {
  constructor(private readonly getDashboardUseCase: GetDashboardUseCase) {}

  @NoPermissionRequired()
  @Get('dashboard')
  async getDashboard(@CurrentSession() session: ValidatedSession): Promise<DashboardResponse> {
    const output = await this.getDashboardUseCase.execute({ actorUserId: session.userId });
    return toDashboardResponse(output);
  }
}
