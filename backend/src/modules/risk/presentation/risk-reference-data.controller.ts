import { Controller, Get, Query } from '@nestjs/common';

import { NoPermissionRequired } from '../../../core/authorization/presentation/permission.guard';
import { ListRiskReferenceDataUseCase } from '../application/list-risk-reference-data.usecase';

import { ReferenceDataQueryDto } from './dto/reference-data-query.dto';

import type { ReferenceDataItemRecord } from '../domain/ports/risk-reference-data.port';

@Controller()
export class RiskReferenceDataController {
  constructor(private readonly listReferenceData: ListRiskReferenceDataUseCase) {}

  @NoPermissionRequired()
  @Get('risk-categories')
  listCategories(
    @Query() query: ReferenceDataQueryDto,
  ): Promise<readonly ReferenceDataItemRecord[]> {
    return this.listReferenceData.listCategories(query.includeInactive);
  }

  @NoPermissionRequired()
  @Get('risk-types')
  listTypes(@Query() query: ReferenceDataQueryDto): Promise<readonly ReferenceDataItemRecord[]> {
    return this.listReferenceData.listTypes(query.includeInactive);
  }

  @NoPermissionRequired()
  @Get('risk-origins')
  listOrigins(@Query() query: ReferenceDataQueryDto): Promise<readonly ReferenceDataItemRecord[]> {
    return this.listReferenceData.listOrigins(query.includeInactive);
  }
}
