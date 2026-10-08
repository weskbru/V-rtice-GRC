import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req, Res } from '@nestjs/common';

import {
  NoPermissionRequired,
  RequirePermission,
} from '../../../core/authorization/presentation/permission.guard';
import { CurrentSession } from '../../../core/identity/presentation/current-session.decorator';
import { createPageResponse } from '../../../shared/pagination';
import { MethodologyQueryUseCase } from '../application/methodology-query.usecase';
import { PublishMethodologyVersionUseCase } from '../application/publish-methodology-version.usecase';

import { CreateMethodologyVersionRequestDto } from './dto/create-methodology-version-request.dto';
import {
  toMethodologyVersionResponse,
  type MethodologyVersionResponse,
} from './dto/methodology-response.mapper';
import { PageQueryDto } from './dto/page-query.dto';

import type { ValidatedSession } from '../../../core/sessions/application/session.service';
import type { Request, Response } from 'express';

export interface MethodologyVersionPageResponse {
  readonly data: readonly MethodologyVersionResponse[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

@Controller('risk-methodology')
export class MethodologyController {
  constructor(
    private readonly methodologyQueryUseCase: MethodologyQueryUseCase,
    private readonly publishMethodologyVersionUseCase: PublishMethodologyVersionUseCase,
  ) {}

  @NoPermissionRequired()
  @Get()
  async getActive(): Promise<MethodologyVersionResponse> {
    const result = await this.methodologyQueryUseCase.getActiveVersion();
    return toMethodologyVersionResponse(result);
  }

  @NoPermissionRequired()
  @Get('versions')
  async listVersions(@Query() query: PageQueryDto): Promise<MethodologyVersionPageResponse> {
    const { items, total } = await this.methodologyQueryUseCase.listVersions(
      query.page,
      query.pageSize,
    );

    const page = createPageResponse(
      items.map(toMethodologyVersionResponse),
      { page: query.page, pageSize: query.pageSize },
      total,
    );
    return {
      data: page.items,
      meta: {
        page: page.page,
        pageSize: page.pageSize,
        total: page.total,
        totalPages: page.totalPages,
      },
    };
  }

  @RequirePermission('methodology:administer')
  @Post('versions')
  @HttpCode(HttpStatus.CREATED)
  async publishVersion(
    @CurrentSession() session: ValidatedSession,
    @Body() body: CreateMethodologyVersionRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<MethodologyVersionResponse> {
    const version = await this.publishMethodologyVersionUseCase.execute({
      actorUserId: session.userId,
      probabilityScale: body.probabilityScale,
      impactScale: body.impactScale,
      matrix: body.matrix,
      levelBands: body.levelBands,
      effectiveFrom: body.effectiveFrom,
    });

    response.set('Location', `${request.originalUrl.replace(/\/$/, '')}/${version.id}`);

    return toMethodologyVersionResponse({ version, isActive: true });
  }
}
