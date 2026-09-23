import {
  BadRequestException,
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
  Req,
  Res,
} from '@nestjs/common';

import { RequirePermission } from '../../../core/authorization/presentation/permission.guard';
import { CurrentSession } from '../../../core/identity/presentation/current-session.decorator';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { CreateProcessUseCase } from '../application/create-process.usecase';
import { DeactivateProcessUseCase } from '../application/deactivate-process.usecase';
import { GetProcessUseCase } from '../application/get-process.usecase';
import { ListProcessIncidentLinksUseCase } from '../application/list-process-incident-links.usecase';
import { ListProcessesUseCase } from '../application/list-processes.usecase';
import { ReactivateProcessUseCase } from '../application/reactivate-process.usecase';
import { UpdateProcessUseCase } from '../application/update-process.usecase';

import { CreateProcessRequestDto } from './dto/create-process-request.dto';
import { ListProcessesQueryDto } from './dto/list-processes-query.dto';
import {
  toProcessIncidentLinkResponse,
  type ProcessIncidentLinkResponse,
} from './dto/process-incident-link-response.mapper';
import {
  toProcessDetailResponse,
  toProcessSummaryResponse,
  type ProcessDetailResponse,
  type ProcessSummaryResponse,
} from './dto/process-response.mapper';
import { UpdateProcessRequestDto } from './dto/update-process-request.dto';

import type { ValidatedSession } from '../../../core/sessions/application/session.service';
import type { Request, Response } from 'express';

export interface ProcessCatalogPageResponse {
  readonly data: readonly ProcessSummaryResponse[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

@Controller('processes')
export class ProcessController {
  constructor(
    private readonly createProcessUseCase: CreateProcessUseCase,
    private readonly getProcessUseCase: GetProcessUseCase,
    private readonly updateProcessUseCase: UpdateProcessUseCase,
    private readonly listProcessesUseCase: ListProcessesUseCase,
    private readonly deactivateProcessUseCase: DeactivateProcessUseCase,
    private readonly reactivateProcessUseCase: ReactivateProcessUseCase,
    private readonly listProcessIncidentLinksUseCase: ListProcessIncidentLinksUseCase,
  ) {}

  @RequirePermission('process:view')
  @Get()
  async list(
    @CurrentSession() session: ValidatedSession,
    @Query() query: ListProcessesQueryDto,
  ): Promise<ProcessCatalogPageResponse> {
    const result = await this.listProcessesUseCase.execute({
      actorUserId: session.userId,
      page: query.page,
      pageSize: query.pageSize,
      q: query.q,
      orgUnitId: query.orgUnitId,
      isActive: query.isActive,
      sortField: query.sort,
      sortDirection: query.direction,
    });

    return {
      data: result.items.map(toProcessSummaryResponse),
      meta: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }

  @RequirePermission('process:create')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentSession() session: ValidatedSession,
    @Body() body: CreateProcessRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ProcessDetailResponse> {
    const record = await this.createProcessUseCase.execute({
      actorUserId: session.userId,
      name: body.name,
      description: body.description,
      orgUnitId: body.orgUnitId,
    });

    response.set('Location', `${request.originalUrl.replace(/\/$/, '')}/${record.id}`);

    return toProcessDetailResponse(record);
  }

  @RequirePermission('process:view')
  @Get(':processId')
  async findById(
    @CurrentSession() session: ValidatedSession,
    @Param('processId', new ParseUUIDPipe()) processId: string,
  ): Promise<ProcessDetailResponse> {
    const record = await this.getProcessUseCase.execute({
      actorUserId: session.userId,
      processId,
    });

    return toProcessDetailResponse(record);
  }

  @RequirePermission('process:edit')
  @Patch(':processId')
  async update(
    @CurrentSession() session: ValidatedSession,
    @Param('processId', new ParseUUIDPipe()) processId: string,
    @Body() body: UpdateProcessRequestDto,
  ): Promise<ProcessDetailResponse> {
    assertUpdateBodyNotEmpty(body);

    const record = await this.updateProcessUseCase.execute({
      actorUserId: session.userId,
      processId,
      name: body.name,
      description: body.description,
      orgUnitId: body.orgUnitId,
    });

    return toProcessDetailResponse(record);
  }

  @RequirePermission('process:administer')
  @Post(':processId/deactivate')
  @HttpCode(HttpStatus.OK)
  async deactivate(
    @CurrentSession() session: ValidatedSession,
    @Param('processId', new ParseUUIDPipe()) processId: string,
  ): Promise<ProcessDetailResponse> {
    const record = await this.deactivateProcessUseCase.execute({
      actorUserId: session.userId,
      processId,
    });

    return toProcessDetailResponse(record);
  }

  @RequirePermission('process:administer')
  @Post(':processId/reactivate')
  @HttpCode(HttpStatus.OK)
  async reactivate(
    @CurrentSession() session: ValidatedSession,
    @Param('processId', new ParseUUIDPipe()) processId: string,
  ): Promise<ProcessDetailResponse> {
    const record = await this.reactivateProcessUseCase.execute({
      actorUserId: session.userId,
      processId,
    });

    return toProcessDetailResponse(record);
  }

  @RequirePermission('process:view')
  @Get(':processId/incidents')
  async listIncidentLinks(
    @CurrentSession() session: ValidatedSession,
    @Param('processId', new ParseUUIDPipe()) processId: string,
    @Query('includeWithdrawn') includeWithdrawnRaw: string | undefined,
  ): Promise<readonly ProcessIncidentLinkResponse[]> {
    const links = await this.listProcessIncidentLinksUseCase.execute({
      actorUserId: session.userId,
      processId,
      includeWithdrawn: includeWithdrawnRaw === 'true',
    });
    return links.map(toProcessIncidentLinkResponse);
  }
}

function assertUpdateBodyNotEmpty(body: UpdateProcessRequestDto): void {
  if (!Object.values(body).some((value) => value !== undefined)) {
    throw new BadRequestException({
      title: USER_MESSAGES.problemTitle.badRequest,
      detail: USER_MESSAGES.processes.updateRequestEmpty,
    });
  }
}
