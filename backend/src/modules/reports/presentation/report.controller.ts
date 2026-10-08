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
  Res,
} from '@nestjs/common';

import { RequirePermission } from '../../../core/authorization/presentation/permission.guard';
import { buildContentDispositionHeader } from '../../../core/files/presentation/content-disposition';
import { CurrentSession } from '../../../core/identity/presentation/current-session.decorator';
import { CreateReportDefinitionUseCase } from '../application/create-report-definition.usecase';
import { ExportReportCsvUseCase } from '../application/export-report-csv.usecase';
import { GetReportDefinitionUseCase } from '../application/get-report-definition.usecase';
import { ListReportDefinitionsUseCase } from '../application/list-report-definitions.usecase';
import { RunReportUseCase } from '../application/run-report.usecase';
import { UpdateReportDefinitionUseCase } from '../application/update-report-definition.usecase';

import { CreateReportDefinitionRequestDto } from './dto/create-report-definition-request.dto';
import { ListReportDefinitionsQueryDto } from './dto/list-report-definitions-query.dto';
import { toReportDefinitionResponse } from './dto/report-definition-response.mapper';
import { toReportRunResultResponse } from './dto/report-run-result-response.mapper';
import { RunReportQueryDto } from './dto/run-report-query.dto';
import { UpdateReportDefinitionRequestDto } from './dto/update-report-definition-request.dto';

import type { ReportDefinitionResponse } from './dto/report-definition-response.mapper';
import type { ValidatedSession } from '../../../core/sessions/application/session.service';
import type { Response } from 'express';

export interface ReportDefinitionPageResponse {
  readonly data: readonly ReportDefinitionResponse[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

@Controller('reports')
export class ReportController {
  constructor(
    private readonly listReportDefinitionsUseCase: ListReportDefinitionsUseCase,
    private readonly createReportDefinitionUseCase: CreateReportDefinitionUseCase,
    private readonly getReportDefinitionUseCase: GetReportDefinitionUseCase,
    private readonly updateReportDefinitionUseCase: UpdateReportDefinitionUseCase,
    private readonly runReportUseCase: RunReportUseCase,
    private readonly exportReportCsvUseCase: ExportReportCsvUseCase,
  ) {}

  @RequirePermission('report:view')
  @Get()
  async list(@Query() query: ListReportDefinitionsQueryDto): Promise<ReportDefinitionPageResponse> {
    const result = await this.listReportDefinitionsUseCase.execute({
      page: query.page,
      pageSize: query.pageSize,
      isActive: query.isActive,
    });

    const totalPages = query.pageSize > 0 ? Math.ceil(result.total / query.pageSize) : 0;

    return {
      data: result.items.map((item) => toReportDefinitionResponse(item.record, item.createdBy)),
      meta: { page: query.page, pageSize: query.pageSize, total: result.total, totalPages },
    };
  }

  @RequirePermission('report:create')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentSession() session: ValidatedSession,
    @Body() body: CreateReportDefinitionRequestDto,
  ): Promise<ReportDefinitionResponse> {
    const result = await this.createReportDefinitionUseCase.execute({
      actorUserId: session.userId,
      name: body.name,
      description: body.description,
      metricKeys: body.metricKeys,
    });

    return toReportDefinitionResponse(result.record, result.createdBy);
  }

  @RequirePermission('report:view')
  @Get(':reportId')
  async getById(
    @Param('reportId', new ParseUUIDPipe()) reportId: string,
  ): Promise<ReportDefinitionResponse> {
    const result = await this.getReportDefinitionUseCase.execute(reportId);
    return toReportDefinitionResponse(result.record, result.createdBy);
  }

  @RequirePermission('report:edit')
  @Patch(':reportId')
  async update(
    @CurrentSession() session: ValidatedSession,
    @Param('reportId', new ParseUUIDPipe()) reportId: string,
    @Body() body: UpdateReportDefinitionRequestDto,
  ): Promise<ReportDefinitionResponse> {
    const result = await this.updateReportDefinitionUseCase.execute({
      actorUserId: session.userId,
      reportId,
      name: body.name,
      description: body.description,
      metricKeys: body.metricKeys,
      isActive: body.isActive,
    });

    return toReportDefinitionResponse(result.record, result.createdBy);
  }

  @RequirePermission('report:view')
  @Get(':reportId/run')
  async run(
    @CurrentSession() session: ValidatedSession,
    @Param('reportId', new ParseUUIDPipe()) reportId: string,
    @Query() query: RunReportQueryDto,
    @Res() response: Response,
  ): Promise<void> {
    const result = await this.runReportUseCase.execute({
      actorUserId: session.userId,
      reportId,
    });

    if (this.wantsCsv(query, response)) {
      const csv = this.exportReportCsvUseCase.execute(result);
      response
        .status(HttpStatus.OK)
        .set({
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': buildContentDispositionHeader(csv.filename),
        })
        .send(csv.content);
      return;
    }

    response.status(HttpStatus.OK).json(toReportRunResultResponse(result));
  }

  private wantsCsv(query: RunReportQueryDto, response: Response): boolean {
    if (query.format) {
      return query.format === 'csv';
    }
    const acceptHeader = response.req.headers.accept;
    return typeof acceptHeader === 'string' && acceptHeader.includes('text/csv');
  }
}
