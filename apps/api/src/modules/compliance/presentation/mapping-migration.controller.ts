/**
 * T043/004-compliance-management, User Story 2 —
 * `MappingMigrationController`: `listMappingMigrations`,
 * `executeMappingMigration`, `getMappingMigration` (operations 21-23).
 */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';

import { RequirePermission } from '../../../core/authorization/presentation/permission.guard';
import { CurrentSession } from '../../../core/identity/presentation/current-session.decorator';
import { ExecuteMappingMigrationUseCase } from '../application/mapping-migrations/execute-mapping-migration.usecase';
import { GetMappingMigrationUseCase } from '../application/mapping-migrations/get-mapping-migration.usecase';
import { ListMappingMigrationsUseCase } from '../application/mapping-migrations/list-mapping-migrations.usecase';

import { ExecuteMappingMigrationRequestDto } from './dto/execute-mapping-migration-request.dto';
import { ListMappingMigrationsQueryDto } from './dto/list-mapping-migrations-query.dto';
import {
  toMappingMigrationDetailResponse,
  toMappingMigrationSummaryResponse,
  type MappingMigrationDetailResponse,
  type MappingMigrationSummaryResponse,
} from './dto/mapping-migration-response.mapper';

import type { ValidatedSession } from '../../../core/sessions/application/session.service';

export interface MappingMigrationListResponse {
  readonly data: readonly MappingMigrationSummaryResponse[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

@Controller('frameworks/:frameworkId/versions/:versionId/mapping-migrations')
export class MappingMigrationController {
  constructor(
    private readonly listUseCase: ListMappingMigrationsUseCase,
    private readonly executeUseCase: ExecuteMappingMigrationUseCase,
    private readonly getUseCase: GetMappingMigrationUseCase,
  ) {}

  @RequirePermission('compliance:view')
  @Get()
  async list(
    @Param('frameworkId', new ParseUUIDPipe()) frameworkId: string,
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
    @Query() query: ListMappingMigrationsQueryDto,
  ): Promise<MappingMigrationListResponse> {
    const result = await this.listUseCase.execute({
      frameworkId,
      versionId,
      page: query.page,
      pageSize: query.pageSize,
    });

    const totalPages = query.pageSize > 0 ? Math.ceil(result.total / query.pageSize) : 0;

    return {
      data: result.items.map(toMappingMigrationSummaryResponse),
      meta: { page: query.page, pageSize: query.pageSize, total: result.total, totalPages },
    };
  }

  @RequirePermission('compliance:map')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async execute(
    @CurrentSession() session: ValidatedSession,
    @Param('frameworkId', new ParseUUIDPipe()) frameworkId: string,
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
    @Body() body: ExecuteMappingMigrationRequestDto,
  ): Promise<MappingMigrationDetailResponse> {
    const detail = await this.executeUseCase.execute({
      actorUserId: session.userId,
      frameworkId,
      targetVersionId: versionId,
      sourceFrameworkVersionId: body.sourceFrameworkVersionId,
      correspondences: body.correspondences.map((entry) => ({
        targetRequirementId: entry.targetRequirementId,
        sourceRequirementIds: entry.sourceRequirementIds,
      })),
    });
    return toMappingMigrationDetailResponse(detail);
  }

  @RequirePermission('compliance:view')
  @Get(':migrationId')
  async findById(
    @Param('frameworkId', new ParseUUIDPipe()) frameworkId: string,
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
    @Param('migrationId', new ParseUUIDPipe()) migrationId: string,
  ): Promise<MappingMigrationDetailResponse> {
    const detail = await this.getUseCase.execute({ frameworkId, versionId, migrationId });
    return toMappingMigrationDetailResponse(detail);
  }
}
