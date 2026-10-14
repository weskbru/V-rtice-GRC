import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
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
import { CreateControlUseCase } from '../application/create-control.usecase';
import { GetControlUseCase } from '../application/get-control.usecase';
import { ListControlsUseCase } from '../application/list-controls.usecase';
import { UpdateControlUseCase } from '../application/update-control.usecase';

import {
  toControlDetailResponse,
  type ControlDetailResponse,
  type ControlSummaryResponse,
} from './dto/control-response.mapper';
import { toControlSummaryResponse } from './dto/control-summary-response.mapper';
import { CreateControlRequestDto } from './dto/create-control-request.dto';
import { ListControlsQueryDto } from './dto/list-controls-query.dto';
import { UpdateControlRequestDto } from './dto/update-control-request.dto';

import type { ValidatedSession } from '../../../core/sessions/application/session.service';
import type { Request, Response } from 'express';

export interface ControlCatalogPageResponse {
  readonly data: readonly ControlSummaryResponse[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

@Controller('controls')
export class ControlController {
  constructor(
    private readonly createControlUseCase: CreateControlUseCase,
    private readonly getControlUseCase: GetControlUseCase,
    private readonly updateControlUseCase: UpdateControlUseCase,
    private readonly listControlsUseCase: ListControlsUseCase,
  ) {}

  @RequirePermission('control:view')
  @Get()
  async list(
    @CurrentSession() session: ValidatedSession,
    @Query() query: ListControlsQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ControlCatalogPageResponse> {
    const result = await this.listControlsUseCase.execute({
      actorUserId: session.userId,
      page: query.page,
      pageSize: query.pageSize,
      q: query.q,
      status: query.status,
      effectiveness: query.effectiveness,
      nature: query.nature,
      type: query.type,
      frequency: query.frequency,
      orgUnitId: query.orgUnitId,
      ownerUserId: query.ownerUserId,
      sortField: query.sort,
      sortDirection: query.direction,
    });

    response.set('Cache-Control', 'no-store');

    return {
      data: result.items.map(toControlSummaryResponse),
      meta: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }

  @RequirePermission('control:create')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentSession() session: ValidatedSession,
    @Body() body: CreateControlRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ControlDetailResponse> {
    const record = await this.createControlUseCase.execute({
      actorUserId: session.userId,
      name: body.name,
      description: body.description,
      orgUnitId: body.orgUnitId,
      ownerUserId: body.ownerUserId,
      nature: body.nature,
      type: body.type,
      frequency: body.frequency,
    });

    response.set('Location', `${request.originalUrl.replace(/\/$/, '')}/${record.id}`);
    response.set('ETag', formatETag(record.version));

    return toControlDetailResponse(record);
  }

  @RequirePermission('control:view')
  @Get(':controlId')
  async findById(
    @CurrentSession() session: ValidatedSession,
    @Param('controlId', new ParseUUIDPipe()) controlId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ControlDetailResponse> {
    const record = await this.getControlUseCase.execute({
      actorUserId: session.userId,
      controlId,
    });

    response.set('Cache-Control', 'no-store');

    return toControlDetailResponse(record);
  }

  @RequirePermission('control:edit')
  @Patch(':controlId')
  async update(
    @CurrentSession() session: ValidatedSession,
    @Param('controlId', new ParseUUIDPipe()) controlId: string,
    @Headers('if-match') ifMatchHeader: string | undefined,
    @Body() body: UpdateControlRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ControlDetailResponse> {
    const expectedVersion = parseIfMatchHeader(ifMatchHeader);
    assertUpdateBodyNotEmpty(body);

    const record = await this.updateControlUseCase.execute({
      actorUserId: session.userId,
      controlId,
      expectedVersion,
      name: body.name,
      description: body.description,
      orgUnitId: body.orgUnitId,
      ownerUserId: body.ownerUserId,
      nature: body.nature,
      type: body.type,
      frequency: body.frequency,
    });

    response.set('ETag', formatETag(record.version));

    return toControlDetailResponse(record);
  }
}

export function formatETag(version: number): string {
  return `"${String(version)}"`;
}

export function parseIfMatchHeader(headerValue: string | undefined): number {
  if (headerValue === undefined || headerValue.trim().length === 0) {
    throw new BadRequestException({
      title: USER_MESSAGES.problemTitle.badRequest,
      detail: USER_MESSAGES.controls.ifMatchRequired,
    });
  }

  const unquoted = headerValue.trim().replace(/^"|"$/g, '');
  const version = Number(unquoted);

  if (!Number.isInteger(version) || version < 0) {
    throw new BadRequestException({
      title: USER_MESSAGES.problemTitle.badRequest,
      detail: USER_MESSAGES.controls.ifMatchInvalid,
    });
  }

  return version;
}

function assertUpdateBodyNotEmpty(body: UpdateControlRequestDto): void {
  if (!Object.values(body).some((value) => value !== undefined)) {
    throw new BadRequestException({
      title: USER_MESSAGES.problemTitle.badRequest,
      detail: USER_MESSAGES.controls.updateRequestEmpty,
    });
  }
}
