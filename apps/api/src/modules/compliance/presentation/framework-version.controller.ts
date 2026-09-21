/**
 * T030/004-compliance-management — `FrameworkVersionController`: the
 * version catalog, edit and publish operations of
 * `contracts/compliance.openapi.yaml` (`listFrameworkVersions`,
 * `createFrameworkVersion`, `getFrameworkVersion`, `updateFrameworkVersion`,
 * `publishFrameworkVersion` — operations 5-9). Mirrors
 * `framework.controller.ts`'s own conventions (`formatETag`/
 * `parseIfMatchHeader`, imported from it — same module, so this is not a
 * cross-module import).
 */
import {
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
import { CreateFrameworkVersionUseCase } from '../application/framework-versions/create-framework-version.usecase';
import { GetFrameworkVersionUseCase } from '../application/framework-versions/get-framework-version.usecase';
import { ListFrameworkVersionsUseCase } from '../application/framework-versions/list-framework-versions.usecase';
import { PublishFrameworkVersionUseCase } from '../application/framework-versions/publish-framework-version.usecase';
import { UpdateFrameworkVersionUseCase } from '../application/framework-versions/update-framework-version.usecase';

import { CreateFrameworkVersionRequestDto } from './dto/create-framework-version-request.dto';
import {
  toFrameworkVersionResponse,
  type FrameworkVersionResponse,
} from './dto/framework-version-response.mapper';
import { ListFrameworkVersionsQueryDto } from './dto/list-framework-versions-query.dto';
import { UpdateFrameworkVersionRequestDto } from './dto/update-framework-version-request.dto';
import { formatETag, parseIfMatchHeader } from './framework.controller';

import type { ValidatedSession } from '../../../core/sessions/application/session.service';
import type { Request, Response } from 'express';

export interface FrameworkVersionListResponse {
  readonly data: readonly FrameworkVersionResponse[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

@Controller('frameworks/:frameworkId/versions')
export class FrameworkVersionController {
  constructor(
    private readonly createFrameworkVersionUseCase: CreateFrameworkVersionUseCase,
    private readonly getFrameworkVersionUseCase: GetFrameworkVersionUseCase,
    private readonly listFrameworkVersionsUseCase: ListFrameworkVersionsUseCase,
    private readonly updateFrameworkVersionUseCase: UpdateFrameworkVersionUseCase,
    private readonly publishFrameworkVersionUseCase: PublishFrameworkVersionUseCase,
  ) {}

  @RequirePermission('compliance:view')
  @Get()
  async list(
    @Param('frameworkId', new ParseUUIDPipe()) frameworkId: string,
    @Query() query: ListFrameworkVersionsQueryDto,
  ): Promise<FrameworkVersionListResponse> {
    const result = await this.listFrameworkVersionsUseCase.execute({
      frameworkId,
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
    });

    const totalPages = query.pageSize > 0 ? Math.ceil(result.total / query.pageSize) : 0;

    return {
      data: result.items.map(toFrameworkVersionResponse),
      meta: { page: query.page, pageSize: query.pageSize, total: result.total, totalPages },
    };
  }

  @RequirePermission('compliance:administer')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentSession() session: ValidatedSession,
    @Param('frameworkId', new ParseUUIDPipe()) frameworkId: string,
    @Body() body: CreateFrameworkVersionRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<FrameworkVersionResponse> {
    const record = await this.createFrameworkVersionUseCase.execute({
      actorUserId: session.userId,
      frameworkId,
      label: body.label,
    });

    response.set('Location', `${request.originalUrl.replace(/\/$/, '')}/${record.id}`);
    response.set('ETag', formatETag(record.version));

    return toFrameworkVersionResponse(record);
  }

  @RequirePermission('compliance:view')
  @Get(':versionId')
  async findById(
    @Param('frameworkId', new ParseUUIDPipe()) frameworkId: string,
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<FrameworkVersionResponse> {
    const record = await this.getFrameworkVersionUseCase.execute({ frameworkId, versionId });

    response.set('ETag', formatETag(record.version));

    return toFrameworkVersionResponse(record);
  }

  @RequirePermission('compliance:administer')
  @Patch(':versionId')
  async update(
    @CurrentSession() session: ValidatedSession,
    @Param('frameworkId', new ParseUUIDPipe()) frameworkId: string,
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
    @Headers('if-match') ifMatchHeader: string | undefined,
    @Body() body: UpdateFrameworkVersionRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<FrameworkVersionResponse> {
    const expectedVersion = parseIfMatchHeader(ifMatchHeader);

    const record = await this.updateFrameworkVersionUseCase.execute({
      actorUserId: session.userId,
      frameworkId,
      versionId,
      expectedVersion,
      label: body.label,
    });

    response.set('ETag', formatETag(record.version));

    return toFrameworkVersionResponse(record);
  }

  @RequirePermission('compliance:administer')
  @Post(':versionId/publish')
  @HttpCode(HttpStatus.OK)
  async publish(
    @CurrentSession() session: ValidatedSession,
    @Param('frameworkId', new ParseUUIDPipe()) frameworkId: string,
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
    @Headers('if-match') ifMatchHeader: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<FrameworkVersionResponse> {
    const expectedVersion = parseIfMatchHeader(ifMatchHeader);

    const record = await this.publishFrameworkVersionUseCase.execute({
      actorUserId: session.userId,
      frameworkId,
      versionId,
      expectedVersion,
    });

    response.set('ETag', formatETag(record.version));

    return toFrameworkVersionResponse(record);
  }
}
