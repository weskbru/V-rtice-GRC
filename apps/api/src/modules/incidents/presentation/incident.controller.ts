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
} from '@nestjs/common';

import { RequirePermission } from '../../../core/authorization/presentation/permission.guard';
import { CurrentSession } from '../../../core/identity/presentation/current-session.decorator';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { CreateIncidentUseCase } from '../application/create-incident.usecase';
import { GetIncidentUseCase } from '../application/get-incident.usecase';
import { ListIncidentsUseCase } from '../application/list-incidents.usecase';
import { TransitionIncidentUseCase } from '../application/transition-incident.usecase';
import { UpdateIncidentUseCase } from '../application/update-incident.usecase';

import { CreateIncidentRequestDto } from './dto/create-incident-request.dto';
import { toIncidentResponse, type IncidentResponse } from './dto/incident-response.mapper';
import { ListIncidentsQueryDto } from './dto/list-incidents-query.dto';
import { TransitionIncidentRequestDto } from './dto/transition-incident-request.dto';
import { UpdateIncidentRequestDto } from './dto/update-incident-request.dto';

import type { ValidatedSession } from '../../../core/sessions/application/session.service';

export interface IncidentPageResponse {
  readonly data: readonly IncidentResponse[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

@Controller('incidents')
export class IncidentController {
  constructor(
    private readonly createIncidentUseCase: CreateIncidentUseCase,
    private readonly listIncidentsUseCase: ListIncidentsUseCase,
    private readonly getIncidentUseCase: GetIncidentUseCase,
    private readonly updateIncidentUseCase: UpdateIncidentUseCase,
    private readonly transitionIncidentUseCase: TransitionIncidentUseCase,
  ) {}

  @RequirePermission('incident:view')
  @Get()
  async list(
    @CurrentSession() session: ValidatedSession,
    @Query() query: ListIncidentsQueryDto,
  ): Promise<IncidentPageResponse> {
    const result = await this.listIncidentsUseCase.execute({
      actorUserId: session.userId,
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
      severity: query.severity,
      search: query.search,
      orgUnitId: query.orgUnitId,
      sort: query.sort,
      direction: query.direction,
    });

    const totalPages = result.pageSize > 0 ? Math.ceil(result.total / result.pageSize) : 0;

    return {
      data: result.items.map((item) => toIncidentResponse(item)),
      meta: { page: result.page, pageSize: result.pageSize, total: result.total, totalPages },
    };
  }

  @RequirePermission('incident:create')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentSession() session: ValidatedSession,
    @Body() body: CreateIncidentRequestDto,
  ): Promise<IncidentResponse> {
    const record = await this.createIncidentUseCase.execute({
      actorUserId: session.userId,
      orgUnitId: body.orgUnitId,
      title: body.title,
      description: body.description,
      severity: body.severity,
      reportedOn: body.reportedOn,
      ownerUserId: body.ownerUserId,
    });

    return toIncidentResponse(record);
  }

  @RequirePermission('incident:view')
  @Get(':incidentId')
  async findById(
    @CurrentSession() session: ValidatedSession,
    @Param('incidentId', new ParseUUIDPipe()) incidentId: string,
  ): Promise<IncidentResponse> {
    const record = await this.getIncidentUseCase.execute({
      actorUserId: session.userId,
      incidentId,
    });
    return toIncidentResponse(record);
  }

  @RequirePermission('incident:edit')
  @Patch(':incidentId')
  async update(
    @CurrentSession() session: ValidatedSession,
    @Param('incidentId', new ParseUUIDPipe()) incidentId: string,
    @Body() body: UpdateIncidentRequestDto,
  ): Promise<IncidentResponse> {
    assertUpdateBodyNotEmpty(body);

    const updated = await this.updateIncidentUseCase.execute({
      actorUserId: session.userId,
      incidentId,
      title: body.title,
      description: body.description,
      severity: body.severity,
      ownerUserId: body.ownerUserId,
    });

    return toIncidentResponse(updated);
  }

  @RequirePermission('incident:transition')
  @Post(':incidentId/transitions')
  @HttpCode(HttpStatus.OK)
  async transition(
    @CurrentSession() session: ValidatedSession,
    @Param('incidentId', new ParseUUIDPipe()) incidentId: string,
    @Body() body: TransitionIncidentRequestDto,
  ): Promise<IncidentResponse> {
    const updated = await this.transitionIncidentUseCase.execute({
      actorUserId: session.userId,
      incidentId,
      toStatus: body.toStatus,
      resolutionSummary: body.resolutionSummary,
      cancellationReason: body.cancellationReason,
      reopenReason: body.reopenReason,
    });

    return toIncidentResponse(updated);
  }
}

function assertUpdateBodyNotEmpty(body: UpdateIncidentRequestDto): void {
  if (!Object.values(body).some((value) => value !== undefined)) {
    throw new BadRequestException({
      title: USER_MESSAGES.problemTitle.badRequest,
      detail: USER_MESSAGES.incidents.updateRequestEmpty,
    });
  }
}
