/**
 * T180 — `AdminUsersController`: every `/admin/users[/{userId}[/**]]`
 * route except `scope-grants` (`core/organizations`'s
 * `AdminUserScopeGrantsController` — the data it manages belongs to that
 * capability; see that controller's file header) —
 * `contracts/admin.openapi.yaml`'s `Users` tag plus the `roles`
 * sub-resource (`Roles`-permission-gated, per the contract).
 *
 * `PUT /admin/users/{userId}/roles` requires `role:administer`, not
 * `user:administer` — deliberately narrower than the rest of this
 * controller, applied per-handler via `@RequirePermission`. Because of
 * that, and only for that route, the response is the minimized
 * `UserRoleAssignmentResponse` and not `UserDetailResponse` (F-73): the
 * authorization stays as it is, the representation does not disclose the
 * administrative user record. Every other handler here already requires
 * `user:administer`, so `UserDetailResponse` is appropriate for them.
 */
import {
  BadRequestException,
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
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';

import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { RoleAdminService } from '../../authorization/application/role-admin.service';
import { RequirePermission } from '../../authorization/presentation/permission.guard';
import { CreateUserUseCase } from '../application/create-user.usecase';
import { GetUserUseCase } from '../application/get-user.usecase';
import { ListUsersUseCase } from '../application/list-users.usecase';
import { ResetUserPasswordUseCase } from '../application/reset-user-password.usecase';
import { RevokeUserSessionsUseCase } from '../application/revoke-user-sessions.usecase';
import { SetUserStatusUseCase } from '../application/set-user-status.usecase';
import { UpdateUserUseCase } from '../application/update-user.usecase';

import { CurrentSession } from './current-session.decorator';
import {
  toUserDetailResponse,
  toUserResponse,
  toUserRoleAssignmentResponse,
  type UserDetailResponse,
  type UserResponse,
  type UserRoleAssignmentResponse,
} from './dto/admin-user-response.mapper';
import { CreateUserRequestDto } from './dto/create-user-request.dto';
import { ListAdminUsersQueryDto } from './dto/list-admin-users-query.dto';
import { ReplaceUserRolesRequestDto } from './dto/replace-user-roles-request.dto';
import { ResetUserPasswordRequestDto } from './dto/reset-user-password-request.dto';
import { SetUserStatusRequestDto } from './dto/set-user-status-request.dto';
import { UpdateUserRequestDto } from './dto/update-user-request.dto';

import type { ValidatedSession } from '../../sessions/application/session.service';
import type { Request, Response } from 'express';

export interface UserPageResponse {
  readonly data: readonly UserResponse[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

@Controller('admin/users')
export class AdminUsersController {
  constructor(
    private readonly listUsers: ListUsersUseCase,
    private readonly getUser: GetUserUseCase,
    private readonly createUser: CreateUserUseCase,
    private readonly updateUser: UpdateUserUseCase,
    private readonly setUserStatus: SetUserStatusUseCase,
    private readonly resetUserPassword: ResetUserPasswordUseCase,
    private readonly revokeUserSessions: RevokeUserSessionsUseCase,
    private readonly roleAdmin: RoleAdminService,
  ) {}

  @RequirePermission('user:administer')
  @Get()
  async list(@Query() query: ListAdminUsersQueryDto): Promise<UserPageResponse> {
    const result = await this.listUsers.execute({
      page: query.page,
      pageSize: query.pageSize,
      q: query.q,
      status: query.status,
      orgUnitId: query.orgUnitId,
      roleId: query.roleId,
      sortField: query.sort,
      sortDirection: query.direction,
    });

    return {
      data: result.items.map(toUserResponse),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        totalPages: result.total === 0 ? 0 : Math.ceil(result.total / query.pageSize),
      },
    };
  }

  @RequirePermission('user:administer')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentSession() session: ValidatedSession,
    @Body() body: CreateUserRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UserResponse> {
    const user = await this.createUser.execute({
      actorUserId: session.userId,
      email: body.email,
      fullName: body.fullName,
      jobTitle: body.jobTitle ?? undefined,
      primaryOrgUnitId: body.primaryOrgUnitId ?? undefined,
      initialPassword: body.initialPassword,
      roleIds: body.roleIds,
      scopeGrants: body.scopeGrants?.map((grant) => ({
        scopeType: grant.scopeType,
        orgUnitId: grant.orgUnitId ?? undefined,
      })),
    });

    response.set('Location', `${request.originalUrl.replace(/\/$/, '')}/${user.id}`);
    return toUserResponse(user);
  }

  @RequirePermission('user:administer')
  @Get(':userId')
  async findById(
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ): Promise<UserDetailResponse> {
    const user = await this.getUser.execute(userId);
    return toUserDetailResponse(user);
  }

  @RequirePermission('user:administer')
  @Patch(':userId')
  async update(
    @CurrentSession() session: ValidatedSession,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() body: UpdateUserRequestDto,
  ): Promise<UserDetailResponse> {
    assertUpdateBodyNotEmpty(body);

    const user = await this.updateUser.execute({
      actorUserId: session.userId,
      userId,
      ...(body.email !== undefined ? { email: body.email } : {}),
      ...(body.fullName !== undefined ? { fullName: body.fullName } : {}),
      ...(body.jobTitle !== undefined ? { jobTitle: body.jobTitle } : {}),
      ...(body.primaryOrgUnitId !== undefined ? { primaryOrgUnitId: body.primaryOrgUnitId } : {}),
    });
    return toUserDetailResponse(user);
  }

  @RequirePermission('user:administer')
  @Put(':userId/status')
  async setStatus(
    @CurrentSession() session: ValidatedSession,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() body: SetUserStatusRequestDto,
  ): Promise<UserDetailResponse> {
    const user = await this.setUserStatus.execute({
      actorUserId: session.userId,
      userId,
      status: body.status,
      reason: body.reason,
    });
    return toUserDetailResponse(user);
  }

  @RequirePermission('user:administer')
  @Put(':userId/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(
    @CurrentSession() session: ValidatedSession,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() body: ResetUserPasswordRequestDto,
  ): Promise<void> {
    await this.resetUserPassword.execute({
      actorUserId: session.userId,
      userId,
      newPassword: body.newPassword,
    });
  }

  @RequirePermission('user:administer')
  @Delete(':userId/sessions')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSessions(
    @CurrentSession() session: ValidatedSession,
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ): Promise<void> {
    await this.revokeUserSessions.execute({ actorUserId: session.userId, userId });
  }

  @RequirePermission('role:administer')
  @Put(':userId/roles')
  async replaceRoles(
    @CurrentSession() session: ValidatedSession,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() body: ReplaceUserRolesRequestDto,
  ): Promise<UserRoleAssignmentResponse> {
    // `RoleAdminService.replaceUserRoles` operates on `UserRole` directly
    // and has no independent way to distinguish "user does not exist"
    // from "user exists with zero roles" — this controller confirms the
    // 404 first (`GetUserUseCase`, same capability as the route's own
    // resource).
    await this.getUser.execute(userId);

    await this.roleAdmin.replaceUserRoles({
      actorUserId: session.userId,
      userId,
      roleIds: body.roleIds,
    });

    const updated = await this.getUser.execute(userId);
    // F-73: minimized on the way out, NOT `toUserDetailResponse`. This is
    // the one handler in this controller a caller without `user:administer`
    // can reach — see the mapper's own header for the full argument.
    return toUserRoleAssignmentResponse(updated);
  }
}

/**
 * Named after `RiskController`'s identical-in-intent
 * `assertUpdateBodyNotEmpty`, but NOT copying its `Object.keys(body).length
 * === 0` check: under this project's `target: ES2023` (default
 * `useDefineForClassFields: true`), `class-transformer`'s `plainToInstance`
 * defines every declared class field on the instance — as `undefined` when
 * the client omitted it — so an actually-empty `{}` request body still
 * yields an instance whose `Object.keys(...)` lists all four properties,
 * and this check would never fire (verified directly: `plainToInstance
 * (UpdateUserRequestDto, {})` produces `['email', 'fullName', 'jobTitle',
 * 'primaryOrgUnitId']`). Checking for at least one DEFINED value is what
 * `minProperties: 1` actually requires here.
 */
function assertUpdateBodyNotEmpty(body: UpdateUserRequestDto): void {
  const hasAnyField = Object.values(body).some((value) => value !== undefined);
  if (!hasAnyField) {
    throw new BadRequestException({
      title: USER_MESSAGES.problemTitle.badRequest,
      detail: USER_MESSAGES.admin.updateRequestEmpty,
    });
  }
}
