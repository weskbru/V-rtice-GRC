import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { RequirePermission } from '../../../core/authorization/presentation/permission.guard';
import { CurrentSession } from '../../../core/identity/presentation/current-session.decorator';
import { CreateIndicatorDefinitionUseCase } from '../application/create-indicator-definition.usecase';
import { CreateIndicatorMeasurementUseCase } from '../application/create-indicator-measurement.usecase';
import { GetIndicatorCurrentValueUseCase } from '../application/get-indicator-current-value.usecase';
import { GetIndicatorDefinitionUseCase } from '../application/get-indicator-definition.usecase';
import { ListIndicatorDefinitionsUseCase } from '../application/list-indicator-definitions.usecase';
import { ListIndicatorMeasurementsUseCase } from '../application/list-indicator-measurements.usecase';
import { ListIndicatorMetricKeysUseCase } from '../application/list-indicator-metric-keys.usecase';
import { UpdateIndicatorDefinitionUseCase } from '../application/update-indicator-definition.usecase';

import { CreateIndicatorDefinitionRequestDto } from './dto/create-indicator-definition-request.dto';
import { toIndicatorCurrentValueResponse } from './dto/indicator-current-value-response.mapper';
import { toIndicatorDefinitionResponse } from './dto/indicator-definition-response.mapper';
import { toIndicatorMeasurementResponse } from './dto/indicator-measurement-response.mapper';
import { toIndicatorMetricCatalogEntryResponse } from './dto/indicator-metric-catalog-entry-response.mapper';
import { ListIndicatorDefinitionsQueryDto } from './dto/list-indicator-definitions-query.dto';
import { ListIndicatorMeasurementsQueryDto } from './dto/list-indicator-measurements-query.dto';
import { UpdateIndicatorDefinitionRequestDto } from './dto/update-indicator-definition-request.dto';

import type { IndicatorCurrentValueResponse } from './dto/indicator-current-value-response.mapper';
import type { IndicatorDefinitionResponse } from './dto/indicator-definition-response.mapper';
import type { IndicatorMeasurementResponse } from './dto/indicator-measurement-response.mapper';
import type { IndicatorMetricCatalogEntryResponse } from './dto/indicator-metric-catalog-entry-response.mapper';
import type { ValidatedSession } from '../../../core/sessions/application/session.service';

export interface IndicatorDefinitionPageResponse {
  readonly data: readonly IndicatorDefinitionResponse[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

export interface IndicatorMeasurementPageResponse {
  readonly data: readonly IndicatorMeasurementResponse[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

@Controller('indicators')
export class IndicatorController {
  constructor(
    private readonly listIndicatorDefinitionsUseCase: ListIndicatorDefinitionsUseCase,
    private readonly createIndicatorDefinitionUseCase: CreateIndicatorDefinitionUseCase,
    private readonly listIndicatorMetricKeysUseCase: ListIndicatorMetricKeysUseCase,
    private readonly getIndicatorDefinitionUseCase: GetIndicatorDefinitionUseCase,
    private readonly updateIndicatorDefinitionUseCase: UpdateIndicatorDefinitionUseCase,
    private readonly getIndicatorCurrentValueUseCase: GetIndicatorCurrentValueUseCase,
    private readonly createIndicatorMeasurementUseCase: CreateIndicatorMeasurementUseCase,
    private readonly listIndicatorMeasurementsUseCase: ListIndicatorMeasurementsUseCase,
  ) {}

  @RequirePermission('indicator:view')
  @Get()
  async list(
    @Query() query: ListIndicatorDefinitionsQueryDto,
  ): Promise<IndicatorDefinitionPageResponse> {
    const result = await this.listIndicatorDefinitionsUseCase.execute({
      page: query.page,
      pageSize: query.pageSize,
      isActive: query.isActive,
    });

    const totalPages = query.pageSize > 0 ? Math.ceil(result.total / query.pageSize) : 0;

    return {
      data: result.items.map((item) => toIndicatorDefinitionResponse(item.record, item.owner)),
      meta: { page: query.page, pageSize: query.pageSize, total: result.total, totalPages },
    };
  }

  @RequirePermission('indicator:create')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentSession() session: ValidatedSession,
    @Body() body: CreateIndicatorDefinitionRequestDto,
  ): Promise<IndicatorDefinitionResponse> {
    const result = await this.createIndicatorDefinitionUseCase.execute({
      actorUserId: session.userId,
      metricKey: body.metricKey,
      name: body.name,
      description: body.description,
      ownerUserId: body.ownerUserId,
      thresholdComparator: body.thresholdComparator,
      thresholdValue: body.thresholdValue,
    });

    return toIndicatorDefinitionResponse(result.record, result.owner);
  }

  @RequirePermission('indicator:view')
  @Get('metric-keys')
  async listMetricKeys(): Promise<readonly IndicatorMetricCatalogEntryResponse[]> {
    const summaries = await this.listIndicatorMetricKeysUseCase.execute();
    return summaries.map(toIndicatorMetricCatalogEntryResponse);
  }

  @RequirePermission('indicator:view')
  @Get(':definitionId')
  async getById(
    @Param('definitionId', new ParseUUIDPipe()) definitionId: string,
  ): Promise<IndicatorDefinitionResponse> {
    const result = await this.getIndicatorDefinitionUseCase.execute(definitionId);
    return toIndicatorDefinitionResponse(result.record, result.owner);
  }

  @RequirePermission('indicator:edit')
  @Patch(':definitionId')
  async update(
    @CurrentSession() session: ValidatedSession,
    @Param('definitionId', new ParseUUIDPipe()) definitionId: string,
    @Body() body: UpdateIndicatorDefinitionRequestDto,
  ): Promise<IndicatorDefinitionResponse> {
    const result = await this.updateIndicatorDefinitionUseCase.execute({
      actorUserId: session.userId,
      definitionId,
      name: body.name,
      description: body.description,
      ownerUserId: body.ownerUserId,
      thresholdComparator: body.thresholdComparator,
      thresholdValue: body.thresholdValue,
      isActive: body.isActive,
    });

    return toIndicatorDefinitionResponse(result.record, result.owner);
  }

  @RequirePermission('indicator:view')
  @Get(':metricKey/current')
  async getCurrentValue(
    @CurrentSession() session: ValidatedSession,
    @Param('metricKey') metricKey: string,
  ): Promise<IndicatorCurrentValueResponse> {
    const result = await this.getIndicatorCurrentValueUseCase.execute({
      actorUserId: session.userId,
      metricKey,
    });

    return toIndicatorCurrentValueResponse(result);
  }

  @RequirePermission('indicator:edit')
  @Post(':metricKey/measurements')
  @HttpCode(HttpStatus.CREATED)
  async createMeasurement(
    @CurrentSession() session: ValidatedSession,
    @Param('metricKey') metricKey: string,
  ): Promise<IndicatorMeasurementResponse> {
    const result = await this.createIndicatorMeasurementUseCase.execute({
      actorUserId: session.userId,
      metricKey,
    });

    return toIndicatorMeasurementResponse(result.record, result.computedBy);
  }

  @RequirePermission('indicator:view')
  @Get(':metricKey/measurements')
  async listMeasurements(
    @CurrentSession() session: ValidatedSession,
    @Param('metricKey') metricKey: string,
    @Query() query: ListIndicatorMeasurementsQueryDto,
  ): Promise<IndicatorMeasurementPageResponse> {
    const result = await this.listIndicatorMeasurementsUseCase.execute({
      actorUserId: session.userId,
      metricKey,
      page: query.page,
      pageSize: query.pageSize,
    });

    const totalPages = query.pageSize > 0 ? Math.ceil(result.total / query.pageSize) : 0;

    return {
      data: result.items.map((item) =>
        toIndicatorMeasurementResponse(item.record, item.computedBy),
      ),
      meta: { page: query.page, pageSize: query.pageSize, total: result.total, totalPages },
    };
  }
}
