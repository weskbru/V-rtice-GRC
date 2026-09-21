/**
 * T180 — `AdminRolesController`: `GET|POST /admin/roles`,
 * `GET /admin/roles/summary`, `GET|PATCH|DELETE /admin/roles/{roleId}`
 * (`contracts/admin.openapi.yaml`'s `Roles` tag). Every operation requires
 * `role:administer` (T172).
 *
 * `GET /admin/roles/summary` was added 2026-09-13 by
 * 015-roles-permissions-surface (T014, FR-039) — read-only, no new entity,
 * no new table. See `summary()` below for why its declaration ORDER is
 * load-bearing.
 */
import {
  Body,
  Controller,
  Delete,
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
  BadRequestException,
} from '@nestjs/common';

import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { CurrentSession } from '../../identity/presentation/current-session.decorator';
import { GetRolesSummaryUseCase } from '../application/get-roles-summary.usecase';
import { RoleAdminService } from '../application/role-admin.service';

import { ListRolesQueryDto } from './dto/list-roles-query.dto';
import { toRoleResponse, type RoleResponse } from './dto/role-response.mapper';
import {
  toRolesSummaryResponse,
  type RolesSummaryResponse,
} from './dto/roles-summary-response.mapper';
import { UpdateRoleRequestDto } from './dto/update-role-request.dto';
import { WriteRoleRequestDto } from './dto/write-role-request.dto';
import { RequirePermission } from './permission.guard';

import type { ValidatedSession } from '../../sessions/application/session.service';
import type { Request, Response } from 'express';

export interface RolePageResponse {
  readonly data: readonly RoleResponse[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

@Controller('admin/roles')
export class AdminRolesController {
  constructor(
    private readonly roleAdmin: RoleAdminService,
    private readonly getRolesSummary: GetRolesSummaryUseCase,
  ) {}

  @RequirePermission('role:administer')
  @Get()
  async list(@Query() query: ListRolesQueryDto): Promise<RolePageResponse> {
    const result = await this.roleAdmin.list(query.page, query.pageSize);
    return {
      data: result.items.map(toRoleResponse),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        totalPages: result.total === 0 ? 0 : Math.ceil(result.total / query.pageSize),
      },
    };
  }

  @RequirePermission('role:administer')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentSession() session: ValidatedSession,
    @Body() body: WriteRoleRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RoleResponse> {
    const role = await this.roleAdmin.create({
      actorUserId: session.userId,
      name: body.name,
      description: body.description,
      permissionIdentifiers: body.permissionIdentifiers,
    });

    response.set('Location', `${request.originalUrl.replace(/\/$/, '')}/${role.id}`);
    return toRoleResponse(role);
  }

  /**
   * 2026-09-13 (015-roles-permissions-surface, T014, FR-039).
   *
   * **Declared BEFORE `@Get(':roleId')` on purpose, and it must stay
   * there.** Nest matches routes in the order their handlers are declared
   * on the controller class, so with the reverse order `/admin/roles/summary`
   * would be captured by `:roleId` and refused by `ParseUUIDPipe` with a
   * `400` — the endpoint would be unreachable while every unit of code
   * involved looked correct. `test/unit/admin-roles-route-order.spec.ts`
   * fails if these two handlers are ever reordered, so this is a structural
   * guard rather than a comment asking to be careful.
   */
  @RequirePermission('role:administer')
  @Get('summary')
  async summary(): Promise<RolesSummaryResponse> {
    const summary = await this.getRolesSummary.execute();
    return toRolesSummaryResponse(summary);
  }

  @RequirePermission('role:administer')
  @Get(':roleId')
  async findById(@Param('roleId', new ParseUUIDPipe()) roleId: string): Promise<RoleResponse> {
    const role = await this.roleAdmin.getById(roleId);
    return toRoleResponse(role);
  }

  @RequirePermission('role:administer')
  @Patch(':roleId')
  async update(
    @CurrentSession() session: ValidatedSession,
    @Param('roleId', new ParseUUIDPipe()) roleId: string,
    @Body() body: UpdateRoleRequestDto,
  ): Promise<RoleResponse> {
    assertUpdateBodyNotEmpty(body);

    const role = await this.roleAdmin.update({
      actorUserId: session.userId,
      roleId,
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.permissionIdentifiers !== undefined
        ? { permissionIdentifiers: body.permissionIdentifiers }
        : {}),
    });
    return toRoleResponse(role);
  }

  @RequirePermission('role:administer')
  @Delete(':roleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentSession() session: ValidatedSession,
    @Param('roleId', new ParseUUIDPipe()) roleId: string,
  ): Promise<void> {
    await this.roleAdmin.delete(roleId, session.userId);
  }
}

/**
 * Named after `RiskController`'s identical-in-intent
 * `assertUpdateBodyNotEmpty`, but NOT copying its `Object.keys(body).length
 * === 0` check: under this project's `target: ES2023` (default
 * `useDefineForClassFields: true`), `class-transformer`'s `plainToInstance`
 * defines every declared class field on the instance — as `undefined` when
 * the client omitted it — so an actually-empty `{}` request body still
 * yields an instance whose `Object.keys(...)` lists every declared
 * property (verified directly against `UpdateUserRequestDto`, the sibling
 * DTO this pattern was first written for). Checking for at least one
 * DEFINED value is what `minProperties: 1` actually requires here.
 */
function assertUpdateBodyNotEmpty(body: UpdateRoleRequestDto): void {
  const hasAnyField = Object.values(body).some((value) => value !== undefined);
  if (!hasAnyField) {
    throw new BadRequestException({
      title: USER_MESSAGES.problemTitle.badRequest,
      detail: USER_MESSAGES.admin.updateRequestEmpty,
    });
  }
}
