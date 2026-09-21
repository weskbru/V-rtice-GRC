/**
 * T096a — the application-layer read side of `GET /org-units`
 * (`contracts/admin.openapi.yaml`). No transaction and no audit entry (a
 * read is never audited, ADR-005), so this needs only `ScopeResolverService`
 * (FR-025b: resolve the caller's authorized units) and `OrgUnitDirectoryPort`
 * (fetch the matching nodes).
 *
 * FR-025b/FR-025c: a caller with no `OrgScopeGrant` at all resolves to the
 * empty `UNIT` scope (`ScopeResolverService`'s documented "deny by default"
 * case) — `OrgUnitDirectoryPort.listInScope` then returns an empty array,
 * never the whole tree. This is the exact "prova de escopo" the US2
 * integration closure requires: two callers with different grants see
 * different result sets from the identical query.
 */
import { Injectable } from '@nestjs/common';

import { OrgUnitDirectoryPort } from '../domain/ports/org-unit-directory.port';

import { ScopeResolverService } from './scope-resolver.service';

import type {
  OrgUnitDirectoryStatus,
  OrgUnitNodeRecord,
} from '../domain/ports/org-unit-directory.port';

export interface ListOrgUnitsInput {
  readonly actorUserId: string;
  readonly status: OrgUnitDirectoryStatus;
}

@Injectable()
export class ListOrgUnitsUseCase {
  constructor(
    private readonly orgUnitDirectory: OrgUnitDirectoryPort,
    private readonly scopeResolver: ScopeResolverService,
  ) {}

  async execute(input: ListOrgUnitsInput): Promise<readonly OrgUnitNodeRecord[]> {
    const scope = await this.scopeResolver.resolveScope(input.actorUserId);
    return this.orgUnitDirectory.listInScope(scope, input.status);
  }
}
