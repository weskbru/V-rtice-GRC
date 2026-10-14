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

function assertUpdateBodyNotEmpty(body: UpdateRoleRequestDto): void {
  const hasAnyField = Object.values(body).some((value) => value !== undefined);
  if (!hasAnyField) {
    throw new BadRequestException({
      title: USER_MESSAGES.problemTitle.badRequest,
      detail: USER_MESSAGES.admin.updateRequestEmpty,
    });
  }
}
