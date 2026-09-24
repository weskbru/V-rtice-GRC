import { Controller, Get, Query } from '@nestjs/common';

import { NoPermissionRequired } from '../../authorization/presentation/permission.guard';
import { ListDirectoryUsersUseCase } from '../application/list-directory-users.usecase';

import { CurrentSession } from './current-session.decorator';
import { ListDirectoryUsersQueryDto } from './dto/list-directory-users-query.dto';

import type { ValidatedSession } from '../../sessions/application/session.service';
import type { DirectoryUserRecord } from '../domain/ports/user-directory.port';

export interface DirectoryUsersPageResponse {
  readonly data: readonly DirectoryUserRecord[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

@Controller('users')
export class DirectoryUsersController {
  constructor(private readonly listDirectoryUsers: ListDirectoryUsersUseCase) {}

  @NoPermissionRequired()
  @Get()
  async list(
    @CurrentSession() session: ValidatedSession,
    @Query() query: ListDirectoryUsersQueryDto,
  ): Promise<DirectoryUsersPageResponse> {
    const result = await this.listDirectoryUsers.execute({
      actorUserId: session.userId,
      page: query.page,
      pageSize: query.pageSize,
      q: query.q,
      assignableForOrgUnitId: query.assignableForOrgUnitId,
    });

    return {
      data: result.items,
      meta: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }
}
