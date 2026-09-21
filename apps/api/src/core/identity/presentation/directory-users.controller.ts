/**
 * T095b — `DirectoryUsersController`: `GET /users` only
 * (`contracts/admin.openapi.yaml`'s "Directory" tag). Missing entirely from
 * the US2 backend — the risk create/edit form cannot populate its "Gestor do
 * risco" / "Responsável" selects without it.
 *
 * `@NoPermissionRequired()`, not `@RequirePermission`: the contract is
 * explicit — "Requires an authenticated session; no administrative
 * permission" — every authenticated user may look up a reduced directory
 * entry to assign a risk owner or responsible person (FR-058).
 * `GET /admin/users` (US8, `user:administer`, activation/roles/scope/login
 * history) is the separate, administrative surface this endpoint is
 * explicitly not — see this module's own doc comments for the boundary.
 *
 * Full user administration is out of scope here. This controller is
 * read-only by construction: no `@Post`/`@Patch`/`@Delete` handler exists or
 * ever will until US8 defines one against `admin.openapi.yaml`'s own
 * `/admin/users` paths.
 *
 * `assignableForOrgUnitId` (query, optional) switches the listing from the
 * browse rule above to the assignment rule for that unit — see
 * `ListDirectoryUsersUseCase`'s own doc comment for the rule and for why an
 * out-of-scope unit and a nonexistent one refuse identically.
 */
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
