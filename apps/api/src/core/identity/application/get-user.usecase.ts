/**
 * T176 — `GET /admin/users/{userId}` and the response body of every other
 * `/admin/users/{userId}/**` mutation (`contracts/admin.openapi.yaml`'s
 * `UserDetail` = `User` + `scopeGrants`).
 *
 * `scopeGrants` is fetched via `ScopeGrantService` (`core/organizations`,
 * cross-capability core-application dependency, unrestricted by ADR-011)
 * rather than duplicating its detailed-grant query in
 * `UserDirectoryPort` — one source of truth for "what does a scope grant
 * look like with its org-unit/granted-by refs resolved" (that service's
 * own `list` method).
 */
import { Injectable } from '@nestjs/common';

import { NotFoundDomainError } from '../../../shared/errors/domain-error';
import { ScopeGrantService } from '../../organizations/application/scope-grant.service';
import { UserDirectoryPort, type AdminUserRecord } from '../domain/ports/user-directory.port';

import type { DetailedOrgScopeGrantRecord } from '../../organizations/domain/ports/org-scope-repository.port';

const USER_ENTITY_LABEL = 'Usuário';

export interface AdminUserDetail extends AdminUserRecord {
  readonly scopeGrants: readonly DetailedOrgScopeGrantRecord[];
}

@Injectable()
export class GetUserUseCase {
  constructor(
    private readonly userDirectory: UserDirectoryPort,
    private readonly scopeGrants: ScopeGrantService,
  ) {}

  async execute(userId: string): Promise<AdminUserDetail> {
    const user = await this.userDirectory.findAdminRecordById(userId);
    if (!user) {
      throw new NotFoundDomainError(USER_ENTITY_LABEL, userId);
    }

    const scopeGrants = await this.scopeGrants.list(userId);
    return { ...user, scopeGrants };
  }
}
