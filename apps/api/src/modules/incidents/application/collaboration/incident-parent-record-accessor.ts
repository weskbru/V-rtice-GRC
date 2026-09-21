/**
 * 008-incidents-problems — `IncidentParentRecordAccessor`: `modules/
 * incidents`'s registration against the attachable/commentable
 * entity-type registry (`core/comments/domain/entity-registry.ts`).
 * Mirrors `RiskParentRecordAccessor` exactly (see that file's own header
 * for the full reasoning this one deliberately does not repeat): `Comment`
 * /`Attachment` reach an Incident WITHOUT going through
 * `IncidentController.findById` at all (their own controllers carry
 * `@NoPermissionRequired()`), so this accessor is the one place that
 * reconstructs BOTH halves of FR-098's authorization rule for the
 * dynamic, entity-type-driven case — `incident:view`, checked first, PLUS
 * `GetIncidentUseCase`'s own organizational-scope check (the SAME
 * scope-checked read `IncidentController.findById` uses).
 *
 * `AttachableEntityType.INCIDENT`/`CommentableEntityType.INCIDENT` were
 * added to `schema.prisma` in this module's own foundation migration, but
 * no accessor was ever registered for either — CLAUDE.md §19.10's exact
 * "compiles but has never been executed" shape. This is that missing
 * registration, exercised by `test/integration/
 * incident-problem-collaboration.spec.ts`.
 */
import { Injectable } from '@nestjs/common';

import { PermissionResolverService } from '../../../../core/authorization/application/permission-resolver.service';
import { NotFoundDomainError } from '../../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { GetIncidentUseCase } from '../get-incident.usecase';

import type {
  ParentRecordAccess,
  ParentRecordAccessor,
} from '../../../../core/comments/domain/entity-registry';

@Injectable()
export class IncidentParentRecordAccessor implements ParentRecordAccessor {
  constructor(
    private readonly getIncidentUseCase: GetIncidentUseCase,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async resolveViewableParent(actorUserId: string, entityId: string): Promise<ParentRecordAccess> {
    const canView = await this.permissionResolver.hasPermission(actorUserId, 'incident:view');
    if (!canView) {
      // Same non-disclosing refusal `GetIncidentUseCase` itself would
      // throw for an out-of-scope incident (FR-030) — a caller must not be
      // able to tell "you lack incident:view entirely" apart from "this
      // incident is outside your scope" apart from "no such incident".
      throw new NotFoundDomainError(USER_MESSAGES.incidents.entityLabel, entityId);
    }

    // Reuses `GetIncidentUseCase` verbatim (the SAME scope-checked read
    // `IncidentController.findById` uses) rather than a second, parallel
    // path to "is this incident visible to this actor".
    const incident = await this.getIncidentUseCase.execute({ actorUserId, incidentId: entityId });

    return { organizationalUnitId: incident.orgUnit.id };
  }
}
