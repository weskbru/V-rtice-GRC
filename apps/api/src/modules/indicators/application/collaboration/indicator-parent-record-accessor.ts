/**
 * 009-indicators-reports, Fase 2 (T010) — `IndicatorParentRecordAccessor`:
 * `modules/indicators`'s registration against the commentable entity-type
 * registry (`core/comments/domain/entity-registry.ts`). Mirrors
 * `IncidentParentRecordAccessor`/`RiskParentRecordAccessor` exactly (see
 * either file's own header for the full reasoning this one deliberately
 * does not repeat): `Comment` reaches an `IndicatorDefinition` WITHOUT
 * going through any `IndicatorController` at all (Fase 3's own future
 * controller carries no read call this accessor could reuse yet), so this
 * accessor is the one place that reconstructs FR-030's authorization rule
 * for the dynamic, entity-type-driven case — `indicator:view`, checked
 * first, PLUS existence of the `IndicatorDefinition` row itself.
 *
 * `AttachableEntityType` deliberately gains NO `INDICATOR` value (spec.md
 * FR-033: "somente `INDICATOR`" in `CommentableEntityType`, never in
 * `AttachableEntityType`) — this accessor is registered with
 * `registerCommentableEntityType` ONLY, in `IndicatorsModule`'s
 * constructor, never with `registerAttachableEntityType`.
 *
 * ## No organizational unit to report (research.md D-8)
 *
 * Unlike `IncidentParentRecordAccessor` (which returns the incident's own
 * `orgUnit.id`), `resolveViewableParent` below always returns
 * `organizationalUnitId: undefined` — `IndicatorDefinition` has no
 * `orgUnitId` column at all (data-model.md §1, research.md D-8): it is a
 * shared, organization-wide definition, so there is no organizational unit
 * for the resulting comment's audit entry to carry.
 */
import { Injectable } from '@nestjs/common';

import { PermissionResolverService } from '../../../../core/authorization/application/permission-resolver.service';
import { NotFoundDomainError } from '../../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { IndicatorDefinitionRepositoryPort } from '../../domain/ports/indicator-definition-repository.port';

import type {
  ParentRecordAccess,
  ParentRecordAccessor,
} from '../../../../core/comments/domain/entity-registry';

@Injectable()
export class IndicatorParentRecordAccessor implements ParentRecordAccessor {
  constructor(
    private readonly indicatorDefinitionRepository: IndicatorDefinitionRepositoryPort,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async resolveViewableParent(actorUserId: string, entityId: string): Promise<ParentRecordAccess> {
    const canView = await this.permissionResolver.hasPermission(actorUserId, 'indicator:view');
    if (!canView) {
      // Same non-disclosing refusal a future `GetIndicatorDefinitionUseCase`
      // would throw for a caller lacking `indicator:view` — a caller must
      // not be able to tell "you lack indicator:view entirely" apart from
      // "no such indicator definition" (FR-030's own non-disclosure shape).
      throw new NotFoundDomainError(USER_MESSAGES.indicators.entityLabel, entityId);
    }

    const definition = await this.indicatorDefinitionRepository.findById(entityId);
    if (!definition) {
      throw new NotFoundDomainError(USER_MESSAGES.indicators.entityLabel, entityId);
    }

    // `IndicatorDefinition` has no `orgUnitId` column (research.md D-8) —
    // nothing to attach to the resulting audit entry's
    // `organizationalUnitId` (FR-033).
    return { organizationalUnitId: undefined };
  }
}
