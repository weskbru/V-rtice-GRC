/**
 * T022/006-assets-processes — `AssetController`: the six operations of
 * `contracts/assets.openapi.yaml` (`listAssetCatalog`, `createAsset`,
 * `getAsset`, `updateAsset`, `deactivateAsset`, `reactivateAsset`). Modeled
 * closely on `modules/controls/presentation/control.controller.ts` and
 * `grc/finding/presentation/finding.controller.ts` — see either file's
 * header for the general shape this one does not repeat.
 *
 * ## No `If-Match`/`ETag` anywhere on this controller
 *
 * `assets` carries no `version` column (data-model.md §1) — see
 * `contracts/assets.openapi.yaml`'s own description section for why no
 * optimistic-locking mechanism applies to any operation here, unlike
 * `ControlController`.
 *
 * ## No `Cache-Control: no-store` anywhere on this controller
 *
 * Every property this controller ever returns is a plain column, or a
 * direct read of an existing link table — never a value computed fresh at
 * read time from mutable state elsewhere (data-model.md §11, unlike
 * `ControlController.findById`'s `effectiveness`).
 */
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
import { CreateAssetUseCase } from '../application/create-asset.usecase';
import { DeactivateAssetUseCase } from '../application/deactivate-asset.usecase';
import { GetAssetUseCase } from '../application/get-asset.usecase';
import { ListAssetIncidentLinksUseCase } from '../application/list-asset-incident-links.usecase';
import { ListAssetsUseCase } from '../application/list-assets.usecase';
import { ReactivateAssetUseCase } from '../application/reactivate-asset.usecase';
import { UpdateAssetUseCase } from '../application/update-asset.usecase';

import {
  toAssetIncidentLinkResponse,
  type AssetIncidentLinkResponse,
} from './dto/asset-incident-link-response.mapper';
import {
  toAssetDetailResponse,
  toAssetSummaryResponse,
  type AssetDetailResponse,
  type AssetSummaryResponse,
} from './dto/asset-response.mapper';
import { CreateAssetRequestDto } from './dto/create-asset-request.dto';
import { ListAssetsQueryDto } from './dto/list-assets-query.dto';
import { UpdateAssetRequestDto } from './dto/update-asset-request.dto';

import type { ValidatedSession } from '../../../core/sessions/application/session.service';
import type { Request, Response } from 'express';

export interface AssetCatalogPageResponse {
  readonly data: readonly AssetSummaryResponse[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

@Controller('assets')
export class AssetController {
  constructor(
    private readonly createAssetUseCase: CreateAssetUseCase,
    private readonly getAssetUseCase: GetAssetUseCase,
    private readonly updateAssetUseCase: UpdateAssetUseCase,
    private readonly listAssetsUseCase: ListAssetsUseCase,
    private readonly deactivateAssetUseCase: DeactivateAssetUseCase,
    private readonly reactivateAssetUseCase: ReactivateAssetUseCase,
    private readonly listAssetIncidentLinksUseCase: ListAssetIncidentLinksUseCase,
  ) {}

  /**
   * `listAssetCatalog` (US1, US2, US3). Declared BEFORE `findById`'s
   * `:assetId` route in this file for the same reason `RiskController.list`
   * documents: Nest dispatches `/assets` and `/assets/:assetId`
   * unambiguously regardless of declaration order.
   *
   * Requires `asset:view` — the resource's OWN permission (US2, FR-009),
   * never `risk:view`. Resolves and applies the caller's `ScopeFilter`
   * (T017) — closes the "Vazamento 1" read leak the spec measures against
   * the retired `RegistryController.listAssets`.
   */
  @RequirePermission('asset:view')
  @Get()
  async list(
    @CurrentSession() session: ValidatedSession,
    @Query() query: ListAssetsQueryDto,
  ): Promise<AssetCatalogPageResponse> {
    const result = await this.listAssetsUseCase.execute({
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
      data: result.items.map(toAssetSummaryResponse),
      meta: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }

  @RequirePermission('asset:create')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentSession() session: ValidatedSession,
    @Body() body: CreateAssetRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AssetDetailResponse> {
    const record = await this.createAssetUseCase.execute({
      actorUserId: session.userId,
      name: body.name,
      description: body.description,
      orgUnitId: body.orgUnitId,
    });

    response.set('Location', `${request.originalUrl.replace(/\/$/, '')}/${record.id}`);

    return toAssetDetailResponse(record);
  }

  @RequirePermission('asset:view')
  @Get(':assetId')
  async findById(
    @CurrentSession() session: ValidatedSession,
    @Param('assetId', new ParseUUIDPipe()) assetId: string,
  ): Promise<AssetDetailResponse> {
    const record = await this.getAssetUseCase.execute({
      actorUserId: session.userId,
      assetId,
    });

    return toAssetDetailResponse(record);
  }

  @RequirePermission('asset:edit')
  @Patch(':assetId')
  async update(
    @CurrentSession() session: ValidatedSession,
    @Param('assetId', new ParseUUIDPipe()) assetId: string,
    @Body() body: UpdateAssetRequestDto,
  ): Promise<AssetDetailResponse> {
    assertUpdateBodyNotEmpty(body);

    const record = await this.updateAssetUseCase.execute({
      actorUserId: session.userId,
      assetId,
      name: body.name,
      description: body.description,
      orgUnitId: body.orgUnitId,
    });

    return toAssetDetailResponse(record);
  }

  @RequirePermission('asset:administer')
  @Post(':assetId/deactivate')
  @HttpCode(HttpStatus.OK)
  async deactivate(
    @CurrentSession() session: ValidatedSession,
    @Param('assetId', new ParseUUIDPipe()) assetId: string,
  ): Promise<AssetDetailResponse> {
    const record = await this.deactivateAssetUseCase.execute({
      actorUserId: session.userId,
      assetId,
    });

    return toAssetDetailResponse(record);
  }

  @RequirePermission('asset:administer')
  @Post(':assetId/reactivate')
  @HttpCode(HttpStatus.OK)
  async reactivate(
    @CurrentSession() session: ValidatedSession,
    @Param('assetId', new ParseUUIDPipe()) assetId: string,
  ): Promise<AssetDetailResponse> {
    const record = await this.reactivateAssetUseCase.execute({
      actorUserId: session.userId,
      assetId,
    });

    return toAssetDetailResponse(record);
  }

  /**
   * 013-incidents-problems-reverse-links — READ-ONLY reverse of
   * `IncidentAssetLink`: `modules/assets` never writes this table
   * (`modules/incidents`'s `link-incident-asset.usecase.ts` owns that
   * write path). Requires `asset:view` and scope, resolved by
   * `GetAssetUseCase` exactly like `findById` above.
   */
  @RequirePermission('asset:view')
  @Get(':assetId/incidents')
  async listIncidentLinks(
    @CurrentSession() session: ValidatedSession,
    @Param('assetId', new ParseUUIDPipe()) assetId: string,
    @Query('includeWithdrawn') includeWithdrawnRaw: string | undefined,
  ): Promise<readonly AssetIncidentLinkResponse[]> {
    const links = await this.listAssetIncidentLinksUseCase.execute({
      actorUserId: session.userId,
      assetId,
      includeWithdrawn: includeWithdrawnRaw === 'true',
    });
    return links.map(toAssetIncidentLinkResponse);
  }
}

/** `UpdateAssetRequest`'s `minProperties: 1` — see
 * `ControlController.assertUpdateBodyNotEmpty`'s own doc comment for why
 * this is a controller-level check with no dedicated validator class. */
function assertUpdateBodyNotEmpty(body: UpdateAssetRequestDto): void {
  if (!Object.values(body).some((value) => value !== undefined)) {
    throw new BadRequestException({
      title: USER_MESSAGES.problemTitle.badRequest,
      detail: USER_MESSAGES.assets.updateRequestEmpty,
    });
  }
}
