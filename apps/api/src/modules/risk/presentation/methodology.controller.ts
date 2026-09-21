/**
 * T126 — `MethodologyController`: `GET /risk-methodology`,
 * `GET`/`POST /risk-methodology/versions` per `contracts/platform.openapi
 * .yaml`.
 *
 * The two `GET`s require only an authenticated session (`SessionGuard`,
 * global) plus `@NoPermissionRequired()` — matching the contract's "no
 * additional permission" for both. `@NoPermissionRequired()` is required
 * here, not merely omitting `@RequirePermission`:
 * `PermissionGuard`'s "deny by default" rule
 * (`permission.guard.ts`, `MISSING_PERMISSION_DECLARATION`) refuses any
 * handler carrying neither decorator — an earlier version of this
 * controller omitted it, which meant both `GET`s always 403'd for every
 * caller regardless of role, caught only once a real frontend (US4's
 * `AssessmentForm`) called them end-to-end. Only the `POST` requires
 * `methodology:administer` (verified against the permission registry and
 * `platform.seed.ts`'s `ALL_PERMISSION_IDENTIFIERS` grant to Platform
 * Administrator — see the implementation report).
 */
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

/**
 * Wire shape of `listRiskMethodologyVersions`'s `200` per
 * `contracts/platform.openapi.yaml` (`data`/`meta.page|pageSize|total|
 * totalPages`) — see `AssessmentController`'s own `AssessmentPageResponse`
 * for why this reshape (not `PageResponse`'s internal `items`/flat fields)
 * is required here.
 */
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

  // `@NoPermissionRequired()`, not `@RequirePermission`: the contract is
  // explicit — "Requires an authenticated session; no additional
  // permission" (this file's own header comment already said so, but never
  // declared it to `PermissionGuard`). Without this decorator,
  // `PermissionGuard`'s documented "deny by default" rule
  // (`MISSING_PERMISSION_DECLARATION`) refuses every caller with a 403 —
  // exactly the bug this fixes, matching `DirectoryUsersController`'s own
  // identical reasoning for the same shape of endpoint.
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
