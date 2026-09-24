import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';

import { RequirePermission } from '../../../core/authorization/presentation/permission.guard';
import { GetFrameworkVersionComplianceSummaryUseCase } from '../application/compliance-summary/get-framework-version-compliance-summary.usecase';

import {
  toComplianceSummaryResponse,
  type ComplianceSummaryResponse,
} from './dto/compliance-summary-response.mapper';

@Controller('frameworks/:frameworkId/versions/:versionId/compliance-summary')
export class ComplianceSummaryController {
  constructor(private readonly getUseCase: GetFrameworkVersionComplianceSummaryUseCase) {}

  @RequirePermission('compliance:view')
  @Get()
  async get(
    @Param('frameworkId', new ParseUUIDPipe()) frameworkId: string,
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
  ): Promise<ComplianceSummaryResponse> {
    const result = await this.getUseCase.execute({ frameworkId, versionId });
    return toComplianceSummaryResponse(result);
  }
}
