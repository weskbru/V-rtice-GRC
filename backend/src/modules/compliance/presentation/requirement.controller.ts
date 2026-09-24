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
import { CreateRequirementUseCase } from '../application/requirements/create-requirement.usecase';
import { GetRequirementUseCase } from '../application/requirements/get-requirement.usecase';
import { ListRequirementsUseCase } from '../application/requirements/list-requirements.usecase';
import { UpdateRequirementUseCase } from '../application/requirements/update-requirement.usecase';

import { CreateRequirementRequestDto } from './dto/create-requirement-request.dto';
import { ListRequirementsQueryDto } from './dto/list-requirements-query.dto';
import { toRequirementResponse, type RequirementResponse } from './dto/requirement-response.mapper';
import { UpdateRequirementRequestDto } from './dto/update-requirement-request.dto';
import { formatETag, parseIfMatchHeader } from './framework.controller';

import type { ValidatedSession } from '../../../core/sessions/application/session.service';
import type { Request, Response } from 'express';

export interface RequirementListResponse {
  readonly data: readonly RequirementResponse[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

@Controller()
export class RequirementController {
  constructor(
    private readonly createRequirementUseCase: CreateRequirementUseCase,
    private readonly updateRequirementUseCase: UpdateRequirementUseCase,
    private readonly getRequirementUseCase: GetRequirementUseCase,
    private readonly listRequirementsUseCase: ListRequirementsUseCase,
  ) {}

  @RequirePermission('compliance:view')
  @Get('frameworks/:frameworkId/versions/:versionId/requirements')
  async list(
    @Param('frameworkId', new ParseUUIDPipe()) frameworkId: string,
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
    @Query() query: ListRequirementsQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RequirementListResponse> {
    const result = await this.listRequirementsUseCase.execute({
      frameworkId,
      versionId,
      page: query.page,
      pageSize: query.pageSize,
      complianceStates: query.complianceState,
    });

    const totalPages = query.pageSize > 0 ? Math.ceil(result.total / query.pageSize) : 0;

    response.set('Cache-Control', 'no-store');

    return {
      data: result.items.map(toRequirementResponse),
      meta: { page: query.page, pageSize: query.pageSize, total: result.total, totalPages },
    };
  }

  @RequirePermission('compliance:view')
  @Get('requirements/:requirementId')
  async findById(
    @Param('requirementId', new ParseUUIDPipe()) requirementId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RequirementResponse> {
    const record = await this.getRequirementUseCase.execute(requirementId);

    response.set('Cache-Control', 'no-store');

    return toRequirementResponse(record);
  }

  @RequirePermission('compliance:administer')
  @Post('frameworks/:frameworkId/versions/:versionId/requirements')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentSession() session: ValidatedSession,
    @Param('frameworkId', new ParseUUIDPipe()) frameworkId: string,
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
    @Body() body: CreateRequirementRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RequirementResponse> {
    const record = await this.createRequirementUseCase.execute({
      actorUserId: session.userId,
      frameworkId,
      versionId,
      externalRef: body.externalRef,
      title: body.title,
      description: body.description,
    });

    const apiRoot = request.originalUrl.split('/frameworks/')[0];
    response.set('Location', `${apiRoot}/requirements/${record.id}`);
    response.set('ETag', formatETag(record.version));

    return toRequirementResponse(record);
  }

  @RequirePermission('compliance:administer')
  @Patch('requirements/:requirementId')
  async update(
    @CurrentSession() session: ValidatedSession,
    @Param('requirementId', new ParseUUIDPipe()) requirementId: string,
    @Headers('if-match') ifMatchHeader: string | undefined,
    @Body() body: UpdateRequirementRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RequirementResponse> {
    const expectedVersion = parseIfMatchHeader(ifMatchHeader);
    assertUpdateBodyNotEmpty(body);

    const record = await this.updateRequirementUseCase.execute({
      actorUserId: session.userId,
      requirementId,
      expectedVersion,
      externalRef: body.externalRef,
      title: body.title,
      description: body.description,
    });

    response.set('ETag', formatETag(record.version));

    return toRequirementResponse(record);
  }
}

function assertUpdateBodyNotEmpty(body: UpdateRequirementRequestDto): void {
  if (!Object.values(body).some((value) => value !== undefined)) {
    throw new BadRequestException({
      title: USER_MESSAGES.problemTitle.badRequest,
      detail: USER_MESSAGES.compliance.updateRequestEmpty,
    });
  }
}
